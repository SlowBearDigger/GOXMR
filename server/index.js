const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const IS_DEV = process.env.NODE_ENV !== 'production';
if (IS_DEV) console.log('Database initialized, checking schema...');

// Reserved usernames — routes, features, and system paths that must not be claimed
const RESERVED_USERNAMES = new Set([
    'api', 'dashboard', 'login', 'register', 'admin', 'store', 'shop',
    'checkout', 'settings', 'profile', 'uploads', 's', 'd', 'static',
    'public', 'dist', 'assets', 'css', 'js', 'img', 'fonts',
    'learn', 'guide', 'tools', 'contribute', 'swap', 'activity',
    'about', 'help', 'support', 'terms', 'privacy', 'tos',
    'favicon', 'robots', 'sitemap', 'well-known',
    'monero', 'xmr', 'goxmr', 'root', 'system', 'null', 'undefined',
    'pay', 'trust', 'messages', 'deadman', 'contact', 'inbox',
    'nostr', 'analytics', 'notifications', 'mailer', 'email',
    // routes added during the 4.x batch — if someone claims these, /market or /track break
    'market', 'track', 'orders', 'u', 'me'
]);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const { createChallenge, verifySolution } = require('altcha-lib');
const crypto = require('crypto');
// IP-handling helpers — see server/privacy.js for the privacy contract:
// nothing identifying about a visitor ever lands in logs or DB.
const { redactIp, hmacIp, rateLimitKey } = require('./privacy');
const axios = require('axios'); // Use axios for better header handling
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
    console.warn('[WARN] WEBHOOK_SECRET not set. Webhook verification will fail.');
}

// --- AUTOMATIC ALTCHA KEY MANAGEMENT ---
let ALTCHA_HMAC_KEY = process.env.ALTCHA_HMAC_KEY;
if (!ALTCHA_HMAC_KEY) {
    const keyPath = path.join(__dirname, '.altcha_key');
    if (fs.existsSync(keyPath)) {
        ALTCHA_HMAC_KEY = fs.readFileSync(keyPath, 'utf8').trim();
    } else {
        ALTCHA_HMAC_KEY = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, ALTCHA_HMAC_KEY, 'utf8');
        console.log('🛡️ Auto-generated Altcha HMAC Key and saved to .altcha_key');
    }
}
// ----------------------------------------
const moneroMonitor = require('./monero_monitor');
const mailer = require('./mailer');
const { logError } = require('./logger');
const { blockAiCrawlers, tarpitHandler, robotsTxtHandler } = require('./botTraps');
const { addFederationRoutes } = require('./federation');
const { addPgpDmRoutes } = require('./pgpDms');
const { addSelfDestructRoutes, startSelfDestructSweeper } = require('./selfDestruct');



const TROCADOR_API_KEY = process.env.TROCADOR_API_KEY ? process.env.TROCADOR_API_KEY.trim() : '';
if (!TROCADOR_API_KEY) {
    console.warn('[WARN] TROCADOR_API_KEY is missing. Swap features may be limited.');
} else {
    console.log(`[INFO] TROCADOR_API_KEY loaded.`);
}

// ENV debug removed for security
const sharp = require('sharp');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const rpName = 'GoXMR Sovereign';
const rpID = process.env.RP_ID || 'localhost';
const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://goxmr.click',
    'http://goxmr.click',
    'https://www.goxmr.click',
    'https://store.goxmr.click'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(/[\s,]+/) // Split by comma OR space
    : defaultOrigins;
// Debug logs removed for security

if (!process.env.JWT_SECRET) {
    console.error('[CRITICAL] JWT_SECRET NOT SET. EXITING.');
    process.exit(1);
}
const challengeStore = new NodeCache({ stdTTL: 300, maxKeys: 5000 }); // 5 min TTL, auto-cleanup
const pgpChallengeStore = new NodeCache({ stdTTL: 300, maxKeys: 5000 });
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
app.use((req, res, next) => {
    // Dev request log: prefix only, never the full address. Production keeps quiet.
    if (IS_DEV) {
        console.log(`${new Date().toISOString()} [${req.method}] ${req.url} - ${redactIp(req)}`);
    }
    next();
});
// Per-request nonce so the production CSP can drop 'unsafe-inline' for scripts.
// The nonce is rotated each response; any inline <script> in index.html that needs
// to run in prod must have nonce="${res.locals.cspNonce}".
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});

// AI training crawlers: served a polite 403 + no-training notice before any route.
app.use(blockAiCrawlers);
// Public discoverable files: robots.txt (advisory opt-out) and a decoy /trap endpoint.
app.get('/robots.txt', robotsTxtHandler);
app.get('/trap', tarpitHandler);

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                // dev only: Vite HMR injects inline scripts; in prod the bundle is external
                ...(IS_DEV ? ["'unsafe-inline'"] : [(req, res) => `'nonce-${res.locals.cspNonce}'`]),
                "blob:"
            ],
            "script-src-attr": ["'none'"],
            "worker-src": ["'self'", "blob:"],
            "child-src": ["'self'", "blob:"],
            // tailwind ships utility classes inline at build, no runtime <style> mutation
            "style-src": ["'self'", "'unsafe-inline'"],
            "font-src": ["'self'", "data:"],
            "img-src": ["'self'", "data:", "blob:", "https://*.goxmr.click", "https://assets.coingecko.com", "https://www.getmonero.org"],
            "media-src": ["'self'", "blob:"],
            "connect-src": [
                "'self'",
                "blob:",
                "https://*.goxmr.click",
                "https://api.coingecko.com",
                "https://dns.google",
                "https://cloudflare-dns.com",
                "https://xmr-node.cakewallet.com:18081",
                "https://node.monerodevs.org:18089",
                "https://nodes.hashvault.pro:18081",
            ],
            "frame-ancestors": ["'none'"],
            "frame-src": ["'none'"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "upgrade-insecure-requests": [],
        }
    }
}));
app.use(cors({
    origin: function (origin, callback) {

        if (!origin) {
            // Allow server-to-server and browser navigation (no origin header)
            // Note: credentials won't be sent without an origin, so this is safe
            return callback(null, true);
        }
        // OLS may forward Origin twice. Split, dedupe, allow if every entry is
        // in the static list or matches *.goxmr.click subdomain pattern.
        const raw = Array.isArray(origin) ? origin : String(origin).split(',');
        const originList = [...new Set(raw.map(o => o.trim()).filter(Boolean))];
        const subdomainRe = /^https?:\/\/[a-z0-9_-]{1,30}\.goxmr\.click$/i;
        const allMatch = originList.length > 0 && originList.every(o => allowedOrigins.indexOf(o) !== -1 || subdomainRe.test(o));
        if (allMatch) {
            return callback(null, originList[0]);
        }
        console.warn('[CORS_REJECT]', origin);
        return callback(new Error('CORS: Unauthorized domain.'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// 256KB covers the largest realistic JSON payloads (PGP keys + encrypted form blobs).
// Larger uploads (avatars, banners) go through dedicated multipart endpoints with their own caps.
app.use(express.json({ limit: '256kb' }));

const botHoneypot = (req, res, next) => {
    const { website_id_verify, _bot_check } = req.body;
    if (website_id_verify || _bot_check) {
        console.warn(`[DEFENSE] Honeypot triggered from ${redactIp(req)}. Likely bot activity.`);

        return res.status(400).json({ error: "Bad Request" }); // Generic error to hide honeypot logic
    }
    next();
};

// --- ANTI-SCRAPING & BOT DEFENSE ---
// Normalize req.get() result that may come back as array or comma-joined.
const firstHeaderValue = (val) => {
    if (!val) return val;
    if (Array.isArray(val)) return val[0];
    return String(val).split(',')[0].trim();
};
const antiScrapingMiddleware = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const origin = firstHeaderValue(req.get('Origin'));
    const referer = firstHeaderValue(req.get('Referer'));

    // Federation, robots, and well-known endpoints MUST be reachable by server-to-server
    // calls (Mastodon instances, Nostr clients, Monero wallets, search engine bots, etc).
    // These are public protocol surfaces — skip the anti-scrape filter entirely.
    if (req.path === '/robots.txt' || req.path === '/trap' || req.path.startsWith('/.well-known/')) {
        return next();
    }

    // 1. Block known bot User-Agents
    const blockedAgents = /curl|wget|python-requests|scrapy|httpie|postman|insomnia/i;
    if (blockedAgents.test(userAgent)) {
        console.warn(`[DEFENSE] Blocked Tool User-Agent: ${userAgent} from ${redactIp(req)}`);
        return res.status(403).json({ error: "Access Denied: Automated tools not allowed." });
    }

    // 2. Strict Origin/Referer Check for API endpoints (excluding simple GETs if needed, but hardening here)
    // We allow requests if they have a valid Origin matching our allowed list, OR if it's a browser navigation (complex to detect perfectly, but we default to blocking API abuse)
    const isApiRequest = req.path.startsWith('/api/');

    if (isApiRequest) {
        // Origin allow check: explicit list OR per-user subdomain *.goxmr.click.
        const subdomainOriginRe = /^https?:\/\/[a-z0-9_-]{1,30}\.goxmr\.click$/i;
        const originAllowed = (o) => o && (allowedOrigins.includes(o) || subdomainOriginRe.test(o));
        if (origin && !originAllowed(origin)) {
            console.warn(`[DEFENSE] Blocked Origin: ${origin}`);
            return res.status(403).json({ error: "Access Denied" });
        }

        // For critical state-changing methods, require Origin or Referer
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            const validOrigin = originAllowed(origin);
            const validReferer = referer && (
                allowedOrigins.some(allowed => referer.startsWith(allowed)) ||
                /^https?:\/\/[a-z0-9_-]{1,30}\.goxmr\.click(\/|$)/i.test(referer)
            );

            if (!validOrigin && !validReferer) {
                console.warn(`[DEFENSE] Blocked Headless/Script Request (No Origin/Referer)`);
                return res.status(403).json({ error: "Access Denied: Browser required." });
            }
        }
    }

    next();
};
app.use(antiScrapingMiddleware);

// All rate-limit buckets key by HMAC(IP, SECRET) so process memory never holds
// raw client IPs. The bucket map keys are the same length and properties as
// the default ones — only the input identifying info is removed.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased from 100 to 500 to accommodate multi-trade monitoring
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    message: { error: "Security: Too many requests." }
});
const authLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    message: { error: "Security: Access attempts temporarily blocked. Try again in 30 minutes." }
});
app.use('/api', apiLimiter);
const profileCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
app.get('/api/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
});

// ALTCHA CHALLENGE ENDPOINT
app.get('/api/altcha-challenge', async (req, res) => {
    try {
        const challenge = await createChallenge({
            hmacKey: ALTCHA_HMAC_KEY,
            maxNumber: 100000, // Reasonable difficulty
        });
        res.json(challenge);
    } catch (err) {
        console.error('Altcha Challenge Error:', err);
        res.status(500).json({ error: 'Failed to generate security challenge' });
    }
});

// ALTCHA VERIFICATION MIDDLEWARE (with replay protection)
const usedAltchaChallenges = new NodeCache({ stdTTL: 300, maxKeys: 10000 }); // 5 min TTL

