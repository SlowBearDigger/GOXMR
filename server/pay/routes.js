// GoXMR Pay HTTP routes. Two surfaces:
//   /pay/v1/*       — public REST API for merchants (Bearer API key auth)
//   /pay/admin/*    — merchant dashboard endpoints (JWT auth via cookie or header)
// Plus a public /pay/embed/pay.js bundle and /pay/checkout/:order_id page handler.

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const {
    generateApiKey, hashApiKey, maskApiKey,
    hashPassword, verifyPassword,
    generateWebhookSecret, signWebhook,
    apiKeyAuth,
} = require('./auth');
const { pool: walletPool } = require('./wallet_scanner');
const { nodePool } = require('../monero/nodePool');

const ORDER_TTL_SECONDS = 30 * 60;        // 30 min to pay
const WEBHOOK_MAX_ATTEMPTS = 8;            // ~10 hours with exponential backoff

function newId(prefix = 'ord') {
    return `${prefix}_${crypto.randomBytes(12).toString('base64url')}`;
}

// structural email validator — splits on @ and the final ., no overlapping regex
// classes so there's no polynomial-backtrack risk. mirrors isValidLooseEmail in
// server/index.js; duplicated here to avoid creating a shared utils module just
// for one helper.
function isValidLooseEmailLocal(s) {
    if (typeof s !== 'string') return false;
    if (s.length < 5 || s.length > 254) return false;
    const at = s.indexOf('@');
    if (at <= 0 || at !== s.lastIndexOf('@')) return false;
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot <= 0 || dot >= domain.length - 1) return false;
    return /^[^\s@]+$/.test(local) && /^[^\s@]+$/.test(domain);
}

// validate monero primary address (4… mainnet) and view key (64 hex chars).
// stops obvious garbage at the API boundary instead of letting monero-ts throw later.
function isValidMoneroAddress(a) {
    return typeof a === 'string' && /^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(a);
}
function isValidViewKey(k) {
    return typeof k === 'string' && /^[a-f0-9]{64}$/i.test(k);
}

