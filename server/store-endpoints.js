const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 3C: unlock-token helpers. The token is HMAC-SHA256(JWT_SECRET, `${productId}|${expSeconds}`)
// — short, stateless, and scoped to a single product. Buyer stores it in sessionStorage
// after a successful PIN unlock and passes it on every gated request for that product.
function signUnlockToken(productId, ttlSeconds = 3600) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${productId}|${exp}`;
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
    return `${exp}.${sig}`;
}
function verifyUnlockToken(token, productId) {
    if (typeof token !== 'string') return false;
    const [expStr, sig] = token.split('.');
    if (!expStr || !sig) return false;
    const exp = parseInt(expStr, 10);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET)
        .update(`${productId}|${exp}`).digest('base64url');
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
    catch { return false; }
}
// HMAC-hash the requester IP for any persisted rate-limit / abuse-tracking row.
// Implementation lives in server/privacy.js so the secret stays in one place
// and the same hashes are used everywhere. Truncated to 32 chars to keep DB
// indexes compact — collision space stays at 2^128 even after truncation.
const { hmacIp } = require('./privacy');
function hashIp(req) {
    return hmacIp(req).slice(0, 32);
}

// ============================================
// STORE API ENDPOINTS
// ============================================

/**
 * Verify password for sensitive operations
 * Used in store setup wizard
 */
function addVerifyPasswordEndpoint(app, authenticateToken, dbGet) {
    app.post('/api/verify-password', authenticateToken, async (req, res) => {
        try {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password required' });
            }

            const user = await dbGet('SELECT password_hash FROM users WHERE id = ?', [req.user.userId]);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const match = await bcrypt.compare(password, user.password_hash);

            if (!match) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[VERIFY_PASSWORD] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Initial store setup
 * Creates store_config record with encrypted wallet
 */
function addStoreSetupEndpoint(app, authenticateToken, dbRun, dbGet) {
    app.post('/api/store/setup', authenticateToken, async (req, res) => {
        try {
            const { monero_address, encrypted_view_key, store_name, store_bio } = req.body;

            if (!monero_address) {
                return res.status(400).json({ error: 'Monero address required' });
            }

            // Validate Monero address format (starts with 4 or 8, ~95 chars)
            if (!/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(monero_address)) {
                return res.status(400).json({ error: 'Invalid Monero address format' });
            }

            // Check if already has store
            const existing = await dbGet('SELECT user_id FROM store_config WHERE user_id = ?', [req.user.userId]);

            if (existing) {
                return res.status(400).json({ error: 'Store already configured' });
            }

            await dbRun(
                `INSERT INTO store_config (user_id, monero_address, encrypted_view_key, auto_verify, store_name, store_bio)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.userId, monero_address, encrypted_view_key || null, encrypted_view_key ? 1 : 0, store_name || null, store_bio || null]
            );

            console.log(`[STORE] User ${req.user.username} setup store`);
            res.json({ success: true, message: 'Store configured' });
        } catch (err) {
            console.error('[STORE_SETUP] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Update store configuration (branding)
 */
function addStoreConfigEndpoint(app, authenticateToken, dbRun, dbGet) {
    app.put('/api/store/config', authenticateToken, async (req, res) => {
        try {
            const { store_name, store_bio, store_banner, monero_address, store_pgp_public_key, payment_addresses, marketplace_optin } = req.body;

            // Verify store exists
            const store = await dbGet('SELECT user_id FROM store_config WHERE user_id = ?', [req.user.userId]);

            if (!store) {
                return res.status(404).json({ error: 'Store not configured' });
            }

            // validate the payment address only when the seller is changing it
            const changingAddress = monero_address !== undefined && monero_address !== null && monero_address !== '';
            if (changingAddress && !/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(monero_address)) {
                return res.status(400).json({ error: 'Invalid Monero address format' });
            }

            // store PGP key: undefined = no change, '' = clear (fall back to profile key), value = set
            const changingPgp = store_pgp_public_key !== undefined;
            const clearingPgp = changingPgp && (store_pgp_public_key === null || store_pgp_public_key.trim() === '');
            let pgpToStore = null;
            if (changingPgp && !clearingPgp) {
                const trimmed = String(store_pgp_public_key).trim();
                if (!/^-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+-----END PGP PUBLIC KEY BLOCK-----\s*$/m.test(trimmed)) {
                    return res.status(400).json({ error: 'Invalid PGP public key format (must be ASCII-armored)' });
                }
                // structural validation via openpgp if available
                try {
                    const openpgp = require('openpgp');
                    await openpgp.readKey({ armoredKey: trimmed });
                } catch (e) {
                    return res.status(400).json({ error: 'PGP key could not be parsed: ' + e.message });
                }
                pgpToStore = trimmed;
            }

            // 3E: payment_addresses — map of {CURRENCY: address}. Validate format per chain.
            const ADDR_FORMATS = {
                BTC:  /^(bc1[02-9ac-hj-np-z]{6,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
                LTC:  /^(ltc1[02-9ac-hj-np-z]{6,87}|[LM][1-9A-HJ-NP-Za-km-z]{25,34}|[3][1-9A-HJ-NP-Za-km-z]{25,34})$/,
                ETH:  /^0x[a-fA-F0-9]{40}$/,
                BCH:  /^(bitcoincash:)?(q|p)[0-9a-z]{41}$/i,
                SOL:  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
                DOGE: /^D[1-9A-HJ-NP-Za-km-z]{32,34}$/,
            };
            let paymentAddressesJson;
            const changingPaymentAddrs = payment_addresses !== undefined;
            if (changingPaymentAddrs) {
                if (payment_addresses === null) {
                    paymentAddressesJson = null;
                } else {
                    if (typeof payment_addresses !== 'object' || Array.isArray(payment_addresses)) {
                        return res.status(400).json({ error: 'payment_addresses must be an object {CURRENCY: address}' });
                    }
                    const cleaned = {};
                    for (const [k, v] of Object.entries(payment_addresses)) {
                        const code = String(k).toUpperCase();
                        if (!ADDR_FORMATS[code]) {
                            return res.status(400).json({ error: `Unsupported currency: ${code}` });
                        }
                        if (typeof v !== 'string' || !v.trim()) continue; // skip empty entries
                        const addr = v.trim();
                        if (!ADDR_FORMATS[code].test(addr)) {
                            return res.status(400).json({ error: `Invalid ${code} address format` });
                        }
                        cleaned[code] = addr;
                    }
                    paymentAddressesJson = Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
                }
            }

            // COALESCE keeps the existing value when a field is not provided.
            // For store_pgp_public_key we use a CASE so that an explicit clear ('') wipes the column.
            await dbRun(
                `UPDATE store_config
                 SET store_name = COALESCE(?, store_name),
                     store_bio = COALESCE(?, store_bio),
                     store_banner = COALESCE(?, store_banner),
                     monero_address = COALESCE(?, monero_address),
                     store_pgp_public_key = CASE
                         WHEN ? = 1 THEN NULL
                         WHEN ? IS NOT NULL THEN ?
                         ELSE store_pgp_public_key
                     END,
                     payment_addresses = CASE WHEN ? = 1 THEN ? ELSE payment_addresses END,
                     marketplace_optin = COALESCE(?, marketplace_optin),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [
                    store_name ?? null,
                    store_bio ?? null,
                    store_banner ?? null,
                    changingAddress ? monero_address : null,
                    clearingPgp ? 1 : 0,
                    pgpToStore,
                    pgpToStore,
                    changingPaymentAddrs ? 1 : 0,
                    paymentAddressesJson,
                    marketplace_optin === undefined ? null : (marketplace_optin ? 1 : 0),
                    req.user.userId
                ]
            );

            res.json({ success: true, message: 'Store updated' });
        } catch (err) {
            console.error('[STORE_CONFIG] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get store configuration (public, for checkout)
 * Returns encrypted wallet that buyer will decrypt client-side
 */
function addGetStoreConfigEndpoint(app, dbGet, dbAll) {
    app.get('/api/store/config/:username', async (req, res) => {
        try {
            const { username } = req.params;

            const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const store = await dbGet(
                `SELECT s.monero_address, s.auto_verify, s.store_name, s.store_bio, s.store_banner, s.is_verified, s.store_pgp_public_key, s.payment_addresses, s.marketplace_optin, u.design_config, u.pgp_public_key
                 FROM store_config s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.user_id = ?`,
                [user.id]
            );

            if (!store) {
                return res.status(404).json({ error: 'Store not configured' });
            }

            // Get store stats
            const products = await dbAll(
                'SELECT COUNT(*) as count FROM store_products WHERE user_id = ? AND is_active = 1',
                [user.id]
            );

            const completedOrders = await dbAll(
                'SELECT COUNT(*) as count FROM store_orders WHERE seller_id = ? AND status IN ("paid", "complete")',
                [user.id]
            );

            // Effective key for encryption: store key if set, else profile key.
            // Public PGP keys are safe to expose — they're for buyers to encrypt to the seller.
            const effective_pgp = store.store_pgp_public_key || store.pgp_public_key || null;
            // 3E: parse the JSON map of accepted non-XMR addresses (safe to expose — they're addresses, not keys)
            let paymentAddresses = {};
            try { if (store.payment_addresses) paymentAddresses = JSON.parse(store.payment_addresses) || {}; } catch {}
            res.json({
                monero_address: store.monero_address,
                auto_verify: !!store.auto_verify,
                store_name: store.store_name,
                store_bio: store.store_bio,
                store_banner: store.store_banner,
                is_verified: store.is_verified,
                has_pgp: !!effective_pgp,
                has_store_pgp: !!store.store_pgp_public_key,
                pgp_public_key: effective_pgp,
                store_pgp_public_key: store.store_pgp_public_key || null,
                payment_addresses: paymentAddresses,
                accepted_currencies: ['XMR', ...Object.keys(paymentAddresses)],
                marketplace_optin: !!store.marketplace_optin,
                design: store.design_config ? JSON.parse(store.design_config) : null,
                stats: {
                    products: products[0]?.count || 0,
                    sales: completedOrders[0]?.count || 0
                }
            });
        } catch (err) {
            console.error('[GET_STORE_CONFIG] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Create product
 */
function addCreateProductEndpoint(app, authenticateToken, dbRun, dbGet) {
    app.post('/api/store/products', authenticateToken, async (req, res) => {
        try {
            const {
                product_type,
                encrypted_data,
                thumbnail_url,
                category,
                price_xmr,
                stock,
                name,
                description,
                digital_content,
                buyer_form_fields
            } = req.body;

            // buyer_form_fields: optional JSON array describing what info the buyer must
            // submit at checkout. Server stores as a string; never reads contents of the
            // buyer's submitted values (they arrive PGP-encrypted in order.encrypted_data).
            let buyerFormJson = null;
            if (buyer_form_fields !== undefined && buyer_form_fields !== null) {
                if (!Array.isArray(buyer_form_fields)) {
                    return res.status(400).json({ error: 'buyer_form_fields must be an array' });
                }
                if (buyer_form_fields.length > 20) {
                    return res.status(400).json({ error: 'buyer_form_fields max 20 entries' });
                }
                for (const f of buyer_form_fields) {
                    if (!f || typeof f.key !== 'string' || typeof f.label !== 'string') {
                        return res.status(400).json({ error: 'Each form field needs string key and label' });
                    }
                    if (!['text', 'textarea', 'email'].includes(f.type)) {
                        return res.status(400).json({ error: 'Field type must be text|textarea|email' });
                    }
                }
                buyerFormJson = JSON.stringify(buyer_form_fields);
            }

            // Validation
            if (!['physical', 'digital', 'service'].includes(product_type)) {
                return res.status(400).json({ error: 'Invalid product type' });
            }

            // encrypted_data is optional: sellers can publish products without the extra
            // password-encrypted privacy layer. Plaintext name/description/thumbnail still
            // identify the product publicly; the encrypted blob just adds richer hidden
            // content for buyers who go through checkout. price_xmr remains mandatory.
            if (!price_xmr) {
                return res.status(400).json({ error: 'Price is required' });
            }
            if (!name || !String(name).trim()) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (typeof price_xmr !== 'number' || isNaN(price_xmr) || price_xmr <= 0) {
                return res.status(400).json({ error: 'Price must be a positive number' });
            }

            if (stock !== undefined && stock !== null) {
                const stockNum = parseInt(stock);
                if (isNaN(stockNum) || (stockNum < -1)) {
                    return res.status(400).json({ error: 'Stock must be -1 (unlimited) or >= 0' });
                }
            }

            // Verify store exists
            const store = await dbGet('SELECT user_id FROM store_config WHERE user_id = ?', [req.user.userId]);

            if (!store) {
                return res.status(400).json({ error: 'Store not configured. Setup your store first.' });
            }

            const visibility = ['pgp_only', 'unlisted'].includes(req.body.visibility) ? req.body.visibility : 'public';

            // 3C: optional access PIN — bcrypt-hashed, never stored in plaintext.
            // Required for visibility='unlisted'; refused for non-unlisted (would be misleading).
            let accessCodeHash = null;
            const rawPin = typeof req.body.access_code === 'string' ? req.body.access_code.trim() : '';
            if (rawPin) {
                if (visibility !== 'unlisted') {
                    return res.status(400).json({ error: 'access_code only applies to unlisted products' });
                }
                if (rawPin.length < 4 || rawPin.length > 128) {
                    return res.status(400).json({ error: 'access_code must be 4–128 chars' });
                }
                accessCodeHash = await bcrypt.hash(rawPin, 12);
            }

            // Create product
            const result = await dbRun(
                `INSERT INTO store_products
                 (user_id, product_type, encrypted_data, name, description, thumbnail_url, category, price_xmr, stock, visibility, buyer_form_fields, access_code_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                // encrypted_data column is NOT NULL in the schema, so coerce to '' when the
                // seller skipped encryption — keeps existing DB migrations untouched.
                [req.user.userId, product_type, encrypted_data || '', name, description, thumbnail_url, category, price_xmr, stock || -1, visibility, buyerFormJson, accessCodeHash]
            );

            const productId = result.lastID;

            // If digital product, add content
            if (product_type === 'digital' && digital_content && Array.isArray(digital_content)) {
                for (const content of digital_content) {
                    await dbRun(
                        `INSERT INTO store_digital_content 
                         (product_id, content_type, encrypted_content, file_name, file_size, download_limit) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            productId,
                            content.content_type,
                            content.encrypted_content,
                            content.file_name || null,
                            content.file_size || null,
                            content.download_limit || -1
                        ]
                    );
                }
            }

            console.log(`[STORE] User ${req.user.username} created product #${productId}`);
            res.json({ success: true, product_id: productId });
        } catch (err) {
            console.error('[CREATE_PRODUCT] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * List products by username (public)
 */
function addListProductsEndpoint(app, dbGet, dbAll) {
    app.get('/api/store/products/:username', async (req, res) => {
        try {
            const { username } = req.params;
            const { category, active_only, search, product_type } = req.query;
            // 3D: pagination — clamp to reasonable bounds
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 60);
            const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

            const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // 3C: if the requester is the store owner (valid token, matching userId), include
            // unlisted + pgp_only products. Public visitors only see 'public'/NULL.
            let isOwner = false;
            const authHeader = req.headers.authorization || '';
            if (authHeader.startsWith('Bearer ')) {
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                    isOwner = decoded.userId === user.id;
                } catch { /* invalid/expired token — treat as public visitor */ }
            }

            // Build WHERE clause once so we can run COUNT + page queries against the same predicate
            let where = 'WHERE p.user_id = ?';
            const params = [user.id];

            if (category) {
                where += ' AND p.category = ?';
                params.push(category);
            }
            // 3D: optional filter by product type (physical | digital | service)
            if (product_type && ['physical', 'digital', 'service'].includes(product_type)) {
                where += ' AND p.product_type = ?';
                params.push(product_type);
            }
            // 3D: simple LIKE search on name / description
            if (search && typeof search === 'string' && search.trim()) {
                const term = `%${search.trim().replace(/[%_]/g, m => '\\' + m)}%`;
                where += " AND (p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')";
                params.push(term, term);
            }
            if (active_only !== 'false') {
                where += ' AND p.is_active = 1';
            }
            if (!isOwner) {
                where += " AND (p.visibility = 'public' OR p.visibility IS NULL)";
            }

            // 3D: count first so the UI can render "Showing X of Y" + page nav
            const countRow = await dbGet(`SELECT COUNT(*) as total FROM store_products p ${where}`, params);
            const total = countRow?.total || 0;

            const products = await dbAll(
                `SELECT p.*,
                        (SELECT AVG(rating) FROM store_reviews WHERE product_id = p.id) as avg_rating
                 FROM store_products p
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // Never leak access_code_hash even to the owner — it's only used server-side.
            // Expose a boolean so the owner UI can show "PIN set" without the hash.
            for (const p of products) {
                p.has_access_code = !!p.access_code_hash;
                delete p.access_code_hash;
            }

            res.json({ products, total, limit, offset, has_more: offset + products.length < total });
        } catch (err) {
            console.error('[LIST_PRODUCTS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get single product with digital content
 */
function addGetProductEndpoint(app, dbGet, dbAll, dbRun) {
    app.get('/api/store/products/id/:productId', async (req, res) => {
        try {
            const { productId } = req.params;

            const product = await dbGet(
                'SELECT * FROM store_products WHERE id = ?',
                [productId]
            );

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // 3C: gate unlisted products behind a valid unlock token issued by /unlock,
            // OR the owner's auth token (so the seller can preview/edit without re-entering the PIN).
            if (product.visibility === 'unlisted') {
                let allowed = false;
                const authHeader = req.headers.authorization || '';
                if (authHeader.startsWith('Bearer ')) {
                    try {
                        const jwt = require('jsonwebtoken');
                        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                        if (decoded.userId === product.user_id) allowed = true;
                    } catch { /* fall through */ }
                }
                const unlockToken = req.headers['x-unlock-token'] || req.query.unlock_token;
                if (!allowed && unlockToken && verifyUnlockToken(unlockToken, productId)) {
                    allowed = true;
                }
                if (!allowed) {
                    return res.status(403).json({ error: 'Access code required', requires_unlock: true });
                }
            }

            // Increment views
            await dbRun('UPDATE store_products SET views = views + 1 WHERE id = ?', [productId]);

            // Get digital content if digital product
            let digitalContent = [];
            if (product.product_type === 'digital') {
                digitalContent = await dbAll(
                    'SELECT id, content_type, file_name, file_size, download_limit FROM store_digital_content WHERE product_id = ? AND is_active = 1',
                    [productId]
                );
            }

            // never leak the hash
            delete product.access_code_hash;

            res.json({
                product,
                digital_content: digitalContent
            });
        } catch (err) {
            console.error('[GET_PRODUCT] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * 3C: Unlock an unlisted product by PIN. Rate-limited per (ip_hash, product) pair.
 *
 * Rules:
 *  - 5 failed attempts in 15 minutes triggers a 1-hour lockout.
 *  - On success the counter resets and an HMAC-signed unlock token (1h) is returned.
 *  - bcrypt.compare is constant-time vs the stored hash; no plaintext PIN is ever stored.
 */
function addUnlockProductEndpoint(app, dbGet, dbRun) {
    app.post('/api/store/products/:productId/unlock', async (req, res) => {
        try {
            const { productId } = req.params;
            const { pin } = req.body || {};
            if (typeof pin !== 'string' || !pin) {
                return res.status(400).json({ error: 'pin required' });
            }
            const product = await dbGet('SELECT id, visibility, access_code_hash FROM store_products WHERE id = ? AND is_active = 1', [productId]);
            if (!product || product.visibility !== 'unlisted' || !product.access_code_hash) {
                // generic 404 to avoid revealing whether the product exists or is unlisted
                return res.status(404).json({ error: 'Not found' });
            }

            const ip = hashIp(req);
            const row = await dbGet('SELECT attempt_count, locked_until, last_attempt FROM store_unlock_attempts WHERE ip_hash = ? AND product_id = ?', [ip, productId]);

            const now = Date.now();
            if (row && row.locked_until && new Date(row.locked_until).getTime() > now) {
                const retryAfter = Math.ceil((new Date(row.locked_until).getTime() - now) / 1000);
                return res.status(429).json({ error: 'Locked. Try again later.', retry_after: retryAfter });
            }

            // Reset window: if last_attempt was >15min ago, start fresh
            let attempts = row?.attempt_count || 0;
            if (row && row.last_attempt && (now - new Date(row.last_attempt).getTime() > 15 * 60 * 1000)) {
                attempts = 0;
            }

            const ok = await bcrypt.compare(pin, product.access_code_hash);
            if (!ok) {
                attempts += 1;
                const shouldLock = attempts >= 5;
                const lockedUntil = shouldLock ? new Date(now + 60 * 60 * 1000).toISOString() : null;
                await dbRun(
                    `INSERT INTO store_unlock_attempts (ip_hash, product_id, attempt_count, locked_until, last_attempt)
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(ip_hash, product_id) DO UPDATE
                     SET attempt_count = excluded.attempt_count,
                         locked_until = excluded.locked_until,
                         last_attempt = excluded.last_attempt`,
                    [ip, productId, attempts, lockedUntil]
                );
                if (shouldLock) {
                    return res.status(429).json({ error: 'Too many attempts. Locked for 1 hour.', retry_after: 3600 });
                }
                return res.status(401).json({ error: 'Wrong code', attempts_remaining: 5 - attempts });
            }

            // Success — reset counter and issue token
            await dbRun(
                `INSERT INTO store_unlock_attempts (ip_hash, product_id, attempt_count, locked_until, last_attempt)
                 VALUES (?, ?, 0, NULL, CURRENT_TIMESTAMP)
                 ON CONFLICT(ip_hash, product_id) DO UPDATE
                 SET attempt_count = 0, locked_until = NULL, last_attempt = CURRENT_TIMESTAMP`,
                [ip, productId]
            );
            const token = signUnlockToken(productId);
            res.json({ unlock_token: token, expires_in: 3600 });
        } catch (err) {
            console.error('[UNLOCK_PRODUCT] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Update product
 */
function addUpdateProductEndpoint(app, authenticateToken, dbRun, dbGet) {
    app.put('/api/store/products/:productId', authenticateToken, async (req, res) => {
        try {
            const { productId } = req.params;
            const { encrypted_data, name, description, thumbnail_url, category, price_xmr, stock, is_active, buyer_form_fields, visibility, access_code } = req.body;

            // Verify ownership
            const product = await dbGet('SELECT user_id FROM store_products WHERE id = ?', [productId]);

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (product.user_id !== req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // buyer_form_fields: undefined = leave alone; null = clear; array = validate & set
            let buyerFormJson;
            let changingBuyerForm = buyer_form_fields !== undefined;
            if (changingBuyerForm) {
                if (buyer_form_fields === null) {
                    buyerFormJson = null;
                } else {
                    if (!Array.isArray(buyer_form_fields)) {
                        return res.status(400).json({ error: 'buyer_form_fields must be an array or null' });
                    }
                    if (buyer_form_fields.length > 20) {
                        return res.status(400).json({ error: 'buyer_form_fields max 20 entries' });
                    }
                    for (const f of buyer_form_fields) {
                        if (!f || typeof f.key !== 'string' || typeof f.label !== 'string') {
                            return res.status(400).json({ error: 'Each form field needs string key and label' });
                        }
                        if (!['text', 'textarea', 'email'].includes(f.type)) {
                            return res.status(400).json({ error: 'Field type must be text|textarea|email' });
                        }
                    }
                    buyerFormJson = JSON.stringify(buyer_form_fields);
                }
            }

            // visibility: undefined = leave; otherwise must be one of the valid values
            let newVisibility;
            const changingVisibility = visibility !== undefined;
            if (changingVisibility) {
                if (!['public', 'pgp_only', 'unlisted'].includes(visibility)) {
                    return res.status(400).json({ error: 'visibility must be public|pgp_only|unlisted' });
                }
                newVisibility = visibility;
            }

            // access_code: undefined = leave; null/'' = clear; non-empty = bcrypt-hash & store
            let accessCodeHash;
            let changingAccessCode = access_code !== undefined;
            if (changingAccessCode) {
                if (access_code === null || access_code === '') {
                    accessCodeHash = null;
                } else {
                    if (typeof access_code !== 'string' || access_code.length < 4 || access_code.length > 128) {
                        return res.status(400).json({ error: 'access_code must be 4–128 chars' });
                    }
                    accessCodeHash = await bcrypt.hash(access_code, 12);
                }
            }

            await dbRun(
                `UPDATE store_products
                 SET encrypted_data = COALESCE(?, encrypted_data),
                     name = COALESCE(?, name),
                     description = COALESCE(?, description),
                     thumbnail_url = COALESCE(?, thumbnail_url),
                     category = COALESCE(?, category),
                     price_xmr = COALESCE(?, price_xmr),
                     stock = COALESCE(?, stock),
                     is_active = COALESCE(?, is_active),
                     buyer_form_fields = CASE WHEN ? = 1 THEN ? ELSE buyer_form_fields END,
                     visibility = CASE WHEN ? = 1 THEN ? ELSE visibility END,
                     access_code_hash = CASE WHEN ? = 1 THEN ? ELSE access_code_hash END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [encrypted_data, name, description, thumbnail_url, category, price_xmr, stock, is_active,
                 changingBuyerForm ? 1 : 0, buyerFormJson,
                 changingVisibility ? 1 : 0, newVisibility,
                 changingAccessCode ? 1 : 0, accessCodeHash,
                 productId]
            );

            res.json({ success: true });
        } catch (err) {
            console.error('[UPDATE_PRODUCT] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Delete product
 */
function addDeleteProductEndpoint(app, authenticateToken, dbRun, dbGet) {
    app.delete('/api/store/products/:productId', authenticateToken, async (req, res) => {
        try {
            const { productId } = req.params;

            // Verify ownership
            const product = await dbGet('SELECT user_id FROM store_products WHERE id = ?', [productId]);

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (product.user_id !== req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // Soft delete
            await dbRun('UPDATE store_products SET is_active = 0 WHERE id = ?', [productId]);

            res.json({ success: true });
        } catch (err) {
            console.error('[DELETE_PRODUCT] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Create order
 */
function addCreateOrderEndpoint(app, dbRun, dbGet, moneroMonitor, mailer) {
    app.post('/api/store/orders', async (req, res) => {
        try {
            const {
                product_id,
                encrypted_data,
                buyer_username
            } = req.body;

            if (!product_id) {
                return res.status(400).json({ error: 'Missing product_id' });
            }

            // Cap the encrypted payload at 64KB — PGP-encrypted buyer form, not user uploads
            if (encrypted_data && typeof encrypted_data === 'string' && encrypted_data.length > 65536) {
                return res.status(413).json({ error: 'Encrypted payload too large (max 64KB)' });
            }

            // Get product
            const product = await dbGet('SELECT * FROM store_products WHERE id = ? AND is_active = 1', [product_id]);

            if (!product) {
                return res.status(404).json({ error: 'Product not found or unavailable' });
            }

            // 3C: unlisted products require a valid unlock token to be ordered
            if (product.visibility === 'unlisted') {
                const unlockToken = req.headers['x-unlock-token'] || req.body.unlock_token;
                if (!unlockToken || !verifyUnlockToken(unlockToken, String(product_id))) {
                    return res.status(403).json({ error: 'Access code required', requires_unlock: true });
                }
            }

            // Check stock
            if (product.stock === 0) {
                return res.status(400).json({ error: 'Product out of stock' });
            }

            // Get seller's store config for payment address
            const storeConfig = await dbGet('SELECT monero_address, auto_verify FROM store_config WHERE user_id = ?', [product.user_id]);
            if (!storeConfig || !storeConfig.monero_address) {
                return res.status(400).json({ error: 'Seller store not properly configured' });
            }

            // Get buyer ID if authenticated
            let buyerId = null;
            if (buyer_username) {
                const buyer = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [buyer_username]);
                buyerId = buyer?.id;
            }

            // Generate order code
            const orderCode = 'ORD-' + crypto.randomBytes(6).toString('hex').toUpperCase();

            // Determine payment address
            let paymentAddress = storeConfig.monero_address;

            // Create order
            const result = await dbRun(
                `INSERT INTO store_orders
                 (order_code, product_id, buyer_id, seller_id, encrypted_data, payment_address, price_xmr, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderCode, product_id, buyerId, product.user_id, encrypted_data || '{}', paymentAddress, product.price_xmr, 'pending']
            );

            // If seller has auto_verify and moneroMonitor is available, try to generate a subaddress
            if (storeConfig.auto_verify && moneroMonitor && moneroMonitor.getOrCreateOrderSubaddress) {
                try {
                    const subaddress = await moneroMonitor.getOrCreateOrderSubaddress(result.lastID, product.user_id);
                    if (subaddress) {
                        paymentAddress = subaddress;
                        await dbRun('UPDATE store_orders SET payment_address = ? WHERE id = ?', [subaddress, result.lastID]);
                    }
                } catch (e) {
                    console.error('[STORE] Auto-verify subaddress generation failed, using direct address:', e.message);
                }
            }

            // NOTE: Stock decrement happens when payment is confirmed via updateOrderStatus

            console.log(`[STORE] Order ${orderCode} created for product #${product_id}`);
            // Notify seller via email
            if (mailer) {
                const buyerLine = buyer_username ? `@${buyer_username}` : 'Anonymous buyer';
                const typeLabel = (product.product_type || 'product').toUpperCase();
                const body = [
                    `You received a new order on your GOXMR store.`,
                    ``,
                    `  Order:    ${orderCode}`,
                    `  Product:  ${product.name} (${typeLabel})`,
                    `  Amount:   ${product.price_xmr} XMR`,
                    `  Buyer:    ${buyerLine}`,
                    ``,
                    `The buyer has 48 hours to send payment. You'll get another notification when they submit proof of payment.`,
                    ``,
                    `Manage this order from your dashboard:`,
                    `https://goxmr.click/dashboard#store`
                ].join('\n');
                mailer.sendNotification(product.user_id, `New order ${orderCode} — ${product.price_xmr} XMR`, body, { useStoreKey: true });
            }
            res.json({
                success: true,
                order_id: result.lastID,
                order_code: orderCode,
                payment_address: paymentAddress,
                price_xmr: product.price_xmr
            });
        } catch (err) {
            console.error('[CREATE_ORDER] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get my orders (buyer or seller view)
 */
function addGetMyOrdersEndpoint(app, authenticateToken, dbAll) {
    app.get('/api/store/orders/mine', authenticateToken, async (req, res) => {
        try {
            const { view } = req.query; // 'buyer' or 'seller'

            let orders;
            if (view === 'seller') {
                orders = await dbAll(
                    `SELECT o.*, p.thumbnail_url, p.product_type, u.username as buyer_username
                     FROM store_orders o
                     LEFT JOIN store_products p ON o.product_id = p.id
                     LEFT JOIN users u ON o.buyer_id = u.id
                     WHERE o.seller_id = ?
                     ORDER BY o.created_at DESC`,
                    [req.user.userId]
                );
            } else {
                orders = await dbAll(
                    `SELECT o.*, p.thumbnail_url, p.product_type, u.username as seller_username
                     FROM store_orders o
                     LEFT JOIN store_products p ON o.product_id = p.id
                     LEFT JOIN users u ON p.user_id = u.id
                     WHERE o.buyer_id = ?
                     ORDER BY o.created_at DESC`,
                    [req.user.userId]
                );

                // For buyer view, include digital content IDs if product is digital
                for (let order of orders) {
                    if (order.product_type === 'digital') {
                        order.digital_content = await dbAll(
                            'SELECT id, file_name, content_type FROM store_digital_content WHERE product_id = ? AND is_active = 1',
                            [order.product_id]
                        );
                    }
                }
            }

            res.json({ orders });
        } catch (err) {
            console.error('[GET_MY_ORDERS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Update order status (seller only)
 */
function addUpdateOrderStatusEndpoint(app, authenticateToken, dbRun, dbGet, mailer) {
    app.put('/api/store/orders/:orderId/status', authenticateToken, async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status, seller_notes } = req.body;

            const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'complete', 'cancelled', 'refunded'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Verify seller owns this order
            const order = await dbGet('SELECT seller_id, buyer_id, product_id, status as current_status, encrypted_data FROM store_orders WHERE id = ?', [orderId]);

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            if (order.seller_id !== req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // If updating status or adding seller notes, update encrypted_data
            let updateQuery = 'UPDATE store_orders SET status = ?, updated_at = CURRENT_TIMESTAMP';
            let params = [status];

            if (req.body.encrypted_data) {
                updateQuery += ', encrypted_data = ?';
                params.push(req.body.encrypted_data);
            }

            if (status === 'complete') {
                updateQuery += ', completed_at = CURRENT_TIMESTAMP';
            }

            updateQuery += ' WHERE id = ?';
            params.push(orderId);

            await dbRun(updateQuery, params);

            // Decrement stock and increment sales only when transitioning to 'paid' for the first time
            // Atomic: WHERE stock > 0 prevents overselling even under concurrent requests
            if (status === 'paid' && order.current_status === 'pending') {
                const decremented = await dbRun(
                    'UPDATE store_products SET stock = stock - 1, sales = sales + 1 WHERE id = ? AND stock > 0',
                    [order.product_id]
                );
                // If stock was -1 (unlimited) or already 0, just increment sales
                if (!decremented || decremented.changes === 0) {
                    await dbRun(
                        'UPDATE store_products SET sales = sales + 1 WHERE id = ? AND (stock = -1 OR stock <= 0)',
                        [order.product_id]
                    );
                }
            }

            res.json({ success: true });

            // Notify buyer of status change (if buyer is a registered user)
            if (mailer && order.buyer_id) {
                mailer.sendNotification(order.buyer_id, `Order Status Update - GOXMR`,
                    `Your order has been updated to: ${status.toUpperCase()}\n\nTrack your order at:\nhttps://goxmr.click/dashboard`);
            }
        } catch (err) {
            console.error('[UPDATE_ORDER_STATUS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Download digital content (buyer only, with download limit check)
 */
function addDownloadDigitalContentEndpoint(app, dbGet, dbRun, dbAll) {
    app.post('/api/store/download/:orderId/:contentId', async (req, res) => {
        try {
            const { orderId, contentId } = req.params;

            // Verify order exists and is paid
            const order = await dbGet(
                'SELECT id, product_id, status FROM store_orders WHERE id = ? AND status IN ("paid", "processing", "shipped", "delivered", "complete")',
                [orderId]
            );

            if (!order) {
                return res.status(404).json({ error: 'Order not found or not paid' });
            }

            // Get digital content AND verify it belongs to the order's product
            const content = await dbGet(
                'SELECT * FROM store_digital_content WHERE id = ? AND product_id = ?',
                [contentId, order.product_id]
            );

            if (!content) {
                return res.status(404).json({ error: 'Content not found' });
            }

            // Check download limit
            if (content.download_limit > 0) {
                const downloads = await dbAll(
                    'SELECT COUNT(*) as count FROM store_downloads WHERE order_id = ? AND content_id = ?',
                    [orderId, contentId]
                );

                const downloadCount = downloads[0]?.count || 0;

                if (downloadCount >= content.download_limit) {
                    return res.status(403).json({ error: 'Download limit reached' });
                }
            }

            // Record download
            // Persisted IP hash: HMAC keeps it unreversible if the DB ever leaks.
            const ipHash = hmacIp(req);
            await dbRun(
                'INSERT INTO store_downloads (order_id, content_id, ip_hash) VALUES (?, ?, ?)',
                [orderId, contentId, ipHash]
            );

            // Update usage count
            await dbRun(
                'UPDATE store_digital_content SET downloads_used = downloads_used + 1 WHERE id = ?',
                [contentId]
            );

            // Return encrypted content (buyer will decrypt client-side)
            res.json({
                success: true,
                encrypted_content: content.encrypted_content,
                file_name: content.file_name
            });
        } catch (err) {
            console.error('[DOWNLOAD_DIGITAL] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Create review (proof-of-purchase required)
 */
function addCreateReviewEndpoint(app, authenticateToken, dbRun, dbGet) {
    // #4.3: reviews are gated by order_code (random, unguessable) — proof of purchase without
    // requiring an account. If the buyer was also logged in, we tie buyer_id for the badge.
    // Any state in {paid, processing, shipped, delivered, complete} qualifies — waiting for
    // 'complete' was too strict (sellers rarely mark physical orders complete).
    app.post('/api/store/reviews', async (req, res) => {
        try {
            const { order_code, rating, review_text } = req.body;
            if (!order_code || typeof rating !== 'number') {
                return res.status(400).json({ error: 'order_code and rating are required' });
            }
            const r = Math.round(rating);
            if (r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
            if (review_text && typeof review_text !== 'string') {
                return res.status(400).json({ error: 'review_text must be a string' });
            }
            if (review_text && review_text.length > 2000) {
                return res.status(400).json({ error: 'Review max 2000 chars' });
            }

            const order = await dbGet(
                'SELECT id, product_id, buyer_id, status FROM store_orders WHERE order_code = ?',
                [order_code]
            );
            if (!order) return res.status(404).json({ error: 'Order not found' });

            const REVIEWABLE = ['paid', 'processing', 'shipped', 'delivered', 'complete'];
            if (!REVIEWABLE.includes(order.status)) {
                return res.status(400).json({ error: 'Order is not paid yet' });
            }

            const existing = await dbGet('SELECT id FROM store_reviews WHERE order_id = ?', [order.id]);
            if (existing) return res.status(400).json({ error: 'Already reviewed' });

            // If the request happens to carry an auth header, tie the review to the buyer
            // identity (gives the verified-purchase badge). Otherwise the review is anon-gated.
            let buyerId = null;
            const auth = req.headers.authorization || '';
            if (auth.startsWith('Bearer ')) {
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
                    buyerId = decoded.userId;
                } catch { /* ignore — treat as anon */ }
            }

            await dbRun(
                'INSERT INTO store_reviews (product_id, order_id, buyer_id, rating, encrypted_review) VALUES (?, ?, ?, ?, ?)',
                [order.product_id, order.id, buyerId, r, review_text || null]
            );

            res.json({ success: true });
        } catch (err) {
            console.error('[CREATE_REVIEW] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get product reviews
 */
function addGetReviewsEndpoint(app, dbAll) {
    app.get('/api/store/reviews/:productId', async (req, res) => {
        try {
            const { productId } = req.params;

            const rows = await dbAll(
                `SELECT r.rating, r.encrypted_review, r.created_at, r.is_verified, u.username
                 FROM store_reviews r
                 LEFT JOIN users u ON r.buyer_id = u.id
                 WHERE r.product_id = ?
                 ORDER BY r.created_at DESC`,
                [productId]
            );
            // Reshape — column is named encrypted_review for legacy reasons, the value is plain text.
            // Strip buyer username on anon reviews so the response shape stays stable.
            const reviews = rows.map(r => ({
                rating: r.rating,
                text: r.encrypted_review || '',
                created_at: r.created_at,
                verified_purchase: !!r.is_verified,
                buyer: r.username || null,
            }));
            const avgRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            res.json({ reviews, average_rating: avgRating, total_reviews: reviews.length });
        } catch (err) {
            console.error('[GET_REVIEWS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get store notifications for seller (pending/unpaid order counts)
 */
function addStoreNotificationsEndpoint(app, authenticateToken, dbAll) {
    app.get('/api/store/notifications', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;

            // Get pending and paid (not yet complete) orders
            const orders = await dbAll(
                'SELECT status, COUNT(*) as count FROM store_orders WHERE seller_id = ? AND status IN ("pending", "paid") GROUP BY status',
                [userId]
            );

            const counts = {
                pending: 0,
                paid: 0,
                total: 0
            };

            orders.forEach(row => {
                if (row.status === 'pending') counts.pending = row.count;
                if (row.status === 'paid') counts.paid = row.count;
            });

            counts.total = counts.pending + counts.paid;

            res.json(counts);
        } catch (err) {
            console.error('[STORE_NOTIFICATIONS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Get global store listings (latest products and active stores)
 */
function addGlobalListingsEndpoint(app, dbAll) {
    app.get('/api/store/listings', async (req, res) => {
        try {
            // Get latest active products
            const products = await dbAll(`
                SELECT p.*, s.store_name, u.username
                FROM store_products p
                JOIN store_config s ON p.user_id = s.user_id
                JOIN users u ON s.user_id = u.id
                WHERE p.is_active = 1 AND (p.visibility = 'public' OR p.visibility IS NULL)
                ORDER BY p.created_at DESC
                LIMIT 50
            `);

            // Get active stores (those with at least one active product)
            const stores = await dbAll(`
                SELECT s.store_name, s.store_bio, s.store_banner, u.username,
                       (SELECT COUNT(*) FROM store_products WHERE user_id = s.user_id AND is_active = 1) as product_count
                FROM store_config s
                JOIN users u ON s.user_id = u.id
                WHERE EXISTS (SELECT 1 FROM store_products WHERE user_id = s.user_id AND is_active = 1)
                ORDER BY s.updated_at DESC
                LIMIT 20
            `);

            res.json({ products, stores });
        } catch (err) {
            console.error('[GLOBAL_LISTINGS] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * #4.4: Marketplace — only stores that explicitly opted-in show up.
 * Sortable, paginated. Returns store-level info + a couple of preview products per store.
 */
function addMarketEndpoint(app, dbAll) {
    app.get('/api/store/market', async (req, res) => {
        try {
            const sort = ['recent', 'sales', 'rating'].includes(req.query.sort) ? req.query.sort : 'recent';
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 60);
            const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

            const orderBy = sort === 'sales'  ? 's.updated_at DESC' // proxy until we add real sales count to store_config
                          : sort === 'rating' ? 'avg_rating DESC NULLS LAST'
                          : 's.updated_at DESC';

            const stores = await dbAll(
                `SELECT u.username, s.store_name, s.store_bio, s.store_banner, s.is_verified,
                        (SELECT COUNT(*) FROM store_products WHERE user_id = u.id AND is_active = 1
                            AND (visibility = 'public' OR visibility IS NULL)) as product_count,
                        (SELECT AVG(r.rating) FROM store_reviews r
                            JOIN store_products p ON r.product_id = p.id
                            WHERE p.user_id = u.id) as avg_rating,
                        (SELECT COUNT(*) FROM store_orders WHERE seller_id = u.id
                            AND status IN ('paid','complete','delivered','shipped','processing')) as sales
                 FROM store_config s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.marketplace_optin = 1
                 ORDER BY ${orderBy}
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );
            // hide empty stores from the discovery feed
            const visible = stores.filter(s => s.product_count > 0);
            res.json({ stores: visible, sort, limit, offset });
        } catch (err) {
            console.error('[MARKET] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Submit payment proof (buyer submits TXID + tx_key)
 */
function addSubmitPaymentProofEndpoint(app, dbRun, dbGet, authLimiter, mailer) {
    app.post('/api/store/orders/:orderId/proof', authLimiter, async (req, res) => {
        try {
            const { orderId } = req.params;
            const { txid, tx_key, order_code } = req.body;

            if (!txid) {
                return res.status(400).json({ error: 'Transaction ID (txid) required' });
            }

            // Find the order - allow by ID or order_code for anonymous buyers
            let order;
            if (order_code) {
                order = await dbGet('SELECT id, seller_id, status FROM store_orders WHERE order_code = ?', [order_code]);
            } else {
                order = await dbGet('SELECT id, seller_id, status FROM store_orders WHERE id = ?', [orderId]);
            }

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            if (order.status !== 'pending') {
                return res.status(400).json({ error: 'Order is no longer pending' });
            }

            // Store proof as JSON
            const proof = JSON.stringify({ txid: txid.trim(), tx_key: tx_key ? tx_key.trim() : null, submitted_at: new Date().toISOString() });
            await dbRun('UPDATE store_orders SET buyer_proof = ?, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [proof, txid.trim(), order.id]);

            console.log(`[STORE] Payment proof submitted for order #${order.id}`);
            // Notify seller
            if (mailer) mailer.sendNotification(order.seller_id, 'Payment Proof Submitted - GOXMR',
                `A buyer submitted payment proof for order #${order.id}.\nTXID: ${txid.trim()}\n\nVerify and confirm in your dashboard.\nhttps://goxmr.click/dashboard`,
                { useStoreKey: true });
            res.json({ success: true, message: 'Payment proof submitted. Seller will verify.' });
        } catch (err) {
            console.error('[SUBMIT_PROOF] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

/**
 * Track order by order_code (public, no auth required)
 */
function addTrackOrderEndpoint(app, dbGet, dbAll) {
    app.get('/api/store/orders/track/:orderCode', async (req, res) => {
        try {
            const { orderCode } = req.params;

            const order = await dbGet(
                `SELECT o.id, o.order_code, o.status, o.payment_address, o.price_xmr, o.buyer_proof, o.created_at, o.updated_at,
                        o.product_id,
                        p.name as product_name, p.product_type, p.thumbnail_url,
                        u.username as seller_username
                 FROM store_orders o
                 LEFT JOIN store_products p ON o.product_id = p.id
                 LEFT JOIN users u ON o.seller_id = u.id
                 WHERE o.order_code = ?`,
                [orderCode]
            );

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // #4.2: surface the digital items so the buyer can fetch them once the order is paid.
            // Metadata only here — the encrypted content blob lives behind POST /download/:order/:content.
            let digital_content = [];
            const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'complete'];
            if (order.product_type === 'digital' && PAID_STATUSES.includes(order.status)) {
                digital_content = await dbAll(
                    'SELECT id, content_type, file_name, file_size, download_limit FROM store_digital_content WHERE product_id = ? AND is_active = 1',
                    [order.product_id]
                );
            }
            // #4.3: flag whether this order has already been reviewed so the UI hides the form
            const existingReview = await dbGet('SELECT id FROM store_reviews WHERE order_id = ?', [order.id]);
            const reviewable = PAID_STATUSES.includes(order.status) && !existingReview;

            res.json({
                order_id: order.id,
                order_code: order.order_code,
                status: order.status,
                payment_address: order.payment_address,
                price_xmr: order.price_xmr,
                has_proof: !!order.buyer_proof,
                product_name: order.product_name,
                product_type: order.product_type,
                thumbnail_url: order.thumbnail_url,
                seller_username: order.seller_username,
                created_at: order.created_at,
                updated_at: order.updated_at,
                digital_content,
                product_id: order.product_id,
                reviewable,
                has_review: !!existingReview
            });
        } catch (err) {
            console.error('[TRACK_ORDER] Error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });
}

// Export all endpoint registration functions
module.exports = {
    addVerifyPasswordEndpoint,
    addStoreSetupEndpoint,
    addStoreConfigEndpoint,
    addGetStoreConfigEndpoint,
    addCreateProductEndpoint,
    addListProductsEndpoint,
    addGetProductEndpoint,
    addUnlockProductEndpoint,
    addUpdateProductEndpoint,
    addDeleteProductEndpoint,
    addCreateOrderEndpoint,
    addGetMyOrdersEndpoint,
    addUpdateOrderStatusEndpoint,
    addDownloadDigitalContentEndpoint,
    addCreateReviewEndpoint,
    addGetReviewsEndpoint,
    addStoreNotificationsEndpoint,
    addGlobalListingsEndpoint,
    addMarketEndpoint,
    addSubmitPaymentProofEndpoint,
    addTrackOrderEndpoint
};