const verifyAltcha = async (req, res, next) => {
    if (!req.body) {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    const { altcha } = req.body;
    if (!altcha) {
        return res.status(401).json({ error: 'Security verification required (Captcha missing).' });
    }
    try {
        // Replay protection: hash the challenge payload to detect reuse
        const challengeHash = crypto.createHash('sha256').update(altcha).digest('hex');
        if (usedAltchaChallenges.get(challengeHash)) {
            return res.status(401).json({ error: 'Security verification expired. Please try again.' });
        }

        const isValid = await verifySolution(altcha, ALTCHA_HMAC_KEY);
        if (!isValid) {
            return res.status(401).json({ error: 'Security verification failed (Invalid Captcha).' });
        }

        // Mark as used
        usedAltchaChallenges.set(challengeHash, true);
        next();
    } catch (err) {
        console.error('Altcha Verify Error:', err);
        res.status(500).json({ error: 'Security verification system error.' });
    }
};
// 3E: multi-asset rates. Returns crypto+fiat rates for the currencies the store UI cares about.
// Cached 5 min in profileCache; falls back to last-known on rate-limit / network errors.
app.get('/api/rates', async (req, res) => {
    try {
        const cached = profileCache.get('multi_rates');
        if (cached) return res.json(cached);
        const ids = 'monero,bitcoin,litecoin,ethereum,bitcoin-cash,solana,dogecoin';
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur`);
        if (r.status === 429) {
            const last = profileCache.get('last_multi_rates');
            if (last) return res.json(last);
            return res.status(429).json({ error: 'Rate limit; no cache available' });
        }
        if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
        const data = await r.json();
        // Normalize to currency-code keys
        const map = {
            XMR:  data.monero,
            BTC:  data.bitcoin,
            LTC:  data.litecoin,
            ETH:  data.ethereum,
            BCH:  data['bitcoin-cash'],
            SOL:  data.solana,
            DOGE: data.dogecoin,
        };
        const out = { rates: map, fetched_at: new Date().toISOString() };
        profileCache.set('multi_rates', out, 300);
        profileCache.set('last_multi_rates', out);
        res.json(out);
    } catch (err) {
        const last = profileCache.get('last_multi_rates');
        if (last) return res.json(last);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/price/xmr', async (req, res) => {
    try {
        const cached = profileCache.get('xmr_price');
        if (cached) return res.json(cached);

        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd');

        if (response.status === 429) {
            console.warn('[COINGECKO] Rate limit hit, serving last known price');
            const lastPrice = profileCache.get('last_known_xmr_price');
            if (lastPrice) return res.json(lastPrice);
            return res.status(429).json({ error: 'Rate limit hit and no cache available' });
        }

        if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

        const data = await response.json();
        if (data.monero && data.monero.usd) {
            profileCache.set('xmr_price', data, 600); // 10 min
            profileCache.set('last_known_xmr_price', data); // No expiry
            return res.json(data);
        }
        res.status(500).json({ error: 'Invalid response from price source' });
    } catch (err) {
        console.error('Price Fetch Error:', err.message);
        const lastPrice = profileCache.get('last_known_xmr_price');
        if (lastPrice) return res.json(lastPrice);
        res.status(500).json({ error: 'Server Error' });
    }
});
app.get('/api/check-username/:username', async (req, res) => {
    if (IS_DEV) console.log(`[DEBUG] HIT check-username for: ${req.params.username}`);
    try {
        const username = req.params.username.toLowerCase();
        if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
            if (IS_DEV) console.log(`[DEBUG] Invalid format: ${username}`);
            return res.json({ available: false, error: 'Invalid format (A-Z, 0-9, _ only)' });
        }
        if (RESERVED_USERNAMES.has(username)) {
            return res.json({ available: false, error: 'This username is reserved' });
        }
        const existingUser = await dbGet('SELECT id FROM users WHERE LOWER(username) = ?', [username]);
        if (IS_DEV) console.log(`[DEBUG] Result for ${username}: ${!existingUser}`);
        res.json({ available: !existingUser });
    } catch (err) {
        console.error('[CRITICAL] /api/check-username Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});
db.serialize(() => {
    db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    db.run('ALTER TABLE users ADD COLUMN design_config TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration Error (design_config):', err);
        }
    });
    db.run('ALTER TABLE users ADD COLUMN pgp_public_key TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration Error (pgp_public_key):', err);
        }
    });
    // openalias_wallet_id: the wallets.id row this user chose to publish as
    // their OpenAlias TXT. Null = fallback to MIN(id) XMR wallet (auto pick).
    db.run('ALTER TABLE users ADD COLUMN openalias_wallet_id INTEGER', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration Error (openalias_wallet_id):', err);
        }
    });
    // pinned_section: which content block leads on the public profile.
    // One of: about | links | gallery | store. Default 'about' keeps legacy ordering.
    db.run("ALTER TABLE users ADD COLUMN pinned_section TEXT DEFAULT 'about'", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration Error (pinned_section):', err);
        }
    });
    // gallery_images: per-user public image showcase, rendered on PublicProfile
    db.run(`CREATE TABLE IF NOT EXISTS gallery_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_url TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Migration Error (gallery_images):', err);
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_gallery_user ON gallery_images(user_id, sort_order)');
    // visibility: public (on grid) | unlisted (link-only) | private (owner only)
    db.run("ALTER TABLE gallery_images ADD COLUMN visibility TEXT DEFAULT 'public'", (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Migration (gallery.visibility):', err);
    });
    db.run('ALTER TABLE gallery_images ADD COLUMN alt_text TEXT', (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Migration (gallery.alt_text):', err);
    });
    db.run('ALTER TABLE gallery_images ADD COLUMN views INTEGER DEFAULT 0', (err) => {
        if (err && !err.message.includes('duplicate column name')) console.error('Migration (gallery.views):', err);
    });
});
const dbGet = (query, params) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};
const dbRun = (query, params) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};
const multer = require('multer');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomUUID();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Strict allowlist of safe extensions and MIME types
        const ALLOWED_EXT = /^\.(jpeg|jpg|png|gif|webp|mp3)$/;
        const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|audio\/mpeg)$/;
        const extname = path.extname(file.originalname).toLowerCase();

        // Block any file with more than one extension (e.g., file.php.jpg, file.svg.png)
        const nameWithoutExt = file.originalname.slice(0, -extname.length);
        if (nameWithoutExt.includes('.')) {
            return cb(new Error("Security Block: Multiple extensions not allowed."));
        }

        if (!ALLOWED_EXT.test(extname)) {
            return cb(new Error("Error: Only JPEG, PNG, GIF, WebP, or MP3 files allowed."));
        }
        if (!ALLOWED_MIME.test(file.mimetype)) {
            return cb(new Error("Error: Invalid file type."));
        }
        return cb(null, true);
    }
});
app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Content-Disposition', 'inline');
        res.set('Cache-Control', 'public, max-age=86400');
    }
}));
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    try {
        const user = jwt.verify(token, JWT_SECRET);
        // Check if token was issued before a password change
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT tokens_valid_after FROM users WHERE id = ?', [user.userId], (err, r) => err ? reject(err) : resolve(r));
        });
        if (row && row.tokens_valid_after && user.iat < row.tokens_valid_after) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.sendStatus(403);
    }
};