function mountPayRoutes(app, deps) {
    const { dbGet, dbAll, dbRun, moneroMonitor, logError, JWT_SECRET, redactIp,
            authLimiter, verifyAltcha } = deps;
    const merchantAuth = apiKeyAuth(dbGet);

    // load the embed shim once and pin its SHA-384 so /pay/embed/integrity can
    // hand merchants an SRI value that's provably the hash of the exact bytes we
    // serve at /pay/embed/pay.js. recomputed only on restart (deploy-time).
    const EMBED_PATH = path.join(__dirname, 'embed.js');
    let EMBED_JS = null, EMBED_SRI = null;
    try {
        EMBED_JS = fs.readFileSync(EMBED_PATH);
        EMBED_SRI = 'sha384-' + crypto.createHash('sha384').update(EMBED_JS).digest('base64');
    } catch { /* shim missing → the embed endpoints below degrade gracefully */ }

    // ── KILL SWITCH ────────────────────────────────────────────────────────
    // Phase-1 access control: while PAY_PUBLIC !== '1' the gateway answers 404
    // to everything under /pay/* unless the caller forwards a matching
    // X-Pay-Beta-Token header (set PAY_BETA_TOKEN in env). This lets the
    // server keep the code loaded so beta operators can poke it without
    // exposing it to the world. The SPA pages live under the React Router so
    // /pay/ in a browser still hits index.html — the gate here is the API.
    const payPublic = process.env.PAY_PUBLIC === '1';
    const betaToken = (process.env.PAY_BETA_TOKEN || '').trim();
    const isBetaCaller = (req) => betaToken && req.get('X-Pay-Beta-Token') === betaToken;
    app.use('/pay', (req, res, next) => {
        // GET /pay/embed/pay.js needs to stay reachable for merchants who already
        // dropped the script tag — block the API surface, not the static shim.
        if ((req.path === '/embed/pay.js' || req.path === '/embed/integrity') && req.method === 'GET') return next();
        if (payPublic || isBetaCaller(req)) return next();
        return res.status(404).json({ error: 'Not Found' });
    });

    // ── PUBLIC EMBED (no auth) ──────────────────────────────────────────────
    // GET /pay/embed/pay.js — minified JS shim that data-attribute buttons
    // become payment triggers. Cached aggressively.
    app.get('/pay/embed/pay.js', (req, res) => {
        if (!EMBED_JS) {
            return res.status(503).type('application/javascript').send('// embed not built');
        }
        res.set('Content-Type', 'application/javascript; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.set('X-GoXMR-Pay-Version', '1');
        // SRI on a cross-origin script requires the response to be CORS-eligible
        // so merchants on their own domain can pin it with integrity+crossorigin.
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        // serve the exact bytes EMBED_SRI was computed over (not a fresh disk
        // read) so the pinned hash can never drift from what we actually send.
        res.send(EMBED_JS);
    });

    // GET /pay/embed/integrity — SRI digest of the bytes above + a paste-ready
    // <script> tag. public + CORS so a merchant can pin the shim without an
    // account. a legacy snippet without integrity still works; it's just not
    // tamper-evident.
    app.get('/pay/embed/integrity', (req, res) => {
        if (!EMBED_SRI) return res.status(503).json({ error: 'embed not built' });
        const src = 'https://goxmr.click/pay/embed/pay.js';
        res.set('Cache-Control', 'public, max-age=300');
        res.set('Access-Control-Allow-Origin', '*');
        res.json({
            src,
            algorithm: 'sha384',
            integrity: EMBED_SRI,
            version: 1,
            snippet: `<script src="${src}" integrity="${EMBED_SRI}" crossorigin="anonymous"></script>`,
        });
    });

    // GET /pay/checkout/:order_id — checkout HTML page rendered by the SPA
    // We hand off to the SPA which detects the path and shows the modal.

    // ── MERCHANT REGISTRATION (Phase 1, invite-only + altcha + rate-limit) ───
    // Both authLimiter and verifyAltcha are injected from the host app so we
    // reuse the exact same instances and counters as /api/login etc — one
    // shared budget keeps abuse accounting honest across the auth surfaces.
    // INVITE_REQUIRED defaults to true. While PAY_PUBLIC=0 the kill switch
    // above already 404s the route to non-beta callers; this layer is the
    // second wall so that even if PAY_PUBLIC is flipped, signups stay gated
    // until invites are explicitly opened.
    const inviteRequired = process.env.PAY_INVITE_REQUIRED !== '0';
    const registerStack = [authLimiter, verifyAltcha].filter(Boolean);
    app.post('/pay/admin/register', ...registerStack, async (req, res) => {
        try {
            const { email, password, business_name, invite_code } = req.body || {};
            if (!email || !password) return res.status(400).json({ error: 'email and password required' });
            if (password.length < 12) return res.status(400).json({ error: 'password must be at least 12 chars' });
            // ReDoS-proof structural validator — same as server/index.js notification email check
            if (!isValidLooseEmailLocal(email)) return res.status(400).json({ error: 'invalid email' });

            // invite code check. validates: exists, not revoked, not expired, not already used
            let inviteRow = null;
            if (inviteRequired) {
                if (!invite_code || typeof invite_code !== 'string' || invite_code.length < 6) {
                    return res.status(403).json({ error: 'invite_code required' });
                }
                inviteRow = await dbGet(
                    "SELECT id, expires_at, is_active, used_at FROM pay_invites WHERE code = ?",
                    [invite_code.trim()]
                );
                if (!inviteRow) return res.status(403).json({ error: 'invalid invite_code' });
                if (!inviteRow.is_active) return res.status(403).json({ error: 'invite_code revoked' });
                if (inviteRow.used_at) return res.status(403).json({ error: 'invite_code already used' });
                if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
                    return res.status(403).json({ error: 'invite_code expired' });
                }
            }

            const existing = await dbGet('SELECT id FROM pay_merchants WHERE LOWER(email) = LOWER(?)', [email]);
            if (existing) return res.status(409).json({ error: 'email already registered' });

            const pwHash = await hashPassword(password);
            const result = await dbRun(
                'INSERT INTO pay_merchants (email, password_hash, business_name) VALUES (?, ?, ?)',
                [email.toLowerCase(), pwHash, (business_name || '').slice(0, 100)]
            );

            // mark invite consumed — best effort, failure here doesn't void the
            // merchant account (rare race) but is logged so operator can revoke
            // manually if abuse pattern shows up.
            if (inviteRow) {
                try {
                    await dbRun(
                        "UPDATE pay_invites SET used_by_merchant_id = ?, used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL",
                        [result.lastID, inviteRow.id]
                    );
                } catch (markErr) {
                    logError('PAY_INVITE_MARK', markErr, { inviteId: inviteRow.id, merchantId: result.lastID });
                }
            }

            const token = jwt.sign({ merchantId: result.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, merchant_id: result.lastID });
        } catch (err) {
            const id = logError('PAY_REGISTER', err);
            res.status(500).json({ error: 'Server error', id });
        }
    });

    const loginStack = [authLimiter, verifyAltcha].filter(Boolean);
    app.post('/pay/admin/login', ...loginStack, async (req, res) => {
        try {
            const { email, password } = req.body || {};
            if (!email || !password) return res.status(400).json({ error: 'email and password required' });
            const merchant = await dbGet('SELECT * FROM pay_merchants WHERE LOWER(email) = LOWER(?)', [email]);
            if (!merchant) return res.status(401).json({ error: 'Invalid credentials' });
            const ok = await verifyPassword(password, merchant.password_hash);
            if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
            if (!merchant.is_active) return res.status(403).json({ error: 'Account disabled' });
            const token = jwt.sign({ merchantId: merchant.id, email: merchant.email }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, merchant_id: merchant.id });
        } catch (err) {
            const id = logError('PAY_LOGIN', err);
            res.status(500).json({ error: 'Server error', id });
        }
    });

    // JWT auth for merchant dashboard endpoints
    function merchantJwt(req, res, next) {
        const auth = req.headers['authorization'];
        const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'login required' });
        try {
            const claims = jwt.verify(token, JWT_SECRET);
            if (!claims.merchantId) return res.status(401).json({ error: 'invalid token' });
            req.merchantId = claims.merchantId;
            next();
        } catch { return res.status(401).json({ error: 'invalid token' }); }
    }

    // ── MERCHANT DASHBOARD ────────────────────────────────────────────────
    app.get('/pay/admin/me', merchantJwt, async (req, res) => {
        try {
            const m = await dbGet(
                "SELECT id, email, business_name, monero_address, restore_height, webhook_url, is_testnet, opt_in_directory, self_host_url, created_at, api_key_prefix FROM pay_merchants WHERE id = ?",
                [req.merchantId]
            );
            if (!m) return res.status(404).json({ error: 'merchant not found' });
            res.json(m);
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    app.put('/pay/admin/me', merchantJwt, async (req, res) => {
        try {
            const allow = ['business_name', 'monero_address', 'private_view_key_enc', 'restore_height', 'webhook_url', 'opt_in_directory', 'self_host_url'];
            // boundary validation: reject obvious garbage at the API instead of
            // letting monero-ts throw inside the scanner later.
            if ('monero_address' in req.body && req.body.monero_address && !isValidMoneroAddress(req.body.monero_address)) {
                return res.status(400).json({ error: 'monero_address must be a valid mainnet primary address (4… 95 chars)' });
            }
            if ('private_view_key_enc' in req.body && req.body.private_view_key_enc && !isValidViewKey(req.body.private_view_key_enc)) {
                return res.status(400).json({ error: 'private_view_key_enc must be 64 hex chars' });
            }
            if ('webhook_url' in req.body && req.body.webhook_url && !/^https:\/\/[^\s]+$/i.test(req.body.webhook_url)) {
                return res.status(400).json({ error: 'webhook_url must be an https URL' });
            }
            const updates = [];
            const params = [];
            for (const k of allow) {
                if (k in req.body) {
                    updates.push(`${k} = ?`);
                    params.push(req.body[k] === '' ? null : req.body[k]);
                }
            }
            if (!updates.length) return res.json({ ok: true });
            params.push(req.merchantId);
            await dbRun(`UPDATE pay_merchants SET ${updates.join(', ')} WHERE id = ?`, params);
            res.json({ ok: true });
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    // Issue or rotate API key — full key returned ONCE.
    app.post('/pay/admin/api-key/rotate', merchantJwt, async (req, res) => {
        try {
            const m = await dbGet('SELECT is_testnet FROM pay_merchants WHERE id = ?', [req.merchantId]);
            if (!m) return res.status(404).json({ error: 'merchant not found' });
            const key = generateApiKey(!!m.is_testnet);
            const keyHash = await hashApiKey(key);
            const prefix = key.split('_').slice(0, 2).join('_') + '_' + key.slice(-4);
            const whSecret = generateWebhookSecret();
            await dbRun(
                'UPDATE pay_merchants SET api_key_hash = ?, api_key_prefix = ?, webhook_secret = ? WHERE id = ?',
                [keyHash, prefix, whSecret, req.merchantId]
            );
            res.json({ api_key: key, api_key_prefix: prefix, webhook_secret: whSecret, warning: 'This is the only time the api_key is shown. Store it now.' });
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    app.get('/pay/admin/orders', merchantJwt, async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = parseInt(req.query.offset) || 0;
            const rows = await dbAll(
                'SELECT order_id, external_order_id, amount_xmr, status, tx_hash, confirmations, created_at, confirmed_at FROM pay_orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [req.merchantId, limit, offset]
            );
            res.json({ orders: rows });
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    // ── PUBLIC API v1 (Bearer API key) ────────────────────────────────────
    // POST /pay/v1/orders — create a payment request.
    //
    // generates a fresh subaddress under the merchant's view-only wallet so
    // each order has its own deposit address. that lets the scanner attribute
    // arrivals to a specific order even when two orders share the same XMR
    // amount. requires merchant.monero_address + merchant.private_view_key_enc.
    app.post('/pay/v1/orders', merchantAuth, async (req, res) => {
        try {
            const { amount_xmr, external_order_id, redirect_url, metadata } = req.body || {};
            if (typeof amount_xmr !== 'number' || amount_xmr <= 0 || amount_xmr > 100) {
                return res.status(400).json({ error: 'amount_xmr must be a positive number <= 100' });
            }
            if (!req.merchant.monero_address) {
                return res.status(400).json({ error: 'merchant has no Monero address configured. Visit the dashboard.' });
            }
            if (!req.merchant.private_view_key_enc) {
                return res.status(400).json({ error: 'merchant has no view key configured. Visit the dashboard.' });
            }

            // derive a fresh subaddress for this order from the merchant's wallet.
            // the WalletPool persists the index in the wallet keys file so we can
            // never collide across restarts.
            let subaddress, subaddressIndex;
            try {
                const result = await walletPool.nextSubaddress(req.merchant);
                subaddress = result.address;
                subaddressIndex = result.index;
            } catch (walletErr) {
                logError('PAY_SUBADDRESS', walletErr, { merchantId: req.merchant.id });
                return res.status(503).json({ error: 'Failed to derive payment address. Try again in a moment.' });
            }

            const orderId = newId('ord');
            const expiresAt = new Date(Date.now() + ORDER_TTL_SECONDS * 1000).toISOString();
            await dbRun(
                `INSERT INTO pay_orders
                 (order_id, merchant_id, external_order_id, amount_xmr, payment_address, payment_subaddress_index, redirect_url, metadata, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderId, req.merchant.id, external_order_id || null, amount_xmr, subaddress, subaddressIndex,
                 redirect_url || null, metadata ? JSON.stringify(metadata).slice(0, 4000) : null, expiresAt]
            );
            res.json({
                order_id: orderId,
                payment_address: subaddress,
                payment_subaddress_index: subaddressIndex,
                amount_xmr,
                status: 'pending',
                expires_at: expiresAt,
                checkout_url: `https://goxmr.click/pay/checkout/${orderId}`,
                qr_data: `monero:${subaddress}?tx_amount=${amount_xmr}`,
            });
        } catch (err) {
            const id = logError('PAY_CREATE_ORDER', err);
            res.status(500).json({ error: 'Server error', id });
        }
    });

    app.get('/pay/v1/orders/:order_id', merchantAuth, async (req, res) => {
        try {
            const o = await dbGet('SELECT * FROM pay_orders WHERE order_id = ? AND merchant_id = ?', [req.params.order_id, req.merchant.id]);
            if (!o) return res.status(404).json({ error: 'not found' });
            res.json({
                order_id: o.order_id,
                external_order_id: o.external_order_id,
                status: o.status,
                amount_xmr: o.amount_xmr,
                confirmations: o.confirmations,
                tx_hash: o.tx_hash,
                payment_address: o.payment_address,
                created_at: o.created_at,
                confirmed_at: o.confirmed_at,
                expires_at: o.expires_at,
            });
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    // ── PUBLIC checkout status — no auth, used by the embed JS for polling ─
    // Returns ONLY what a buyer needs to render the checkout. No merchant
    // internals leaked.
    app.get('/pay/checkout/:order_id/status', async (req, res) => {
        try {
            const o = await dbGet(
                'SELECT order_id, amount_xmr, payment_address, status, confirmations, expires_at, redirect_url FROM pay_orders WHERE order_id = ?',
                [req.params.order_id]
            );
            if (!o) return res.status(404).json({ error: 'not found' });
            res.set('Cache-Control', 'no-store');
            res.json(o);
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    // ── FEDERATED MERCHANT DIRECTORY (public, opt-in) ─────────────────────
    // GET /pay/v1/directory — list merchants that opted in. Self-hosted nodes
    // can poll this OR push their own entries via POST /pay/v1/directory/announce.
    // Phase 1: hosted-only directory. Phase 3 will accept push from self-host.
    app.get('/pay/v1/directory', async (req, res) => {
        try {
            const rows = await dbAll(
                "SELECT business_name, self_host_url FROM pay_merchants WHERE opt_in_directory = 1 AND is_active = 1 ORDER BY created_at DESC LIMIT 500"
            );
            res.set('Cache-Control', 'public, max-age=120');
            res.json({ merchants: rows.map(r => ({
                name: r.business_name || 'anonymous',
                self_hosted: !!r.self_host_url,
                url: r.self_host_url || null,
            })) });
        } catch (err) { res.status(500).json({ error: 'Server error' }); }
    });

    // GET /pay/v1/nodes — browser-reachable monerod endpoints (healthy, https,
    // CORS-capable) for the client-side WASM scanner to dial directly. public:
    // it only lists nodes a browser could reach anyway. an empty list is a valid
    // answer (no CORS node healthy right now) — the client falls back to hosted
    // polling rather than scanning locally.
    app.get('/pay/v1/nodes', (req, res) => {
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ nodes: nodePool.corsNodes() });
    });
}

module.exports = { mountPayRoutes };