// Force Manual Payment Check
app.post('/api/me/premium/check', authenticateToken, async (req, res) => {
    try {
        const { txid } = req.body;
        console.log(`[PREMIUM] Manual check requested by ${req.user.username}. TXID Provided: ${!!txid}`);

        let customMessage = null;

        if (txid) {
            const result = await moneroMonitor.checkPaymentByTxid(req.user.userId, txid);
            if (result.found && result.valid) {
                customMessage = "Transaction Confirmed! Premium Activated.";
            } else if (result.found && !result.valid) {
                customMessage = `Transaction found but not ready: ${result.reason}`;
            } else {
                customMessage = "Transaction ID not found in your subaddress history.";
            }
        } else {
            await moneroMonitor.forceCheck();
        }

        // Re-fetch user status
        const user = await dbGet('SELECT is_premium FROM users WHERE id = ?', [req.user.userId]);
        res.json({
            success: true,
            isPremium: !!user.is_premium,
            message: user.is_premium ? (customMessage || 'Premium status confirmed!') : (customMessage || 'No confirmed payment found yet. Scanning...')
        });
    } catch (err) {
        console.error('Manual Premium Check Error:', err);
        res.status(500).json({ error: err.message || 'Manual check failed' });
    }
});
const dbAll = (query, params) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, banner_image, music_url, design_config, handle_config, recovery_hash, pgp_public_key, nostr_pubkey, mastodon_handle, self_destruct_at, is_premium, premium_activated_at, profile_views, notification_email, email_notifications, language, created_at FROM users WHERE id = ?', [req.user.userId]);
        if (!user) return res.sendStatus(404);
        const { recovery_hash, ...safeUser } = user;
        const links = await dbAll('SELECT * FROM links WHERE user_id = ?', [req.user.userId]);
        const wallets = await dbAll('SELECT * FROM wallets WHERE user_id = ?', [req.user.userId]);
        res.json({
            ...safeUser,
            hasRecovery: !!recovery_hash,
            links,
            wallets,
            isPremium: !!user.is_premium,
            premiumActivatedAt: user.premium_activated_at,
            design: user.design_config ? JSON.parse(user.design_config) : null,
            handle_config: user.handle_config ? JSON.parse(user.handle_config) : { enabled_currencies: ['XMR'] },
            hasPgp: !!user.pgp_public_key
        });
    } catch (err) {
        console.error('API/ME Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});
app.post('/api/me/sync', authenticateToken, async (req, res) => {
    try {
        const { links, wallets, design } = req.body;
        const userId = req.user.userId;

        // Strip HTML tags from user input to prevent stored XSS
        const stripHtml = (str) => typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : str;

        // Validate color values in design config
        const isValidColor = (val) => {
            if (!val || typeof val !== 'string') return true; // allow empty
            return /^#([0-9a-fA-F]{3,8})$/.test(val) || /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(val) || /^[a-zA-Z]{1,20}$/.test(val);
        };

        // Security: Limit number of items
        if ((links && links.length > 50) || (wallets && wallets.length > 20)) {
            return res.status(400).json({ error: 'Security: Too many profile items. Limit: 50 links, 20 wallets.' });
        }

        // Security: Validate design config size/structure
        if (design && JSON.stringify(design).length > 20000) {
            return res.status(400).json({ error: 'Design config too large' });
        }

        // Sanitize color fields in design config
        if (design) {
            const colorFields = ['accentColor', 'backgroundColor', 'pageColor', 'borderColor', 'textColor', 'buttonColor'];
            for (const field of colorFields) {
                if (design[field] && !isValidColor(design[field])) {
                    return res.status(400).json({ error: `Invalid color value for ${field}` });
                }
            }
        }

        // ATOMIC TRANSACTION: All changes succeed or all rollback
        await dbRun('BEGIN TRANSACTION');
        try {
            await dbRun('UPDATE users SET design_config = ? WHERE id = ?', [JSON.stringify(design), userId]);

            // Links: incremental sync — track which IDs the client sent
            const existingLinks = await dbAll('SELECT * FROM links WHERE user_id = ?', [userId]);
            const processedLinkIds = new Set();

            if (links && Array.isArray(links)) {
                for (const l of links) {
                    if (l.title?.length > 100 || l.url?.length > 500) continue;
                    const safeTitle = stripHtml(l.title);
                    const safeUrl = stripHtml(l.url);

                    // the client assigns Date.now() as a temporary id for newly-added
                    // links (so React can key them in the list). that id never matches
                    // a DB row, so we cannot use `l.id is truthy` as a "this is an
                    // existing row" signal — match against the existing rows directly
                    // and fall through to INSERT for anything we don't find.
                    const exists = l.id ? existingLinks.find(el => el.id === l.id) : null;
                    if (exists) {
                        await dbRun('UPDATE links SET type = ?, title = ?, url = ?, icon = ? WHERE id = ? AND user_id = ?',
                            [l.type, safeTitle, safeUrl, l.icon, l.id, userId]);
                        processedLinkIds.add(l.id);
                    } else {
                        const result = await dbRun('INSERT INTO links (user_id, type, title, url, icon) VALUES (?, ?, ?, ?, ?)',
                            [userId, l.type, safeTitle, safeUrl, l.icon]);
                        processedLinkIds.add(result.lastID);
                    }
                }
            }

            // Delete only links that were NOT in the new list
            for (const el of existingLinks) {
                if (!processedLinkIds.has(el.id)) {
                    await dbRun('DELETE FROM links WHERE id = ? AND user_id = ?', [el.id, userId]);
                }
            }

            // Wallets: incremental upsert (already was incremental, keep it)
            const existingWallets = await dbAll('SELECT * FROM wallets WHERE user_id = ?', [userId]);
            const processedWalletIds = new Set();

            if (wallets && Array.isArray(wallets)) {
                for (const w of wallets) {
                    if (w.label?.length > 100 || w.address?.length > 200) continue;
                    const safeLabel = stripHtml(w.label);
                    const safeAddress = stripHtml(w.address);

                    const existing = existingWallets.find(ew => ew.id === w.id || (ew.currency === w.currency && ew.label === w.label));

                    if (existing) {
                        await dbRun('UPDATE wallets SET address = ?, label = ? WHERE id = ?', [safeAddress, safeLabel, existing.id]);
                        processedWalletIds.add(existing.id);
                    } else {
                        const result = await dbRun('INSERT INTO wallets (user_id, currency, label, address) VALUES (?, ?, ?, ?)',
                            [userId, w.currency, safeLabel, safeAddress]);
                        processedWalletIds.add(result.lastID);
                    }
                }
            }

            // Delete wallets not in the new list
            for (const ew of existingWallets) {
                if (!processedWalletIds.has(ew.id)) {
                    await dbRun('DELETE FROM wallets WHERE id = ? AND user_id = ?', [ew.id, userId]);
                }
            }

            await dbRun('COMMIT');
        } catch (txErr) {
            await dbRun('ROLLBACK');
            throw txErr;
        }

        res.json({ message: 'Dashboard Deployed Successfully' });
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [userId]);
        if (user) {
            profileCache.del(`user:${user.username}`);
            // Sync OpenAlias TXT to PowerDNS (best-effort).
            try {
                const { syncUserOpenAlias } = require('./openaliasSync');
                // Honour the user's explicit OpenAlias wallet choice if set,
                // otherwise fall back to the first XMR wallet they added.
                const me = await dbGet('SELECT openalias_wallet_id FROM users WHERE id = ?', [userId]);
                let xmrWallet = null;
                if (me?.openalias_wallet_id) {
                    xmrWallet = await dbGet(
                        "SELECT address FROM wallets WHERE id = ? AND user_id = ? AND currency = 'XMR'",
                        [me.openalias_wallet_id, userId]
                    );
                }
                if (!xmrWallet) {
                    xmrWallet = await dbGet(
                        "SELECT address FROM wallets WHERE user_id = ? AND currency = 'XMR' ORDER BY id ASC LIMIT 1",
                        [userId]
                    );
                }
                await syncUserOpenAlias(user.username, xmrWallet?.address || null);
            } catch (oaErr) {
                console.warn('[OPENALIAS_SYNC]', user.username, oaErr.message);
            }
        }
    } catch (err) {
        console.error('SYNC Error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
});
app.get('/api/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const cacheKey = `user:${username.toLowerCase()}`;
        const cachedData = profileCache.get(cacheKey);
        if (cachedData) {
            if (IS_DEV) console.log(`[Cache] Serving ${username} from memory`);
            return res.json(cachedData);
        }
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, banner_image, music_url, design_config, pgp_public_key, nostr_pubkey, mastodon_handle, pinned_section, created_at, is_premium FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const links = await dbAll('SELECT * FROM links WHERE user_id = ?', [user.id]);
        const wallets = await dbAll('SELECT * FROM wallets WHERE user_id = ?', [user.id]);
        const { pgp_public_key, nostr_pubkey, mastodon_handle, ...safePublicUser } = user;
        const profileData = {
            ...safePublicUser,
            has_pgp: !!pgp_public_key,
            has_nostr: !!nostr_pubkey,
            has_mastodon: !!mastodon_handle,
            mastodon_handle: mastodon_handle || null,
            links,
            wallets,
            design: user.design_config ? JSON.parse(user.design_config) : null
        };
        profileCache.set(cacheKey, profileData);
        res.json(profileData);
        // Fire-and-forget: increment view counter (doesn't block response)
        dbRun('UPDATE users SET profile_views = profile_views + 1 WHERE id = ?', [user.id]).catch(() => {});
    } catch (err) {
        console.error('API/USER Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});
// Trust Score — public reputation badge computed from verifiable facts
app.get('/api/user/:username/trust', async (req, res) => {
    try {
        const username = req.params.username;
        const cacheKey = `trust:${username.toLowerCase()}`;
        const cached = profileCache.get(cacheKey);
        if (cached) return res.json(cached);

        const user = await dbGet(
            'SELECT id, pgp_public_key, recovery_hash, is_premium, created_at FROM users WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        const authCount = await dbGet('SELECT COUNT(*) as count FROM authenticators WHERE user_id = ?', [user.id]);
        const salesCount = await dbGet("SELECT COUNT(*) as count FROM store_orders WHERE seller_id = ? AND status = 'complete'", [user.id]);
        const avgRating = await dbGet(
            'SELECT AVG(r.rating) as avg FROM store_reviews r JOIN store_orders o ON r.order_id = o.id WHERE o.seller_id = ?',
            [user.id]
        );

        const hasPgp = !!user.pgp_public_key;
        const hasWebauthn = (authCount?.count || 0) > 0;
        const hasRecovery = !!user.recovery_hash;
        const isPremium = !!user.is_premium;
        const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const completedSales = salesCount?.count || 0;
        const rating = avgRating?.avg || 0;

        // Score formula: max 100
        let score = 0;
        const badges = [];

        if (hasPgp) { score += 15; badges.push('PGP_VERIFIED'); }
        if (hasWebauthn) { score += 20; badges.push('HARDWARE_KEY'); }
        if (hasRecovery) { score += 10; badges.push('RECOVERY_SET'); }
        if (isPremium) { score += 10; badges.push('PREMIUM'); }
        score += Math.min(Math.floor(accountAgeDays / 30), 15); // +1 per month, max 15
        if (accountAgeDays >= 30) badges.push('VETERAN');
        score += Math.min(completedSales * 2, 20); // +2 per sale, max 20
        if (completedSales >= 1) badges.push('MERCHANT');
        score += Math.min(Math.round(rating * 2), 10); // rating * 2, max 10

        const result = {
            score: Math.min(score, 100),
            badges,
            details: { hasPgp, hasWebauthn, hasRecovery, isPremium, accountAgeDays, completedSales, avgRating: Math.round(rating * 10) / 10 }
        };

        profileCache.set(cacheKey, result, 300); // Cache 5 min
        res.json(result);
    } catch (err) {
        console.error('Trust Score Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

app.put('/api/me', authenticateToken, async (req, res) => {
    try {
        const { display_name, bio, nostr_pubkey, mastodon_handle, pinned_section } = req.body;

        if (display_name === undefined && bio === undefined && nostr_pubkey === undefined && mastodon_handle === undefined && pinned_section === undefined) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        if (display_name?.length > 50 || bio?.length > 500) {
            return res.status(400).json({ error: 'Display name (50 chars) or bio (500 chars) too long.' });
        }
        if (pinned_section !== undefined && pinned_section !== null && !['about', 'links', 'gallery', 'store'].includes(pinned_section)) {
            return res.status(400).json({ error: 'pinned_section must be one of about|links|gallery|store' });
        }

        // Federation field validation
        // Nostr: accept hex pubkey (64 hex chars) or npub1... (bech32, 63 chars)
        if (nostr_pubkey !== undefined && nostr_pubkey !== null && nostr_pubkey !== '') {
            const pk = String(nostr_pubkey).trim();
            if (!/^([a-f0-9]{64}|npub1[a-z0-9]{50,62})$/i.test(pk)) {
                return res.status(400).json({ error: 'nostr_pubkey must be 64 hex chars or an npub1 bech32 string' });
            }
        }
        // Mastodon: handle@instance.tld
        if (mastodon_handle !== undefined && mastodon_handle !== null && mastodon_handle !== '') {
            const mh = String(mastodon_handle).trim().replace(/^@/, '');
            if (!/^[a-z0-9_.-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(mh)) {
                return res.status(400).json({ error: 'mastodon_handle must look like name@instance.tld' });
            }
        }

        const stripHtml = (str) => typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : str;
        const norm = (v) => (v === undefined ? null : (v === '' ? null : v));

        await dbRun(
            `UPDATE users SET
                display_name = COALESCE(?, display_name),
                bio = COALESCE(?, bio),
                nostr_pubkey = CASE WHEN ? = 1 THEN ? ELSE nostr_pubkey END,
                mastodon_handle = CASE WHEN ? = 1 THEN ? ELSE mastodon_handle END,
                pinned_section = COALESCE(?, pinned_section)
             WHERE id = ?`,
            [
                display_name !== undefined ? stripHtml(display_name) : null,
                bio !== undefined ? stripHtml(bio) : null,
                nostr_pubkey !== undefined ? 1 : 0, norm(nostr_pubkey),
                mastodon_handle !== undefined ? 1 : 0, norm(mastodon_handle && String(mastodon_handle).trim().replace(/^@/, '')),
                pinned_section !== undefined ? pinned_section : null,
                req.user.userId
            ]
        );
        profileCache.del(`user:${req.user.username}`);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

app.post('/api/me/upload/:type', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const type = req.params.type;
        if (IS_DEV) console.log(`[UPLOAD] Processing upload for type: ${type} by user: ${req.user.username}`);
        if (!['profile', 'banner', 'qr_logo', 'audio'].includes(type)) {
            console.warn(`[UPLOAD] Invalid type requested: ${type}`);
            return res.status(400).json({ error: 'Invalid upload type' });
        }
        if (!req.file) {
            console.warn('[UPLOAD] No file received in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (IS_DEV) console.log(`[UPLOAD] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

        const originalPath = req.file.path;
        let fileUrl = '';

        if (type === 'audio') {
            const extension = path.extname(req.file.originalname).toLowerCase();
            const filename = `${req.file.filename.split('.')[0]}${extension}`;
            const targetPath = path.join(uploadDir, filename);
            fs.renameSync(originalPath, targetPath);
            fileUrl = `/uploads/${filename}`;

            if (IS_DEV) console.log(`[UPLOAD] Updating DB for music_url to ${fileUrl}`);
            await dbRun(`UPDATE users SET music_url = ? WHERE id = ?`, [fileUrl, req.user.userId]);
            const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
            if (user) profileCache.del(`user:${user.username}`);
        } else if (path.extname(req.file.originalname).toLowerCase() === '.gif') {
            // GIF HANDLING: Preserve animation
            const GIF_LIMIT = 5 * 1024 * 1024; // 5MB limit for GIFs
            if (req.file.size > GIF_LIMIT) {
                fs.unlinkSync(originalPath);
                return res.status(400).json({ error: 'GIF too large. Maximum 5MB allowed for animations.' });
            }

            const filename = `${req.file.filename.split('.')[0]}.gif`;
            const targetPath = path.join(uploadDir, filename);

            // Just move the file to keep it simple and preserve animation
            fs.renameSync(originalPath, targetPath);
            fileUrl = `/uploads/${filename}`;

            if (type !== 'qr_logo') {
                const column = type === 'profile' ? 'profile_image' : 'banner_image';
                if (IS_DEV) console.log(`[UPLOAD] Updating DB for ${column} (GIF) to ${fileUrl}`);
                await dbRun(`UPDATE users SET ${column} = ? WHERE id = ?`, [fileUrl, req.user.userId]);
                const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
                if (user) profileCache.del(`user:${user.username}`);
            }
        } else {
            // Sharp refuses "same file for input and output". If the upload is already
            // .webp, multer's filename ends in .webp and naively reusing `name.webp` for
            // the optimized output collides. We read into a buffer first, then write to
            // a deterministic optimized filename. The result is always .webp regardless
            // of source format, and the temporary upload is removed.
            const baseName = `${req.file.filename.split('.')[0]}-opt.webp`;
            const optimizedPath = path.join(uploadDir, baseName);
            let sharpInstance = sharp(originalPath);
            if (type === 'banner') {
                sharpInstance = sharpInstance.resize(1500, 500, { fit: 'cover', position: 'center' });
            } else if (type === 'profile') {
                sharpInstance = sharpInstance.resize(500, 500, { fit: 'cover', position: 'center' });
            } else if (type === 'qr_logo') {
                sharpInstance = sharpInstance.resize(200, 200, { fit: 'inside' });
            }
            const outputBuffer = await sharpInstance.webp({ quality: 85 }).toBuffer();
            await fs.promises.writeFile(optimizedPath, outputBuffer);
            fs.unlink(originalPath, (err) => {
                if (err) console.error('Failed to delete original upload:', err);
            });
            fileUrl = `/uploads/${baseName}`;

            if (type !== 'qr_logo') {
                const column = type === 'profile' ? 'profile_image' : 'banner_image';
                if (IS_DEV) console.log(`[UPLOAD] Updating DB for ${column} to ${fileUrl}`);
                await dbRun(`UPDATE users SET ${column} = ? WHERE id = ?`, [fileUrl, req.user.userId]);
                const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
                if (user) profileCache.del(`user:${user.username}`);
            }
        }
        if (IS_DEV) console.log(`[UPLOAD] Success: ${fileUrl}`);
        res.json({ message: 'Upload successful', url: fileUrl });
    } catch (err) {
        console.error('Upload Optimization Error:', err);
        res.status(500).json({ error: 'Upload or optimization failed' });
    }
});
// ============================================
// GALLERY: per-user public image showcase
// ============================================
const GALLERY_MAX_PER_USER = parseInt(process.env.MAX_GALLERY_PER_USER || '12', 10);
const GALLERY_MAX_DIM = parseInt(process.env.MAX_GALLERY_DIM || '1600', 10);
const GALLERY_WEBP_QUALITY = 82;
const GALLERY_VISIBILITIES = new Set(['public', 'unlisted', 'private']);

// Sharp pipeline that strips ALL metadata (EXIF, GPS, IPTC, XMP). Defence
// for users who didn't realise their phone was tagging photos with home
// coordinates. .rotate() honours the EXIF orientation tag then drops it.
async function processGalleryImage(srcPath, isGif) {
    if (isGif) {
        return { ext: '.gif', buffer: await fs.promises.readFile(srcPath) };
    }
    const buf = await sharp(srcPath, { failOn: 'truncated' })
        .rotate()
        .resize(GALLERY_MAX_DIM, GALLERY_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: GALLERY_WEBP_QUALITY })
        .toBuffer();
    return { ext: '.webp', buffer: buf };
}

// GET own gallery (authed)
app.get('/api/me/gallery', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAll(
            'SELECT id, file_url, caption, alt_text, visibility, sort_order, views, created_at FROM gallery_images WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
            [req.user.userId]
        );
        res.json({ images: rows, max: GALLERY_MAX_PER_USER });
    } catch (err) {
        const id = logError('GALLERY_LIST', err, { userId: req.user?.userId });
        res.status(500).json({ error: 'Server error', id });
    }
});

// GET public gallery by username — only public visibility shows on the grid
app.get('/api/user/:username/gallery', async (req, res) => {
    try {
        const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [req.params.username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const rows = await dbAll(
            "SELECT id, file_url, caption, alt_text, sort_order, views FROM gallery_images WHERE user_id = ? AND visibility = 'public' ORDER BY sort_order ASC, id ASC",
            [user.id]
        );
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ images: rows });
    } catch (err) {
        const id = logError('GALLERY_PUBLIC', err);
        res.status(500).json({ error: 'Server error', id });
    }
});

// GET single unlisted image by id+username — for direct-link sharing of unlisted ones.
// Owner can also fetch private through this when authenticated.
app.get('/api/user/:username/gallery/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Bad id' });
        const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [req.params.username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const row = await dbGet(
            'SELECT id, file_url, caption, alt_text, visibility, views FROM gallery_images WHERE id = ? AND user_id = ?',
            [id, user.id]
        );
        if (!row) return res.status(404).json({ error: 'Not found' });
        if (row.visibility === 'private') {
            // owner-only: needs auth and matching id
            const auth = req.headers['authorization'];
            const token = auth && auth.split(' ')[1];
            if (!token) return res.status(404).json({ error: 'Not found' });
            try {
                const u = jwt.verify(token, JWT_SECRET);
                if (u.userId !== user.id) return res.status(404).json({ error: 'Not found' });
            } catch { return res.status(404).json({ error: 'Not found' }); }
        }
        res.json(row);
    } catch (err) {
        const id = logError('GALLERY_ITEM', err);
        res.status(500).json({ error: 'Server error', id });
    }
});

// POST single upload OR bulk: multer accepts up to GALLERY_MAX_PER_USER files at once.
// The client may send `image` (single) or `images[]` (multiple).
app.post('/api/me/gallery', authenticateToken, upload.array('images', GALLERY_MAX_PER_USER), async (req, res) => {
    // Some clients still send the legacy single-file `image` field — express
    // accepts that through upload.fields, but with .array() we route both into
    // req.files. If a caller used `image`, multer parses it as `image` in body.
    const files = Array.isArray(req.files) && req.files.length ? req.files
        : (req.file ? [req.file] : []);
    try {
        if (!files.length) return res.status(400).json({ error: 'No file uploaded' });
        const count = await dbGet('SELECT COUNT(*) as n FROM gallery_images WHERE user_id = ?', [req.user.userId]);
        const have = count?.n || 0;
        if (have + files.length > GALLERY_MAX_PER_USER) {
            // unlink everything we received, refuse atomically
            for (const f of files) fs.unlink(f.path, () => {});
            return res.status(409).json({
                error: `Would exceed quota (${GALLERY_MAX_PER_USER} images). You have ${have}, sent ${files.length}.`
            });
        }
        const visibility = GALLERY_VISIBILITIES.has(req.body.visibility) ? req.body.visibility : 'public';
        const captionBase = typeof req.body.caption === 'string' ? req.body.caption.slice(0, 280) : null;
        const altBase = typeof req.body.alt_text === 'string' ? req.body.alt_text.slice(0, 280) : null;
        const maxRow = await dbGet('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM gallery_images WHERE user_id = ?', [req.user.userId]);

        const created = [];
        let nextOrder = maxRow.next;
        for (const file of files) {
            const isGif = path.extname(file.originalname).toLowerCase() === '.gif';
            if (isGif && file.size > 5 * 1024 * 1024) {
                fs.unlink(file.path, () => {});
                continue;
            }
            const { ext, buffer } = await processGalleryImage(file.path, isGif);
            const filename = `${file.filename.split('.')[0]}-gal${ext}`;
            await fs.promises.writeFile(path.join(uploadDir, filename), buffer);
            fs.unlink(file.path, () => {});
            const fileUrl = `/uploads/${filename}`;
            const result = await dbRun(
                'INSERT INTO gallery_images (user_id, file_url, caption, alt_text, visibility, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.userId, fileUrl, captionBase, altBase, visibility, nextOrder]
            );
            created.push({ id: result.lastID, file_url: fileUrl, caption: captionBase, alt_text: altBase, visibility, sort_order: nextOrder, views: 0 });
            nextOrder += 1;
        }
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
        if (user) profileCache.del(`user:${user.username}`);
        res.json({ created, count: created.length });
    } catch (err) {
        for (const f of files) fs.unlink(f.path, () => {});
        const id = logError('GALLERY_UPLOAD', err, { userId: req.user?.userId });
        res.status(500).json({ error: 'Upload failed', id });
    }
});

// PUT update caption, alt_text, visibility, or order
app.put('/api/me/gallery/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Bad id' });
        const owned = await dbGet('SELECT id FROM gallery_images WHERE id = ? AND user_id = ?', [id, req.user.userId]);
        if (!owned) return res.status(404).json({ error: 'Not found' });
        const updates = [];
        const params = [];
        if (typeof req.body.caption === 'string') {
            updates.push('caption = ?'); params.push(req.body.caption.slice(0, 280));
        } else if (req.body.caption === null) updates.push('caption = NULL');
        if (typeof req.body.alt_text === 'string') {
            updates.push('alt_text = ?'); params.push(req.body.alt_text.slice(0, 280));
        } else if (req.body.alt_text === null) updates.push('alt_text = NULL');
        if (typeof req.body.visibility === 'string' && GALLERY_VISIBILITIES.has(req.body.visibility)) {
            updates.push('visibility = ?'); params.push(req.body.visibility);
        }
        if (typeof req.body.sort_order === 'number') {
            updates.push('sort_order = ?'); params.push(req.body.sort_order);
        }
        if (!updates.length) return res.json({ ok: true });
        params.push(id);
        await dbRun(`UPDATE gallery_images SET ${updates.join(', ')} WHERE id = ?`, params);
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
        if (user) profileCache.del(`user:${user.username}`);
        res.json({ ok: true });
    } catch (err) {
        const id = logError('GALLERY_UPDATE', err, { userId: req.user?.userId });
        res.status(500).json({ error: 'Server error', id });
    }
});

// POST anonymous view increment. No auth, no IP storage. Client is responsible
// for sessionStorage-based dedup so a single visitor doesn't inflate the counter
// across reloads. Worst case if abused: a slightly inflated counter, never PII.
app.post('/api/user/:username/gallery/:id/view', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Bad id' });
        const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [req.params.username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await dbRun(
            "UPDATE gallery_images SET views = views + 1 WHERE id = ? AND user_id = ? AND visibility != 'private'",
            [id, user.id]
        );
        res.json({ ok: true });
    } catch (err) {
        // failures are non-fatal — never block image viewing on stats
        res.json({ ok: false });
    }
});

// DELETE one image (also unlinks the file)
app.delete('/api/me/gallery/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Bad id' });
        const row = await dbGet('SELECT file_url FROM gallery_images WHERE id = ? AND user_id = ?', [id, req.user.userId]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        await dbRun('DELETE FROM gallery_images WHERE id = ? AND user_id = ?', [id, req.user.userId]);
        // best-effort file removal
        try {
            const filename = row.file_url.replace(/^\/uploads\//, '');
            if (filename && !filename.includes('..')) {
                fs.unlink(path.join(uploadDir, filename), () => {});
            }
        } catch {}
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
        if (user) profileCache.del(`user:${user.username}`);
        res.json({ ok: true });
    } catch (err) {
        const id = logError('GALLERY_DELETE', err, { userId: req.user?.userId });
        res.status(500).json({ error: 'Server error', id });
    }
});

app.delete('/api/me/upload/audio', authenticateToken, async (req, res) => {
    try {
        await dbRun('UPDATE users SET music_url = NULL WHERE id = ?', [req.user.userId]);
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
        if (user) profileCache.del(`user:${user.username}`);
        res.json({ message: 'Music removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove music' });
    }
});

// PGP AUTH ENDPOINTS
app.post('/api/pgp/challenge', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const user = await dbGet('SELECT pgp_public_key FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user || !user.pgp_public_key) {
            return res.status(404).json({ error: 'PGP not configured for this identity' });
        }

        const challenge = `GOXMR_AUTH_CHALLENGE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        pgpChallengeStore.set(username, { challenge, timestamp: Date.now() });

        // Challenges expire in 5 minutes
        // TTL cleanup handled automatically by NodeCache (5 min)

        res.json({ challenge });
    } catch (err) {
        console.error('PGP Challenge Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

const openpgp = require('openpgp');

app.post('/api/pgp/verify', verifyAltcha, async (req, res) => {
    try {
        const { username, signature } = req.body;
        if (!username || !signature) return res.status(400).json({ error: 'Missing credentials' });

        const stored = pgpChallengeStore.get(username);
        if (!stored) return res.status(401).json({ error: 'Challenge expired or not found' });

        const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user || !user.pgp_public_key) return res.status(404).json({ error: 'Identity error' });

        try {
            const publicKey = await openpgp.readKey({ armoredKey: user.pgp_public_key });
            const message = await openpgp.readCleartextMessage({ cleartextMessage: signature });
            const verification = await openpgp.verify({
                message,
                verificationKeys: publicKey
            });
            const { verified, keyID } = verification.signatures[0];
            await verified; // throws on invalid signature

            // Verify content matches challenge
            if (message.getText().trim() !== stored.challenge) {
                return res.status(401).json({ error: 'Challenge mismatch' });
            }

            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            pgpChallengeStore.del(username);
            res.json({ message: 'Authenticated', token, username: user.username });
        } catch (pgpErr) {
            console.error('PGP Verification Logic Error:', pgpErr);
            return res.status(401).json({ error: 'Invalid PGP Signature' });
        }
    } catch (err) {
        console.error('PGP Verify Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- ENCRYPTED MESSAGES API ---

// Get PGP public key for a user (for client-side encryption)
app.get('/api/pgp/:username/key', async (req, res) => {
    try {
        const user = await dbGet('SELECT pgp_public_key FROM users WHERE LOWER(username) = LOWER(?)', [req.params.username]);
        if (!user || !user.pgp_public_key) return res.status(404).json({ error: 'No PGP key found for this user' });
        res.json({ pgp_public_key: user.pgp_public_key });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Send encrypted message to a user
const messageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyGenerator: rateLimitKey, message: { error: 'Too many messages. Try again later.' } });
app.post('/api/user/:username/message', messageLimiter, verifyAltcha, async (req, res) => {
    try {
        const { sender_name, encrypted_content } = req.body;
        if (!encrypted_content) return res.status(400).json({ error: 'Encrypted content required' });
        if (sender_name && sender_name.length > 50) return res.status(400).json({ error: 'Sender name too long' });

        const user = await dbGet('SELECT id, pgp_public_key FROM users WHERE LOWER(username) = LOWER(?)', [req.params.username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.pgp_public_key) return res.status(400).json({ error: 'User does not accept encrypted messages' });

        const stripHtml = (str) => typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : str;
        await dbRun(
            'INSERT INTO encrypted_messages (recipient_user_id, sender_name, encrypted_content) VALUES (?, ?, ?)',
            [user.id, stripHtml(sender_name) || 'Anonymous', encrypted_content]
        );

        res.json({ success: true, message: 'Message sent securely' });
        // Notify recipient via email (fire-and-forget)
        mailer.sendNotification(user.id, 'New Encrypted Message on GOXMR',
            `You received a new encrypted message from ${stripHtml(sender_name) || 'Anonymous'}.\n\nLog in to your GOXMR dashboard to decrypt and read it.\n\nhttps://goxmr.click/dashboard`);
    } catch (err) {
        console.error('Send Message Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get my encrypted messages (inbox)
app.get('/api/me/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await dbAll(
            'SELECT id, sender_name, encrypted_content, is_read, created_at FROM encrypted_messages WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT 100',
            [req.user.userId]
        );
        const unreadCount = messages.filter(m => !m.is_read).length;
        res.json({ messages, unread: unreadCount });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Mark message as read
app.put('/api/me/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        await dbRun('UPDATE encrypted_messages SET is_read = 1 WHERE id = ? AND recipient_user_id = ?', [req.params.id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Delete message
app.delete('/api/me/messages/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun('DELETE FROM encrypted_messages WHERE id = ? AND recipient_user_id = ?', [req.params.id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- DEAD MAN'S SWITCH API ---

// Create dead man's switch (premium only)
app.post('/api/tools/deadman', authenticateToken, async (req, res) => {
    try {
        const { encrypted_content, encryption_method, recipient_code, heartbeat_interval_days } = req.body;
        if (!encrypted_content) return res.status(400).json({ error: 'Encrypted content required' });

        const user = await dbGet('SELECT is_premium FROM users WHERE id = ?', [req.user.userId]);
        if (!user?.is_premium) return res.status(403).json({ error: 'Dead Man\'s Switch requires Premium status' });

        const interval = parseInt(heartbeat_interval_days) || 30;
        if (interval < 1 || interval > 365) return res.status(400).json({ error: 'Interval must be 1-365 days' });

        // Limit: max 5 active switches per user
        const activeCount = await dbGet("SELECT COUNT(*) as count FROM dead_mans_switches WHERE user_id = ? AND is_active = 1", [req.user.userId]);
        if ((activeCount?.count || 0) >= 5) return res.status(400).json({ error: 'Maximum 5 active switches allowed' });

        const nextTrigger = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();
        const method = encryption_method === 'PGP' ? 'PGP' : 'AES';

        await dbRun(
            `INSERT INTO dead_mans_switches (user_id, encrypted_content, encryption_method, recipient_code, heartbeat_interval_days, next_trigger_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.userId, encrypted_content, method, recipient_code || null, interval, nextTrigger]
        );

        res.json({ success: true, message: 'Dead Man\'s Switch armed', next_trigger_at: nextTrigger });
    } catch (err) {
        console.error('DMS Create Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Heartbeat — reset the timer
app.put('/api/tools/deadman/:id/heartbeat', authenticateToken, async (req, res) => {
    try {
        const sw = await dbGet('SELECT * FROM dead_mans_switches WHERE id = ? AND user_id = ? AND is_active = 1', [req.params.id, req.user.userId]);
        if (!sw) return res.status(404).json({ error: 'Switch not found' });

        const nextTrigger = new Date(Date.now() + sw.heartbeat_interval_days * 24 * 60 * 60 * 1000).toISOString();
        await dbRun('UPDATE dead_mans_switches SET last_heartbeat = CURRENT_TIMESTAMP, next_trigger_at = ? WHERE id = ?', [nextTrigger, sw.id]);

        res.json({ success: true, next_trigger_at: nextTrigger });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// List my switches
app.get('/api/me/deadman', authenticateToken, async (req, res) => {
    try {
        const switches = await dbAll(
            'SELECT id, encryption_method, recipient_code, heartbeat_interval_days, last_heartbeat, next_trigger_at, is_active, is_triggered, triggered_drop_code, created_at FROM dead_mans_switches WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.userId]
        );
        res.json({ switches });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Deactivate switch
app.delete('/api/tools/deadman/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun('UPDATE dead_mans_switches SET is_active = 0 WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- SIGNALS & DROPS API ---

function generateShortCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(bytes[i] % chars.length);
    }
    return result;
}

// Create Signal (URL)
app.post('/api/tools/signal', verifyAltcha, async (req, res) => {
    try {
        const { url, password, customCode, expiresHours } = req.body;

        // Validate URL to prevent open redirects and dangerous schemes
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        const normalizedUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        try {
            const parsed = new URL(normalizedUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return res.status(400).json({ error: 'Only http/https URLs are allowed' });
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const authHeader = req.headers['authorization'];
        let userId = null;

        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
            } catch (e) { }
        }

        let finalCode = generateShortCode();
        let expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        let passHash = null;

        if (userId) {
            // Logged in users can customize
            if (customCode) {
                if (!/^[a-zA-Z0-9_-]{1,50}$/.test(customCode)) {
                    return res.status(400).json({ error: 'Custom alias must be alphanumeric (a-z, 0-9, _, -)' });
                }
                const existing = await dbGet('SELECT id FROM signals WHERE short_code = ?', [customCode]);
                if (existing) return res.status(400).json({ error: 'Custom alias already taken' });
                finalCode = customCode;
            }
            if (password) {
                const salt = await bcrypt.genSalt(12);
                passHash = await bcrypt.hash(password, salt);
            }
            if (expiresHours !== undefined) {
                expiry = expiresHours === 0 ? null : new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
            }
        }

        await dbRun('INSERT INTO signals (short_code, original_url, user_id, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
            [finalCode, url, userId, passHash, expiry]);

        res.json({
            shortCode: finalCode,
            short_code: finalCode, // Defensive: ensure frontend finds it regardless of version
            expiresAt: expiry
        });

    } catch (err) {
        console.error('Signal Create Error:', err);
        res.status(500).json({ error: 'Failed to create signal' });
    }
});

// Create Drop (Secure Note)
app.post('/api/tools/drop', verifyAltcha, async (req, res) => {
    try {
        const { content, method, burnAfterRead, expiresHours } = req.body;
        const authHeader = req.headers['authorization'];
        let userId = null;

        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
            } catch (e) { }
        }

        const dropCode = generateShortCode(8);
        let expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        let burn = 0;

        if (userId) {
            if (expiresHours) {
                expiry = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
            }
            if (burnAfterRead) burn = 1;
        }

        await dbRun('INSERT INTO drops (drop_code, encrypted_content, user_id, encryption_method, burn_after_read, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [dropCode, content, userId, method || 'AES', burn, expiry]);

        res.json({ dropCode, expiresAt: expiry });

    } catch (err) {
        console.error('Drop Create Error:', err);
        res.status(500).json({ error: 'Failed to create drop' });
    }
});

// Resolver for Signals (GET for initial check, POST for password submission)
app.all('/api/resolve/signal/:code', async (req, res) => {
    try {
        const { code } = req.params;
        // Accept password from POST body (preferred) or GET query (legacy)
        const password = (req.method === 'POST' && req.body?.password) || req.query?.password;
        if (IS_DEV) console.log(`[RESOLVER] Resolving code: ${code}`);

        const signal = await dbGet('SELECT * FROM signals WHERE short_code = ? COLLATE NOCASE AND is_active = 1', [code]);
        if (!signal) {
            if (IS_DEV) console.log(`[RESOLVER] Signal not found (or inactive) for code: ${code}`);
            return res.status(404).json({ error: 'Signal not found' });
        }

        if (IS_DEV) console.log(`[RESOLVER] Found key: ${signal.short_code}, Expires: ${signal.expires_at}`);

        if (signal.expires_at && new Date(signal.expires_at) < new Date()) {
            console.warn(`[RESOLVER] Expired key hit: ${code}`);
            await dbRun('UPDATE signals SET is_active = 0 WHERE id = ?', [signal.id]);
            return res.status(410).json({ error: 'Signal expired' });
        }

        if (signal.password_hash) {
            if (!password) return res.json({ requiresPassword: true });
            const valid = await bcrypt.compare(password, signal.password_hash);
            if (!valid) return res.status(401).json({ error: 'Invalid password' });
        }

        await dbRun('UPDATE signals SET visit_count = visit_count + 1 WHERE id = ?', [signal.id]);

        let targetUrl = signal.original_url;
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        res.json({ url: targetUrl });

    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Resolver for Drops
app.get('/api/resolve/drop/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const drop = await dbGet('SELECT * FROM drops WHERE drop_code = ?', [code]);

        if (!drop) return res.status(404).json({ error: 'Drop not found' });

        if (drop.expires_at && new Date(drop.expires_at) < new Date()) {
            await dbRun('DELETE FROM drops WHERE id = ?', [drop.id]);
            return res.status(410).json({ error: 'Drop expired' });
        }

        // For burn-after-read: delete BEFORE sending response to prevent race condition
        if (drop.burn_after_read) {
            await dbRun('DELETE FROM drops WHERE id = ?', [drop.id]);
        }

        res.json({
            content: drop.encrypted_content,
            method: drop.encryption_method,
            burnAfterRead: !!drop.burn_after_read
        });

    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- USER MANAGEMENT ENDPOINTS ---

app.get('/api/me/signals', authenticateToken, async (req, res) => {
    try {
        const signals = await dbAll('SELECT id, short_code, original_url, visit_count, created_at, expires_at FROM signals WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
        res.json(signals);
    } catch (err) {
        console.error('Fetch signals error:', err);
        res.status(500).json({ error: 'Failed to fetch signals' });
    }
});

app.delete('/api/me/signals/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun('DELETE FROM signals WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        res.json({ message: 'Signal deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete signal' });
    }
});

app.put('/api/me/signals/:id', authenticateToken, async (req, res) => {
    try {
        const { original_url } = req.body;
        if (!original_url) return res.status(400).json({ error: 'URL required' });

        // Validate URL scheme
        const normalizedUrl = /^https?:\/\//i.test(original_url) ? original_url : 'https://' + original_url;
        try {
            const parsed = new URL(normalizedUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return res.status(400).json({ error: 'Only http/https URLs are allowed' });
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Verify ownership
        const signal = await dbGet('SELECT id FROM signals WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        if (!signal) return res.status(404).json({ error: 'Signal not found' });

        await dbRun('UPDATE signals SET original_url = ? WHERE id = ?', [original_url, req.params.id]);
        res.json({ message: 'Signal updated' });
    } catch (err) {
        console.error('Update signal error:', err);
        res.status(500).json({ error: 'Failed to update signal' });
    }
});

app.get('/api/me/drops', authenticateToken, async (req, res) => {
    try {
        const drops = await dbAll('SELECT id, drop_code, encryption_method, burn_after_read, created_at, expires_at FROM drops WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
        res.json(drops);
    } catch (err) {
        console.error('Fetch drops error:', err);
        res.status(500).json({ error: 'Failed to fetch drops' });
    }
});

app.delete('/api/me/drops/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun('DELETE FROM drops WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        res.json({ message: 'Drop deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete drop' });
    }
});

app.put('/api/me/drops/:id', authenticateToken, async (req, res) => {
    try {
        const { extendHours } = req.body;
        if (!extendHours) return res.status(400).json({ error: 'Extension duration required' });

        // Verify ownership
        const drop = await dbGet('SELECT id, expires_at FROM drops WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        if (!drop) return res.status(404).json({ error: 'Drop not found' });

        const currentExpiry = new Date(drop.expires_at || Date.now());
        const newExpiry = new Date(currentExpiry.getTime() + (extendHours * 60 * 60 * 1000)).toISOString();

        await dbRun('UPDATE drops SET expires_at = ? WHERE id = ?', [newExpiry, req.params.id]);
        res.json({ message: 'Drop extended', expiresAt: newExpiry });
    } catch (err) {
        console.error('Update drop error:', err);
        res.status(500).json({ error: 'Failed to update drop' });
    }
});

// --- TROCADOR API PROXY (DOCS BASED) ---

const TROCADOR_BASE_URL = 'https://api.trocador.app';

// 1. Get Rates (Estimate)
app.get('/api/trocador/rates', async (req, res) => {
    try {
        // Map frontend params to Trocador params
        // Request: ?ticker_from=btc&network_from=Mainnet&amount_from=0.1
        const { ticker_from, network_from, amount_from } = req.query;

        if (IS_DEV) console.log(`[TROCADOR] Rate Request: ${ticker_from} (${network_from}) -> xmr : ${amount_from}`);

        if (!ticker_from || !network_from || !amount_from) {
            return res.status(400).json({ error: 'Missing parameters (ticker_from, network_from, amount_from)' });
        }

        const params = new URLSearchParams({
            ticker_from,
            network_from,
            ticker_to: 'xmr',
            network_to: 'Mainnet',
            amount_from,
            payment: 'False', // Standard swap
            best_only: 'True',
            markup: '0'
        });

        if (!TROCADOR_API_KEY || TROCADOR_API_KEY.length < 10) {
            console.error('[TROCADOR] API Key is missing or too short.');
            return res.status(500).json({ error: 'Server Configuration Error: TROCADOR_API_KEY missing' });
        }

        const url = `${TROCADOR_BASE_URL}/new_rate`;

        try {
            const response = await axios.get(url, {
                params: params,
                headers: { 'API-Key': TROCADOR_API_KEY }
            });
            res.json(response.data);
        } catch (error) {
            const errData = error.response ? error.response.data : error.message;
            console.error('Trocador Rate API Error:', JSON.stringify(errData));
            res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch rates', details: errData });
        }
    } catch (err) {
        console.error('Trocador Rate Proxy Error:', err);
        res.status(500).json({ error: 'Proxy Error' });
    }
});

// 2. Create Trade
app.post('/api/trocador/exchange', verifyAltcha, async (req, res) => {
    try {
        // Frontend sends: { ticker_from, network_from, amount_from, address (user xmr address) }
        // We might or might not have an 'id' from the rate step. If we don't, we just send parameters.
        const payload = req.body;

        if (!payload.ticker_from || !payload.network_from || !payload.amount_from || !payload.address) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Docs: https://api.trocador.app/new_trade?ticker_from=...
        const params = new URLSearchParams({
            ticker_from: payload.ticker_from,
            network_from: payload.network_from,
            ticker_to: 'xmr',
            network_to: 'Mainnet',
            amount_from: payload.amount_from,
            address: payload.address, // User's XMR address
            address_memo: '0', // No memo for XMR usually
            fixed: 'False',
            payment: 'False',
            markup: '0',
            webhook: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/trocador/webhook`,
            webhook_key: WEBHOOK_SECRET || ''
        });

        // If we have an ID from a previous rate quote, use it to lock that rate/provider
        if (payload.id) {
            params.append('id', payload.id);
        }

        // If provider not sent, we might fail if ID is not sent. 
        // Strategy: Frontend should call rates first, get provider and ID, then call this.
        if (payload.provider) {
            params.append('provider', payload.provider);
        }

        if (!TROCADOR_API_KEY || TROCADOR_API_KEY.length < 10) {
            console.error('[TROCADOR] API Key is missing or too short.');
            return res.status(500).json({ error: 'Server Configuration Error: TROCADOR_API_KEY missing' });
        }

        const url = `${TROCADOR_BASE_URL}/new_trade`;
        if (IS_DEV) console.log(`[TROCADOR] Trade Create URL: ${url}`);

        try {
            const response = await axios.get(url, { // Yes, Trocador uses GET for new_trade too
                params: params,
                headers: { 'API-Key': TROCADOR_API_KEY }
            });
            res.json(response.data);
        } catch (error) {
            const errData = error.response ? error.response.data : error.message;
            console.error('Trocador Trade API Error:', JSON.stringify(errData));
            res.status(error.response ? error.response.status : 500).json({ error: 'Trade creation failed', details: errData });
        }

    } catch (err) {
        console.error('Trocador Trade Proxy Error:', err);
        res.status(500).json({ error: 'Proxy Error' });
    }
});

// 3. Get Prepaid Cards
app.get('/api/trocador/cards', async (req, res) => {
    try {
        const response = await axios.get(`${TROCADOR_BASE_URL}/cards`, {
            headers: { 'API-Key': TROCADOR_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        console.error('Trocador Fetch Cards Error:', JSON.stringify(errData));
        res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch cards', details: errData });
    }
});

// 4. Get Giftcards
app.get('/api/trocador/giftcards', async (req, res) => {
    try {
        const { country } = req.query;
        const params = country ? { country } : {};
        const response = await axios.get(`${TROCADOR_BASE_URL}/giftcards`, {
            params,
            headers: { 'API-Key': TROCADOR_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        console.error('Trocador Fetch Giftcards Error:', JSON.stringify(errData));
        res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch giftcards', details: errData });
    }
});

// 5. Order Prepaid Card
app.post('/api/trocador/order_prepaidcard', verifyAltcha, async (req, res) => {
    try {
        const payload = req.body;
        const params = new URLSearchParams({
            provider: payload.provider,
            currency_code: payload.currency_code,
            ticker_from: payload.ticker_from,
            network_from: payload.network_from,
            amount: payload.amount,
            email: payload.email,
            webhook: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/trocador/webhook`,
            webhook_key: WEBHOOK_SECRET || ''
        });

        const response = await axios.get(`${TROCADOR_BASE_URL}/order_prepaidcard`, {
            params: params,
            headers: { 'API-Key': TROCADOR_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        console.error('Trocador Order Prepaid Card Error:', JSON.stringify(errData));
        res.status(error.response ? error.response.status : 500).json({ error: 'Order failed', details: errData });
    }
});

// 6. Order Giftcard
app.post('/api/trocador/order_giftcard', verifyAltcha, async (req, res) => {
    try {
        const payload = req.body;
        const params = new URLSearchParams({
            product_id: payload.product_id,
            ticker_from: payload.ticker_from,
            network_from: payload.network_from,
            amount: payload.amount,
            email: payload.email,
            webhook: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/trocador/webhook`,
            webhook_key: WEBHOOK_SECRET || ''
        });

        const response = await axios.get(`${TROCADOR_BASE_URL}/order_giftcard`, {
            params: params,
            headers: { 'API-Key': TROCADOR_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        console.error('Trocador Order Giftcard Error:', JSON.stringify(errData));
        res.status(error.response ? error.response.status : 500).json({ error: 'Order failed', details: errData });
    }
});

// 7. Webhook Receiver
const webhookCache = new NodeCache({ stdTTL: 86400 }); // Store status for 24 hours

app.post('/api/trocador/webhook', async (req, res) => {
    try {
        const data = req.body;
        const tradeId = data.trade_id;
        const receivedKey = data.webhook_key;

        // Verify the webhook came from Trocador
        const sameKey = WEBHOOK_SECRET && typeof receivedKey === 'string' && receivedKey.length === WEBHOOK_SECRET.length &&
            crypto.timingSafeEqual(Buffer.from(receivedKey), Buffer.from(WEBHOOK_SECRET));
        if (!sameKey) {
            console.warn(`[TROCADOR-WEBHOOK] Unauthorized webhook attempt for ${tradeId}`);
            return res.status(401).send('Unauthorized');
        }

        if (tradeId) {
            console.log(`[TROCADOR-WEBHOOK] Received update for ${tradeId}: ${data.status}`);
            webhookCache.set(tradeId, data);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).send('Error');
    }
});

// 8. Get Trade Status (Cached or Proxy)
app.get('/api/trocador/trade/:id', async (req, res) => {
    try {
        const tradeId = req.params.id;
        // Basic sanitization
        if (!/^[a-zA-Z0-9\-_]+$/.test(tradeId)) {
            return res.status(400).json({ error: 'Invalid trade ID' });
        }

        const cached = webhookCache.get(tradeId);
        if (cached) {
            console.log(`[TROCADOR] Serving trade ${tradeId} from webhook cache`);
            return res.json(cached);
        }

        const response = await axios.get(`${TROCADOR_BASE_URL}/trade`, {
            params: { id: tradeId },
            headers: { 'API-Key': TROCADOR_API_KEY }
        });

        // Cache the successful response to mitigate Trocador API rate limits
        if (response.data) {
            webhookCache.set(tradeId, response.data);
        }

        res.json(response.data);
    } catch (error) {
        const errData = error.response ? error.response.data : error.message;
        res.status(error.response ? error.response.status : 500).json({ error: 'Failed to fetch trade status', details: errData });
    }
});


// HIBP k-anonymity check. Sends only the first 5 chars of SHA-1(password) to the
// pwnedpasswords range API and matches the rest locally. Opt-out with HIBP_DISABLED=1.
// Fails open: if the API is unreachable, registration proceeds.
async function isPasswordBreached(password) {
    if (process.env.HIBP_DISABLED === '1') return false;
    try {
        const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = sha1.slice(0, 5);
        const suffix = sha1.slice(5);
        const r = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
            timeout: 3000,
            headers: { 'User-Agent': 'GOXMR-registration-check' }
        });
        return String(r.data || '').split('\n').some(line => line.split(':')[0].trim() === suffix);
    } catch {
        return false; // fail-open on network or rate-limit issues
    }
}

app.post('/api/register', authLimiter, botHoneypot, verifyAltcha, async (req, res) => {
    try {
        const { username: rawUsername, password, recovery_password, pgp_public_key } = req.body;
        if (!rawUsername || (!password && !pgp_public_key)) {
            return res.status(400).json({ error: 'Username and (Password or PGP Key) are required' });
        }
        if (!/^[a-zA-Z0-9_]{1,30}$/.test(rawUsername)) {
            return res.status(400).json({ error: 'Username must be 1-30 characters, alphanumeric and underscores only' });
        }
        if (password && password.length >= 8 && await isPasswordBreached(password)) {
            return res.status(400).json({ error: 'This password appears in known breach lists. Please choose a different one.' });
        }
        // #8: new accounts are canonicalized to lowercase. Lookups remain case-insensitive
        // so legacy mixed-case accounts keep working; only newly minted usernames are stored
        // canonical. URLs render lowercase everywhere as a result.
        const username = rawUsername.toLowerCase();
        if (RESERVED_USERNAMES.has(username)) {
            return res.status(400).json({ error: 'This username is reserved' });
        }
        if (password && password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const existingUser = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        const salt = await bcrypt.genSalt(12);
        // For PGP-only accounts, use an impossible bcrypt hash (no password login possible)
        const hash = password ? await bcrypt.hash(password, salt) : await bcrypt.hash(crypto.randomBytes(64).toString('hex'), salt);
        let recoveryHash = null;
        if (recovery_password) {
            recoveryHash = await bcrypt.hash(recovery_password, salt);
        }
        const result = await dbRun(
            'INSERT INTO users (username, password_hash, recovery_hash, pgp_public_key) VALUES (?, ?, ?, ?)',
            [username, hash, recoveryHash, pgp_public_key]
        );
        const userId = result.lastID;
        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ message: 'Identity created successfully', token, username });
    } catch (error) {
        const id = logError('REGISTER', error, { ip: redactIp(req), ua: req.get('User-Agent') });
        res.status(500).json({ error: 'Internal Server Error', id });
    }
});
app.post('/api/login', authLimiter, botHoneypot, verifyAltcha, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }
        const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Authenticated', token, username: user.username });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/webauthn/register-options', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { attachment } = req.query;
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const authenticators = await dbAll('SELECT * FROM authenticators WHERE user_id = ?', [userId]);
        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: Buffer.from(user.id.toString()),
            userName: user.username,
            userDisplayName: user.display_name || user.username,
            excludeCredentials: authenticators
                .filter(auth => auth.credential_id && typeof auth.credential_id === 'string')
                .map(auth => ({
                    id: auth.credential_id,
                    transports: auth.transports ? JSON.parse(auth.transports) : undefined,
                })),
            authenticatorSelection: {
                residentKey: 'required',
                requireResidentKey: true,
                userVerification: 'preferred',
                ...(attachment && (attachment === 'platform' || attachment === 'cross-platform') && { authenticatorAttachment: attachment })
            },
        });
        challengeStore.set(userId, options.challenge);
        res.json({ options });
    } catch (err) {
        console.error('WebAuthn Reg Options Error:', err);
        res.status(500).json({ error: 'Failed to generate registration options' });
    }
});
app.post('/api/webauthn/register-verify', authenticateToken, verifyAltcha, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { body, authenticatorAttachment } = req.body;
        const expectedChallenge = challengeStore.get(userId);
        if (!expectedChallenge) {
            return res.status(400).json({ error: 'Challenge expired or not found' });
        }
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: allowedOrigins,
            expectedRPID: rpID,
        });
        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;
            const credIdStr = credential.id;
            const credPkStr = Buffer.from(credential.publicKey).toString('base64url');
            const counter = 0;
            await dbRun(
                'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports, attachment) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, credIdStr, credPkStr, counter, JSON.stringify(body.response.transports || []), authenticatorAttachment || 'cross-platform']
            );
            challengeStore.del(userId);
            res.json({ verified: true });
        } else {
            res.status(400).json({ verified: false, error: 'Verification failed' });
        }
    } catch (err) {
        console.error('WebAuthn Verify Error:', err);
        res.status(500).json({ error: 'Failed to verify registration' });
    }
});
app.get('/api/webauthn/auth-options', async (req, res) => {
    try {
        const { username, type } = req.query;
        let options;
        if (username) {
            const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            let query = 'SELECT * FROM authenticators WHERE user_id = ?';
            let params = [user.id];
            if (type && (type === 'platform' || type === 'cross-platform')) {
                query += ' AND attachment = ?';
                params.push(type);
            }
            const authenticators = await dbAll(query, params);
            options = await generateAuthenticationOptions({
                rpID,
                allowCredentials: authenticators
                    .filter(auth => auth.credential_id && typeof auth.credential_id === 'string')
                    .map(auth => ({
                        id: auth.credential_id,
                        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
                    })),
                userVerification: 'preferred',
            });
        } else {
            options = await generateAuthenticationOptions({
                rpID,
                allowCredentials: [],
                userVerification: 'preferred',
            });
        }
        const challengeKey = username ? `auth:${username}` : `auth:generic:${options.challenge}`;
        challengeStore.set(challengeKey, options.challenge);
        res.json({ options, challengeKey, username });
    } catch (err) {
        console.error('WebAuthn Auth Options Error:', err);
        res.status(500).json({ error: 'Failed to generate auth options' });
    }
});
app.post('/api/webauthn/auth-verify', verifyAltcha, async (req, res) => {
    try {
        const { body, username, challengeKey } = req.body;
        if (IS_DEV) console.log('[DEBUG] Auth Verify Request:', { username, challengeKey, credentialId: body?.id });
        if (!body || !body.id) {
            return res.status(400).json({ error: 'Missing authentication body or credential ID' });
        }
        const expectedChallenge = challengeStore.get(challengeKey);
        if (!expectedChallenge) {
            console.error('[ERROR] Challenge expired or not found for key:', challengeKey);
            return res.status(400).json({ error: 'Challenge expired' });
        }
        let authenticator = await dbGet('SELECT * FROM authenticators WHERE credential_id = ?', [body.id]);
        if (!authenticator) {
            console.error('[ERROR] Authenticator not found in DB. CredID:', body.id);
            return res.status(400).json({ error: 'Authenticator not registered' });
        }
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [authenticator.user_id]);
        if (!user) {
            console.error('[ERROR] User not found for authenticator');
            return res.status(404).json({ error: 'User not found' });
        }
        if (username && username.toLowerCase() !== user.username.toLowerCase()) {
            console.error('[ERROR] Username mismatch:', { provided: username, db: user.username });
            return res.status(400).json({ error: 'Username mismatch' });
        }

        let safeCounter = 0;
        if (authenticator.counter !== null && authenticator.counter !== undefined) {
            safeCounter = Number(authenticator.counter);
        }
        if (!authenticator.credential_id || !authenticator.credential_public_key) {
            throw new Error('Corrupted authenticator data in DB (missing ID or Public Key)');
        }


        const credentialObj = {
            id: authenticator.credential_id,
            publicKey: Buffer.from(authenticator.credential_public_key, 'base64url'),
            counter: safeCounter,
            transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
        };
        if (IS_DEV) console.log('[DEBUG] Prepared Credential Object:', {
            id: credentialObj.id,
            pkLength: credentialObj.publicKey.length,
            counter: credentialObj.counter
        });
        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: allowedOrigins,
            expectedRPID: rpID,
            credential: credentialObj,
            requireUserVerification: false,
        });
        if (verification.verified) {
            const { newCounter } = verification.authenticationInfo;
            await dbRun('UPDATE authenticators SET counter = ? WHERE id = ?', [newCounter, authenticator.id]);
            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            challengeStore.del(challengeKey);
            console.log(`[SUCCESS] User ${user.username} authenticated via Hardware/Biometrics`);
            res.json({ verified: true, token, username: user.username });
        } else {
            console.error('[ERROR] Verification logic returned false');
            res.status(400).json({ verified: false, error: 'Verification failed' });
        }
    } catch (err) {
        console.error('WebAuthn Auth Verify Error:', err);

        const errorMessage = err.message || 'Unknown verification error';
        res.status(500).json({ error: `Hardware Auth Error: ${errorMessage}` });
    }
});
app.get('/api/me/authenticators', authenticateToken, async (req, res) => {
    try {
        const authenticators = await dbAll('SELECT id, created_at, transports, counter, attachment FROM authenticators WHERE user_id = ?', [req.user.userId]);
        res.json(authenticators.map(a => ({
            id: a.id,
            created_at: a.created_at,
            transports: a.transports ? JSON.parse(a.transports) : [],
            attachment: a.attachment,
            label: 'Hardware Authenticator'
        })));
    } catch (err) {
        console.error('Get Authenticators Error:', err);
        res.status(500).json({ error: 'Failed to fetch authenticators' });
    }
});
app.delete('/api/me/authenticators/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM authenticators WHERE id = ? AND user_id = ?', [id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete Authenticator Error:', err);
        res.status(500).json({ error: 'Failed to delete authenticator' });
    }
});
app.put('/api/me/security', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, newRecoveryPassword } = req.body;
        const userId = req.user.userId;
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }
        if (newPassword && newPassword.length >= 8 && await isPasswordBreached(newPassword)) {
            return res.status(400).json({ error: 'This password appears in known breach lists. Please choose a different one.' });
        }
        const salt = await bcrypt.genSalt(12);
        let updateQuery = 'UPDATE users SET ';
        const params = [];
        if (newPassword) {
            const hash = await bcrypt.hash(newPassword, salt);
            updateQuery += 'password_hash = ?, ';
            params.push(hash);
        }
        if (newRecoveryPassword) {
            const recoveryHash = await bcrypt.hash(newRecoveryPassword, salt);
            updateQuery += 'recovery_hash = ?, ';
            params.push(recoveryHash);
        }
        if (params.length === 0) return res.status(400).json({ error: 'Nothing to update' });
        // Invalidate all existing tokens when password changes
        if (newPassword) {
            updateQuery += 'tokens_valid_after = ?, ';
            params.push(Math.floor(Date.now() / 1000));
        }
        updateQuery = updateQuery.slice(0, -2) + ' WHERE id = ?';
        params.push(userId);
        await dbRun(updateQuery, params);
        // Issue a fresh token so the current session stays alive
        const token = jwt.sign({ userId, username: req.user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: 'Security credentials updated', token });
    } catch (err) {
        console.error('Security Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/me/pgp', authenticateToken, async (req, res) => {
    try {
        const { pgp_public_key } = req.body;
        await dbRun('UPDATE users SET pgp_public_key = ? WHERE id = ?', [pgp_public_key, req.user.userId]);
        res.json({ message: 'PGP Public Key updated' });
    } catch (err) {
        console.error('PGP Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/me/premium', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet('SELECT is_premium, premium_subaddress_index, premium_activated_at FROM users WHERE id = ?', [req.user.userId]);
        const subaddress = await moneroMonitor.getOrCreateSubaddress(req.user.userId);
        res.json({
            isPremium: !!user.is_premium,
            subaddress,
            activatedAt: user.premium_activated_at
        });
    } catch (err) {
        console.error('Premium Status Error:', err);
        res.status(500).json({ error: 'Failed to fetch premium status' });
    }
});
app.post('/api/recover-access', authLimiter, botHoneypot, async (req, res) => {
    try {
        const { username, recoveryPassword, newPassword } = req.body;
        if (!username || !recoveryPassword || !newPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
        if (!user || !user.recovery_hash) {
            return res.status(404).json({ error: 'Recovery not available for this identity' });
        }
        const validRecovery = await bcrypt.compare(recoveryPassword, user.recovery_hash);
        if (!validRecovery) {
            return res.status(401).json({ error: 'Invalid recovery password' });
        }
        const salt = await bcrypt.genSalt(12);
        const newHash = await bcrypt.hash(newPassword, salt);
        // Invalidate all existing tokens when password is recovered
        await dbRun('UPDATE users SET password_hash = ?, tokens_valid_after = ? WHERE id = ?',
            [newHash, Math.floor(Date.now() / 1000), user.id]);
        res.json({ message: 'Access restored. You can now login with your new password.' });
    } catch (err) {
        console.error('Recovery Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.delete('/api/me', authenticateToken, async (req, res) => {
    try {
        const { password, recoveryPassword } = req.body;
        const userId = req.user.userId;
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) {
            return res.status(401).json({ error: 'Verification failed. Invalid password.' });
        }
        if (user.recovery_hash) {
            if (!recoveryPassword) {
                return res.status(400).json({ error: 'Recovery password is required for account destruction.' });
            }
            const validRecovery = await bcrypt.compare(recoveryPassword, user.recovery_hash);
            if (!validRecovery) {
                return res.status(401).json({ error: 'Verification failed. Invalid recovery password.' });
            }
        }
        // Delete all user data in a transaction (proper cascade)
        await dbRun('BEGIN TRANSACTION');
        try {
            // New features
            await dbRun('DELETE FROM encrypted_messages WHERE recipient_user_id = ?', [userId]);
            await dbRun('DELETE FROM dead_mans_switches WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM link_clicks WHERE link_id IN (SELECT id FROM links WHERE user_id = ?)', [userId]);
            // Store data (orders reference products, so delete orders first)
            await dbRun('DELETE FROM store_reviews WHERE buyer_id = ?', [userId]);
            await dbRun('DELETE FROM store_downloads WHERE order_id IN (SELECT id FROM store_orders WHERE buyer_id = ? OR seller_id = ?)', [userId, userId]);
            await dbRun('DELETE FROM store_orders WHERE buyer_id = ? OR seller_id = ?', [userId, userId]);
            await dbRun('DELETE FROM store_digital_content WHERE product_id IN (SELECT id FROM store_products WHERE user_id = ?)', [userId]);
            await dbRun('DELETE FROM store_products WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM store_config WHERE user_id = ?', [userId]);
            // Core user data
            await dbRun('DELETE FROM signals WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM drops WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM links WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM wallets WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM authenticators WHERE user_id = ?', [userId]);
            await dbRun('DELETE FROM users WHERE id = ?', [userId]);
            await dbRun('COMMIT');
        } catch (txErr) {
            await dbRun('ROLLBACK');
            throw txErr;
        }
        profileCache.del(`user:${user.username}`);
        res.json({ message: 'Identity and all data successfully destroyed.' });
    } catch (err) {
        console.error('Account Destruction Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// CAKE WALLET / MASTODON EMULATION ENDPOINTS
app.get('/.well-known/webfinger', async (req, res) => {
    try {
        const resource = req.query.resource;
        if (!resource || !resource.startsWith('acct:')) {
            return res.status(400).json({ error: 'Invalid resource' });
        }
        const handle = resource.replace('acct:', '');
        const [username] = handle.split('@');

        const user = await dbGet(
            'SELECT id, username, mastodon_handle FROM users WHERE LOWER(username) = ?',
            [String(username).toLowerCase()]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        const links = [
            {
                rel: 'http://webfinger.net/rel/profile-page',
                type: 'text/html',
                href: `${baseUrl}/${user.username}`
            }
        ];
        // If the user pointed to an external Mastodon/Pleroma account, federate to it.
        // Without this, the previous response advertised a non-existent ActivityPub endpoint.
        if (user.mastodon_handle && /^[a-z0-9_.-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(user.mastodon_handle)) {
            const [mhUser, mhInstance] = user.mastodon_handle.split('@');
            links.push({
                rel: 'self',
                type: 'application/activity+json',
                href: `https://${mhInstance}/users/${mhUser}`
            });
        }

        res.setHeader('Content-Type', 'application/jrd+json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({
            subject: `acct:${user.username}@${host}`,
            aliases: [`${baseUrl}/${user.username}`],
            links
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// NIP-05 Nostr Identity Verification (also works with CakeWallet)
app.get('/.well-known/nostr.json', async (req, res) => {
    try {
        const name = req.query.name;
        if (!name) return res.status(400).json({ error: 'name parameter required' });

        const user = await dbGet('SELECT nostr_pubkey FROM users WHERE LOWER(username) = LOWER(?)', [name]);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Per NIP-05 the response MUST be JSON with a `names` object even when the
        // queried name is unknown — clients use that empty object as a negative
        // answer, while a 404 makes them treat the whole domain as "not a NIP-05
        // provider" and silently disable verification.
        if (!user || !user.nostr_pubkey) {
            return res.status(200).json({ names: {}, relays: {} });
        }
        res.json({
            names: { [name.toLowerCase()]: user.nostr_pubkey },
            relays: {}
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Save Nostr pubkey
app.put('/api/me/nostr', authenticateToken, async (req, res) => {
    try {
        const { pubkey } = req.body;
        if (pubkey && !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
            return res.status(400).json({ error: 'Invalid Nostr pubkey. Must be 64-char hex string.' });
        }
        await dbRun('UPDATE users SET nostr_pubkey = ? WHERE id = ?', [pubkey || null, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.get('/api/v1/accounts/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, banner_image, handle_config, design_config, created_at FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
        if (!user) return res.status(404).json({ error: 'Not found' });

        const wallets = await dbAll('SELECT id, currency, address FROM wallets WHERE user_id = ?', [user.id]);
        const handleConfig = user.handle_config ? JSON.parse(user.handle_config) : { enabled_currencies: ['XMR'] };
        const designConfig = user.design_config ? JSON.parse(user.design_config) : {};
        const selectedWalletId = designConfig.qrDesign?.selectedWalletId;

        // Prioritize the selected wallet ID if it exists
        if (selectedWalletId) {
            wallets.sort((a, b) => (a.id === selectedWalletId ? -1 : b.id === selectedWalletId ? 1 : 0));
        }

        let walletLines = [];
        const addedCoins = new Set();

        wallets.forEach(w => {
            const coin = w.currency.toUpperCase();
            if (handleConfig.enabled_currencies.includes(w.currency) && !addedCoins.has(coin)) {
                walletLines.push(`${coin}: ${w.address}`);
                addedCoins.add(coin);
            }
        });

        let bioContent = "";
        let bioWallets = "";

        if (walletLines.length > 0) {
            bioWallets = walletLines.join("\n");
        }

        // In Ultra-Strict mode, we ignore the user bio.
        // But we must ensure bioContent is not undefined.
        // plainNote = bioWallets; 

        const plainNote = bioWallets;

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({
            id: user.id.toString(),
            username: user.username,
            acct: `${user.username}@${host}`,
            display_name: user.display_name || user.username,
            locked: false,
            bot: false,
            discoverable: true,
            group: false,
            created_at: new Date(user.created_at || Date.now()).toISOString(),
            note: plainNote,
            url: `${baseUrl}/${user.username}`,
            avatar: user.profile_image ? `${baseUrl}${user.profile_image}` : null,
            avatar_static: user.profile_image ? `${baseUrl}${user.profile_image}` : null,
            header: user.banner_image ? `${baseUrl}${user.banner_image}` : null,
            header_static: user.banner_image ? `${baseUrl}${user.banner_image}` : null,
            followers_count: 0,
            following_count: 0,
            statuses_count: 0,
            last_status_at: null,
            emojis: [],
            fields: walletLines.flatMap(line => {
                const parts = line.split(': ');
                const coin = parts[0].toUpperCase();
                const addr = parts[1];
                const resFields = [{ name: coin, value: addr, verified_at: null }];
                if (coin === 'XMR') {
                    resFields.push({ name: 'Monero', value: addr, verified_at: null });
                }
                return resFields;
            })
        });
    } catch (err) {
        console.error('Mastodon Emulation Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

app.put('/api/me/handle', authenticateToken, async (req, res) => {
    try {
        const { enabled_currencies } = req.body;
        if (!Array.isArray(enabled_currencies)) {
            return res.status(400).json({ error: 'Invalid config' });
        }
        await dbRun('UPDATE users SET handle_config = ? WHERE id = ?', [JSON.stringify({ enabled_currencies }), req.user.userId]);
        profileCache.del(`user:${req.user.username}`);
        res.json({ message: 'Handle configuration updated' });
    } catch (err) {
        console.error('Handle Update Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});
moneroMonitor.init();
app.get('/api/dev-fund-status', (req, res) => {
    res.json(moneroMonitor.getStatus());
});

app.post('/api/explorer/rpc', async (req, res) => {
    try {
        const { method, params } = req.body;

        // Whitelist of safe read-only RPC methods
        const ALLOWED_RPC_METHODS = [
            'get_block_count', 'on_get_block_hash', 'get_block_header_by_hash',
            'get_block_header_by_height', 'get_block_headers_range', 'get_block',
            'get_last_block_header', 'get_info', 'get_transactions',
            'get_alt_blocks_hashes', 'get_block_template', 'hard_fork_info',
            'get_fee_estimate', 'get_version', 'get_coinbase_tx_sum',
            'get_output_histogram', 'get_txpool_backlog', 'check_tx_key'
        ];

        if (!method || !ALLOWED_RPC_METHODS.includes(method)) {
            return res.status(400).json({ error: `Method not allowed: ${method}` });
        }

        const MONERO_NODE = process.env.MONERO_NODE_URL || 'https://node.sethforprivacy.com:443';

        // Clean URL (remove trailing slashes)
        const baseUrl = MONERO_NODE.replace(/\/+$/, '');

        // Protocol decision: Some methods are binary-json at /get_transactions, others are JSON-RPC at /json_rpc
        const isJsonRpc = method !== 'get_transactions';
        const targetUrl = isJsonRpc ? `${baseUrl}/json_rpc` : `${baseUrl}/get_transactions`;

        const payload = isJsonRpc ? {
            jsonrpc: "2.0",
            id: "0",
            method: method,
            params: params
        } : params;

        const response = await axios.post(targetUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (!isJsonRpc) {
            return res.json({ result: response.data });
        }

        res.json(response.data);
    } catch (error) {
        console.error('Explorer RPC Error:', error.message);
        res.status(500).json({ error: 'Failed to communicate with Monero Node' });
    }
});
// ---------------------------------


// --- USER SETTINGS ---
app.put('/api/me/notifications', authenticateToken, async (req, res) => {
    try {
        const { email, enabled } = req.body;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        await dbRun('UPDATE users SET notification_email = ?, email_notifications = ? WHERE id = ?',
            [email || null, enabled ? 1 : 0, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- MONERO PAYMENT PROOF VERIFICATION ---
app.post('/api/store/verify-payment', authenticateToken, async (req, res) => {
    try {
        const { txid, tx_key, address, expected_amount } = req.body;
        if (!txid || !tx_key || !address) {
            return res.status(400).json({ error: 'txid, tx_key, and address are required' });
        }

        const MONERO_NODE = process.env.MONERO_NODE_URL || process.env.MONERO_WALLET_RPC_URL || 'https://node.sethforprivacy.com:443';
        const baseUrl = MONERO_NODE.replace(/\/+$/, '');

        const response = await axios.post(`${baseUrl}/json_rpc`, {
            jsonrpc: '2.0',
            id: '0',
            method: 'check_tx_key',
            params: { txid: txid.trim(), tx_key: tx_key.trim(), address: address.trim() }
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const result = response.data?.result;
        if (!result) {
            return res.status(400).json({ error: 'Invalid response from Monero node', verified: false });
        }

        const receivedXmr = (result.received || 0) / 1e12;
        const expectedXmr = parseFloat(expected_amount) || 0;
        const verified = receivedXmr >= expectedXmr && receivedXmr > 0;

        res.json({
            verified,
            received_xmr: receivedXmr.toFixed(12),
            confirmations: result.confirmations || 0,
            in_pool: result.in_pool || false
        });
    } catch (err) {
        console.error('Payment Verify Error:', err.message);
        res.status(500).json({ error: 'Failed to verify payment on-chain', verified: false });
    }
});

// --- ANALYTICS (Zero-Tracking: no IP, no user agent, just counters) ---
const clickLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyGenerator: rateLimitKey, message: { error: 'Rate limited' } });
app.post('/api/analytics/click/:linkId', clickLimiter, async (req, res) => {
    try {
        const link = await dbGet('SELECT id FROM links WHERE id = ?', [req.params.linkId]);
        if (!link) return res.status(404).json({ error: 'Link not found' });
        await dbRun('INSERT INTO link_clicks (link_id) VALUES (?)', [link.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.get('/api/me/analytics', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet('SELECT profile_views FROM users WHERE id = ?', [req.user.userId]);
        const linkClicks = await dbAll(
            `SELECT l.id, l.title, l.url, COUNT(lc.id) as clicks
             FROM links l LEFT JOIN link_clicks lc ON l.id = lc.link_id
             WHERE l.user_id = ? GROUP BY l.id ORDER BY clicks DESC`,
            [req.user.userId]
        );
        res.json({ profile_views: user?.profile_views || 0, link_clicks: linkClicks });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// --- NOTIFICATION SUMMARY ---
app.get('/api/me/notifications/summary', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const storeOrders = await dbGet("SELECT COUNT(*) as count FROM store_orders WHERE seller_id = ? AND status IN ('pending', 'paid')", [userId]);
        const unreadMessages = await dbGet('SELECT COUNT(*) as count FROM encrypted_messages WHERE recipient_user_id = ? AND is_read = 0', [userId]);
        const deadmanActive = await dbGet('SELECT COUNT(*) as count FROM dead_mans_switches WHERE user_id = ? AND is_active = 1', [userId]);
        // Direct PGP DMs from other users. Separate from contact-form messages so the
        // dashboard can show a dedicated counter for inbound peer-to-peer chat.
        const pgpDms = await dbGet('SELECT COUNT(*) as count FROM pgp_messages WHERE to_user_id = ? AND read_at IS NULL', [userId]);
        res.json({
            store_orders: storeOrders?.count || 0,
            unread_messages: unreadMessages?.count || 0,
            deadman_active: deadmanActive?.count || 0,
            pgp_dms_unread: pgpDms?.count || 0,
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// FEDERATION STATUS + OPENALIAS WALLET PICKER
app.get('/api/me/federation', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await dbGet(
            'SELECT id, username, nostr_pubkey, mastodon_handle, pgp_public_key, openalias_wallet_id FROM users WHERE id = ?',
            [userId]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        const xmrWallets = await dbAll(
            "SELECT id, label, address FROM wallets WHERE user_id = ? AND currency = 'XMR' AND address IS NOT NULL AND length(address) IN (95,106) AND substr(address,1,1) IN ('4','8') ORDER BY id ASC",
            [userId]
        );

        // resolve "active" wallet for OpenAlias: explicit selection wins; else first.
        const selectedId = user.openalias_wallet_id;
        const activeWallet = xmrWallets.find(w => w.id === selectedId) || xmrWallets[0] || null;

        res.json({
            username: user.username,
            domain: req.headers.host || 'goxmr.click',
            openalias: {
                active: !!activeWallet,
                handle: `${user.username.toLowerCase()}@goxmr.click`,
                selected_wallet_id: activeWallet ? activeWallet.id : null,
                wallets: xmrWallets,
            },
            nostr: {
                active: !!user.nostr_pubkey,
                pubkey: user.nostr_pubkey || null,
                handle: `${user.username.toLowerCase()}@goxmr.click`,
            },
            mastodon: {
                active: !!user.mastodon_handle,
                external_handle: user.mastodon_handle || null,
                handle: `${user.username.toLowerCase()}@goxmr.click`,
            },
            pgp: {
                active: !!user.pgp_public_key,
                fingerprint_hint: user.pgp_public_key ? user.pgp_public_key.slice(0, 80) + '…' : null,
            },
        });
    } catch (err) {
        console.error('[FEDERATION]', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Pick which XMR wallet powers the OpenAlias TXT. Re-syncs PowerDNS so the
// change is live in DNS the moment the response returns.
app.put('/api/me/openalias', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { wallet_id } = req.body;
        const id = wallet_id === null || wallet_id === undefined ? null : parseInt(wallet_id, 10);
        if (id !== null && isNaN(id)) return res.status(400).json({ error: 'wallet_id must be an integer or null' });

        // Verify the wallet exists and belongs to this user (if non-null).
        let address = null;
        if (id !== null) {
            const w = await dbGet(
                "SELECT address FROM wallets WHERE id = ? AND user_id = ? AND currency = 'XMR'",
                [id, userId]
            );
            if (!w) return res.status(400).json({ error: 'wallet not found or not yours' });
            address = w.address;
        } else {
            // null means "auto" — use the first XMR wallet
            const w = await dbGet(
                "SELECT address FROM wallets WHERE user_id = ? AND currency = 'XMR' ORDER BY id ASC LIMIT 1",
                [userId]
            );
            address = w?.address || null;
        }
        await dbRun('UPDATE users SET openalias_wallet_id = ? WHERE id = ?', [id, userId]);

        // Push the new address to PowerDNS immediately
        try {
            const { syncUserOpenAlias } = require('./openaliasSync');
            const user = await dbGet('SELECT username FROM users WHERE id = ?', [userId]);
            await syncUserOpenAlias(user.username, address);
        } catch (syncErr) {
            console.warn('[OPENALIAS_SYNC] PUT failed:', syncErr.message);
        }
        res.json({ success: true, wallet_id: id, address });
    } catch (err) {
        console.error('[OPENALIAS_PUT]', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// ============================================
// STORE API ENDPOINTS
// ============================================
const storeEndpoints = require('./store-endpoints');

storeEndpoints.addVerifyPasswordEndpoint(app, authenticateToken, dbGet);
storeEndpoints.addStoreSetupEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addStoreConfigEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addGetStoreConfigEndpoint(app, dbGet, dbAll);
storeEndpoints.addCreateProductEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addListProductsEndpoint(app, dbGet, dbAll);
storeEndpoints.addGetProductEndpoint(app, dbGet, dbAll, dbRun);
storeEndpoints.addUnlockProductEndpoint(app, dbGet, dbRun);
storeEndpoints.addUpdateProductEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addDeleteProductEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addCreateOrderEndpoint(app, dbRun, dbGet, moneroMonitor, mailer);
storeEndpoints.addGetMyOrdersEndpoint(app, authenticateToken, dbAll);
storeEndpoints.addUpdateOrderStatusEndpoint(app, authenticateToken, dbRun, dbGet, mailer);
storeEndpoints.addDownloadDigitalContentEndpoint(app, dbGet, dbRun, dbAll);
storeEndpoints.addCreateReviewEndpoint(app, authenticateToken, dbRun, dbGet);
storeEndpoints.addGetReviewsEndpoint(app, dbAll);
storeEndpoints.addStoreNotificationsEndpoint(app, authenticateToken, dbAll);
storeEndpoints.addGlobalListingsEndpoint(app, dbAll);
storeEndpoints.addMarketEndpoint(app, dbAll);
storeEndpoints.addSubmitPaymentProofEndpoint(app, dbRun, dbGet, authLimiter, mailer);
storeEndpoints.addTrackOrderEndpoint(app, dbGet, dbAll);
// Federated identity hub (NIP-05 / WebFinger / OpenAlias)
addFederationRoutes(app, dbGet);
// PGP direct messages (E2E, server only sees ciphertext)
addPgpDmRoutes(app, authenticateToken, dbGet, dbAll, dbRun);
// Self-destruct timer for sovereign-identity wipe
addSelfDestructRoutes(app, authenticateToken, dbGet, dbRun);
startSelfDestructSweeper(dbAll, dbRun).catch(err => console.error('[SELF_DESTRUCT_BOOT]', err));
// CSRF token issue endpoint. Per-route csrfProtect is opt-in.
const { registerCsrfEndpoint } = require('./csrf');
registerCsrfEndpoint(app);
// Public status snapshot, no auth, no per-caller fields.
app.get('/api/status', async (req, res) => {
    try {
        const userCount = await new Promise((resolve, reject) =>
            db.get('SELECT COUNT(*) as n FROM users', (err, row) => err ? reject(err) : resolve(row?.n || 0))
        );
        res.json({
            ok: true,
            uptime_seconds: Math.floor(process.uptime()),
            users: userCount,
            monero: moneroMonitor ? moneroMonitor.getStatus() : { message: 'monitor offline' },
            tor_onion: '5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion',
            generated_at: new Date().toISOString(),
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'status unavailable' });
    }
});
console.log('Store API endpoints registered');

// ---- MIGRATION ENDPOINT (hit once after deploy) ----
app.get('/api/run-migrations', async (req, res) => {
    const results = [];
    const migrations = [
        // store_config
        `ALTER TABLE store_config ADD COLUMN is_verified INTEGER DEFAULT 0`,
        `ALTER TABLE store_config ADD COLUMN store_name TEXT`,
        `ALTER TABLE store_config ADD COLUMN store_bio TEXT`,
        `ALTER TABLE store_config ADD COLUMN store_banner TEXT`,
        `ALTER TABLE store_config ADD COLUMN monero_address TEXT`,
        `ALTER TABLE store_config ADD COLUMN encrypted_view_key TEXT`,
        `ALTER TABLE store_config ADD COLUMN auto_verify INTEGER DEFAULT 0`,
        `ALTER TABLE store_config ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`,
        // store_orders
        `ALTER TABLE store_orders ADD COLUMN buyer_id INTEGER`,
        `ALTER TABLE store_orders ADD COLUMN seller_id INTEGER`,
        `ALTER TABLE store_orders ADD COLUMN order_code TEXT`,
        `ALTER TABLE store_orders ADD COLUMN encrypted_data TEXT`,
        `ALTER TABLE store_orders ADD COLUMN tx_hash TEXT`,
        `ALTER TABLE store_orders ADD COLUMN payment_address TEXT`,
        `ALTER TABLE store_orders ADD COLUMN buyer_proof TEXT`,
        `ALTER TABLE store_orders ADD COLUMN price_xmr REAL`,
        `ALTER TABLE store_orders ADD COLUMN status TEXT DEFAULT 'pending'`,
        `ALTER TABLE store_orders ADD COLUMN completed_at TEXT`,
        `ALTER TABLE store_orders ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`,
        `ALTER TABLE store_orders ADD COLUMN payment_subaddress_index INTEGER`,
        // store_products
        `ALTER TABLE store_products ADD COLUMN name TEXT`,
        `ALTER TABLE store_products ADD COLUMN description TEXT`,
        `ALTER TABLE store_products ADD COLUMN visibility TEXT DEFAULT 'public'`,
        `ALTER TABLE store_products ADD COLUMN views INTEGER DEFAULT 0`,
        `ALTER TABLE store_products ADD COLUMN sales INTEGER DEFAULT 0`,
        `ALTER TABLE store_products ADD COLUMN thumbnail_url TEXT`,
        `ALTER TABLE store_products ADD COLUMN category TEXT`,
        // store_reviews
        `ALTER TABLE store_reviews ADD COLUMN buyer_id INTEGER`,
        `ALTER TABLE store_reviews ADD COLUMN is_verified INTEGER DEFAULT 1`,
        // encrypted_messages
        `CREATE TABLE IF NOT EXISTS encrypted_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_user_id INTEGER NOT NULL, sender_name TEXT, encrypted_content TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(recipient_user_id) REFERENCES users(id))`,
        // signals
        `CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY AUTOINCREMENT, short_code TEXT UNIQUE NOT NULL, original_url TEXT NOT NULL, user_id INTEGER, is_active INTEGER DEFAULT 1, visit_count INTEGER DEFAULT 0, password_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id))`,
        // drops
        `CREATE TABLE IF NOT EXISTS drops (id INTEGER PRIMARY KEY AUTOINCREMENT, drop_code TEXT UNIQUE NOT NULL, encrypted_content TEXT NOT NULL, user_id INTEGER, encryption_method TEXT DEFAULT 'AES', burn_after_read INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id))`,
        // dead_mans_switches
        `CREATE TABLE IF NOT EXISTS dead_mans_switches (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, encrypted_content TEXT NOT NULL, encryption_method TEXT DEFAULT 'AES', recipient_code TEXT, heartbeat_interval_days INTEGER DEFAULT 30, last_heartbeat TEXT DEFAULT CURRENT_TIMESTAMP, next_trigger_at TEXT, is_active INTEGER DEFAULT 1, is_triggered INTEGER DEFAULT 0, triggered_drop_code TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`,
        // indexes
        `CREATE INDEX IF NOT EXISTS idx_orders_buyer ON store_orders(buyer_id)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_seller ON store_orders(seller_id)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_code ON store_orders(order_code)`,
        `CREATE INDEX IF NOT EXISTS idx_products_user ON store_products(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_products_category ON store_products(category)`,
    ];

    for (const sql of migrations) {
        try {
            await dbRun(sql);
            results.push({ sql: sql.substring(0, 60) + '...', status: 'OK' });
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('duplicate column') || msg.includes('already exists')) {
                results.push({ sql: sql.substring(0, 60) + '...', status: 'SKIP (exists)' });
            } else {
                results.push({ sql: sql.substring(0, 60) + '...', status: 'ERROR: ' + msg });
            }
        }
    }

    const errors = results.filter(r => r.status.startsWith('ERROR'));
    res.json({
        success: errors.length === 0,
        total: results.length,
        applied: results.filter(r => r.status === 'OK').length,
        skipped: results.filter(r => r.status.includes('SKIP')).length,
        errors: errors.length,
        details: results
    });
});

// Production: Serve static files from the 'dist' directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Rewrite <user>.goxmr.click requests to /<user> so React Router lands on
// PublicProfile. Reserved subdomains and asset paths pass through unchanged.
const SUBDOMAIN_BLOCKLIST = new Set([
    'www', 'api', 'mail', 'ns1', 'ns2', 'cpanel', 'webmail', 'webdisk',
    'autoconfig', 'autodiscover', 'cpcalendars', 'cpcontacts', 'whm', 'ftp',
    '_dmarc', '_carddav', '_caldav', '_carddavs', '_caldavs', '_autodiscover',
]);
app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase().split(':')[0];
    if (!host.endsWith('.goxmr.click') || host === 'goxmr.click') return next();
    const sub = host.slice(0, -'.goxmr.click'.length);
    if (!sub || sub.includes('.') || SUBDOMAIN_BLOCKLIST.has(sub)) return next();
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/') ||
        req.url.startsWith('/assets/') || req.url.startsWith('/.well-known/')) {
        return next();
    }
    if (req.url === '/' || req.url === '') {
        req.url = '/' + sub;
    }
    next();
});

// Handle React Router SPA navigation
app.get('*', (req, res) => {
    // If the request is for an API route that wasn't caught, return 404
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // Otherwise serve index.html
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found. Run npm run build.');
    }
});
// --- DEAD MAN'S SWITCH BACKGROUND TASK ---
setInterval(async () => {
    try {
        const triggered = await dbAll(
            "SELECT * FROM dead_mans_switches WHERE is_active = 1 AND is_triggered = 0 AND next_trigger_at < datetime('now')"
        );
        for (const sw of triggered) {
            const dropCode = generateShortCode(8);
            // Create a public drop with the encrypted content (expires in 30 days)
            await dbRun(
                'INSERT INTO drops (drop_code, encrypted_content, user_id, encryption_method, burn_after_read, expires_at) VALUES (?, ?, ?, ?, 0, ?)',
                [dropCode, sw.encrypted_content, sw.user_id, sw.encryption_method,
                 new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()]
            );
            await dbRun(
                'UPDATE dead_mans_switches SET is_triggered = 1, is_active = 0, triggered_drop_code = ? WHERE id = ?',
                [dropCode, sw.id]
            );
            console.log(`[DEADMAN] Switch #${sw.id} triggered. Drop code: ${dropCode}`);
        }
    } catch (err) {
        console.error('[DEADMAN] Background check error:', err.message);
    }
}, 15 * 60 * 1000); // Every 15 minutes

// Last-resort error handler. Any uncaught throw in a route lands here.
// Emits a correlation ID the user can quote without leaking the stack.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const id = logError('UNCAUGHT', err, {
        method: req.method, path: req.path, ip: redactIp(req),
        userId: req.user?.userId,
    });
    // CORS rejections from the cors() middleware throw a generic Error here.
    // Surface 403 for those, generic 500 for everything else.
    const status = /CORS/i.test(err?.message || '') ? 403 : 500;
    res.status(status).json({ error: status === 403 ? 'Access Denied' : 'Server error', id });
});

process.on('unhandledRejection', (reason) => {
    logError('UNHANDLED_REJECTION', reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
    logError('UNCAUGHT_EXCEPTION', err);
});

app.disable('x-powered-by');

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GOXMR Server running on port ${PORT} (0.0.0.0)`);
});

module.exports = app;