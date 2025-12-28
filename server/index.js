const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
console.log('📦 Database initialized, checking schema...');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const { createChallenge, verifySolution } = require('altcha-lib');
const crypto = require('crypto');

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



console.log('--- ENV DEBUG ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONERO_WALLET_ADDRESS exists:', !!process.env.MONERO_WALLET_ADDRESS);
console.log('MONERO_VIEW_KEY exists:', !!process.env.MONERO_VIEW_KEY);
console.log('--- END ENV DEBUG ---');
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
    'https://www.goxmr.click'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(/[\s,]+/) // Split by comma OR space
    : defaultOrigins;
console.log(`[DEBUG] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[DEBUG] JWT_SECRET present: ${!!process.env.JWT_SECRET}`);

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL] JWT_SECRET NOT SET IN PRODUCTION. EXITING.');
    // Debug: list all env keys to see what is visible (safe)
    console.log('[DEBUG] Visible Env Keys:', Object.keys(process.env).join(', '));
    process.exit(1);
}
const challengeStore = new Map();
const pgpChallengeStore = new Map(); // Store for PGP challenges
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'goxmr_dev_secret_unsafe';
app.use((req, res, next) => {

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${new Date().toISOString()} [${req.method}] ${req.url} - ${ip.substring(0, 8)}...`);
    next();
});
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
            "worker-src": ["'self'", "blob:"],
            "child-src": ["'self'", "blob:"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "font-src": ["'self'", "data:"],
            "img-src": ["'self'", "data:", "blob:", "https://goxmr.click", "https://upload.wikimedia.org", "https://assets.coingecko.com", "https://www.getmonero.org"],
            "connect-src": ["'self'", "blob:", "https://api.coingecko.com", "https://node.sethforprivacy.com:443", "https://node.sethforprivacy.com"]
        }
    }
}));
app.use(cors({
    origin: function (origin, callback) {

        if (!origin) {
            // Allow requests with no origin (like mobile apps, curl, or direct browser navigation)
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'CORS: Unauthorized domain.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
const botHoneypot = (req, res, next) => {
    const { website_id_verify, _bot_check } = req.body;
    if (website_id_verify || _bot_check) {
        console.warn(`[DEFENSE] Honeypot triggered by IP: ${req.ip}. Likely bot activity.`);

        return res.status(400).json({ error: "Bad Request" }); // Generic error to hide honeypot logic
    }
    next();
    next();
};

// --- ANTI-SCRAPING & BOT DEFENSE ---
const antiScrapingMiddleware = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const origin = req.get('Origin');
    const referer = req.get('Referer');

    // 1. Block known bot User-Agents
    const blockedAgents = /curl|wget|python-requests|scrapy|httpie|postman|insomnia/i;
    if (blockedAgents.test(userAgent)) {
        console.warn(`[DEFENSE] Blocked Tool User-Agent: ${userAgent} from ${req.ip}`);
        return res.status(403).json({ error: "Access Denied: Automated tools not allowed." });
    }

    // 2. Strict Origin/Referer Check for API endpoints (excluding simple GETs if needed, but hardening here)
    // We allow requests if they have a valid Origin matching our allowed list, OR if it's a browser navigation (complex to detect perfectly, but we default to blocking API abuse)
    const isApiRequest = req.path.startsWith('/api/');

    if (isApiRequest) {
        // If Origin is present, it MUST be allowed
        if (origin && !allowedOrigins.includes(origin)) {
            console.warn(`[DEFENSE] Blocked Origin: ${origin}`);
            return res.status(403).json({ error: "Access Denied" });
        }

        // For critical state-changing methods, require Origin or Referer
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            const validOrigin = origin && allowedOrigins.includes(origin);
            const validReferer = referer && allowedOrigins.some(allowed => referer.startsWith(allowed));

            if (!validOrigin && !validReferer) {
                console.warn(`[DEFENSE] Blocked Headless/Script Request (No Origin/Referer)`);
                return res.status(403).json({ error: "Access Denied: Browser required." });
            }
        }
    }

    next();
};
app.use(antiScrapingMiddleware);

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Security: Too many requests." }
});
const authLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Security: Access attempts temporarily blocked. Try again in 30 minutes." }
});
app.use('/api', apiLimiter);
const profileCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.2.5-DEBUG-FIX', port: PORT });
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

// ALTCHA VERIFICATION MIDDLEWARE
const verifyAltcha = async (req, res, next) => {
    const { altcha } = req.body;
    if (!altcha) {
        return res.status(401).json({ error: 'Security verification required (Captcha missing).' });
    }
    try {
        const isValid = await verifySolution(altcha, ALTCHA_HMAC_KEY);
        if (!isValid) {
            return res.status(401).json({ error: 'Security verification failed (Invalid Captcha).' });
        }
        next();
    } catch (err) {
        console.error('Altcha Verify Error:', err);
        res.status(500).json({ error: 'Security verification system error.' });
    }
};
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
    console.log(`[DEBUG] HIT check-username for: ${req.params.username}`);
    try {
        const username = req.params.username.toLowerCase();
        if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
            console.log(`[DEBUG] Invalid format: ${username}`);
            return res.json({ available: false, error: 'Invalid format (A-Z, 0-9, _ only)' });
        }
        const existingUser = await dbGet('SELECT id FROM users WHERE LOWER(username) = ?', [username]);
        console.log(`[DEBUG] Result for ${username}: ${!existingUser}`);
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
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB for audio, but we'll recommend small files
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|mpeg|mp3/;
        const extname = path.extname(file.originalname).toLowerCase();

        // Block double extensions (e.g., .php.jpg)
        if (file.originalname.split('.').length > 2) {
            const parts = file.originalname.split('.');
            // Allow normal names like my.image.jpg but block .php.jpg
            const dangerous = /php|sh|exe|bat|js|py/i;
            if (dangerous.test(parts[parts.length - 2])) {
                return cb(new Error("Security Block: Double extension detected."));
            }
        }

        const items = filetypes.test(extname);
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && items) {
            return cb(null, true);
        }
        cb(new Error("Error: Images or MP3 Only!"));
    }
});
app.use('/uploads', express.static('uploads'));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
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
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, banner_image, music_url, design_config, handle_config, recovery_hash, pgp_public_key, is_premium, premium_activated_at, created_at FROM users WHERE id = ?', [req.user.userId]);
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

        // Security: Limit number of items
        if ((links && links.length > 50) || (wallets && wallets.length > 20)) {
            return res.status(400).json({ error: 'Security: Too many profile items. Limit: 50 links, 20 wallets.' });
        }

        // Security: Validate design config size/structure
        if (design && JSON.stringify(design).length > 20000) {
            return res.status(400).json({ error: 'Design config too large' });
        }

        await dbRun('UPDATE users SET design_config = ? WHERE id = ?', [JSON.stringify(design), userId]);
        await dbRun('DELETE FROM links WHERE user_id = ?', [userId]);
        if (links && Array.isArray(links)) {
            for (const l of links) {
                // Security: Limit string lengths
                if (l.title?.length > 100 || l.url?.length > 500) continue;
                await dbRun('INSERT INTO links (user_id, type, title, url, icon) VALUES (?, ?, ?, ?, ?)', [userId, l.type, l.title, l.url, l.icon]);
            }
        }
        // Efficient Wallet Update to preserve IDs
        const existingWallets = await dbAll('SELECT * FROM wallets WHERE user_id = ?', [userId]);

        if (wallets && Array.isArray(wallets)) {
            for (const w of wallets) {
                if (w.label?.length > 100 || w.address?.length > 200) continue;

                // Try to find matching existing wallet to update instead of delete/re-insert
                const existing = existingWallets.find(ew => ew.currency === w.currency && ew.label === w.label);

                if (existing) {
                    await dbRun('UPDATE wallets SET address = ? WHERE id = ?', [w.address, existing.id]);
                    // Remove from list so we know it's handled
                    const idx = existingWallets.indexOf(existing);
                    if (idx > -1) existingWallets.splice(idx, 1);
                } else {
                    await dbRun('INSERT INTO wallets (user_id, currency, label, address) VALUES (?, ?, ?, ?)', [userId, w.currency, w.label, w.address]);
                }
            }
        }

        // Delete wallets that were NOT in the new list
        for (const ew of existingWallets) {
            await dbRun('DELETE FROM wallets WHERE id = ?', [ew.id]);
        }
        res.json({ message: 'Dashboard Deployed Successfully' });
        const user = await dbGet('SELECT username FROM users WHERE id = ?', [userId]);
        if (user) profileCache.del(`user:${user.username}`);
    } catch (err) {
        console.error('SYNC Error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
});
app.get('/api/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const cacheKey = `user:${username}`;
        const cachedData = profileCache.get(cacheKey);
        if (cachedData) {
            console.log(`[Cache] Serving ${username} from memory`);
            return res.json(cachedData);
        }
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, banner_image, music_url, design_config, created_at FROM users WHERE username = ?', [username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const links = await dbAll('SELECT * FROM links WHERE user_id = ?', [user.id]);
        const wallets = await dbAll('SELECT * FROM wallets WHERE user_id = ?', [user.id]);
        const profileData = {
            ...user,
            links,
            wallets,
            design: user.design_config ? JSON.parse(user.design_config) : null
        };
        profileCache.set(cacheKey, profileData);
        res.json(profileData);
    } catch (err) {
        console.error('API/USER Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});
app.put('/api/me', authenticateToken, async (req, res) => {
    try {
        const { display_name, bio } = req.body;

        // Security: Limit lengths
        if (display_name?.length > 50 || bio?.length > 500) {
            return res.status(400).json({ error: 'Display name (50 chars) or bio (500 chars) too long.' });
        }

        await dbRun('UPDATE users SET display_name = ?, bio = ? WHERE id = ?', [display_name, bio, req.user.userId]);
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
        console.log(`[UPLOAD] Processing upload for type: ${type} by user: ${req.user.username}`);
        if (!['profile', 'banner', 'qr_logo', 'audio'].includes(type)) {
            console.warn(`[UPLOAD] Invalid type requested: ${type}`);
            return res.status(400).json({ error: 'Invalid upload type' });
        }
        if (!req.file) {
            console.warn('[UPLOAD] No file received in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`[UPLOAD] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

        const originalPath = req.file.path;
        let fileUrl = '';

        if (type === 'audio') {
            const extension = path.extname(req.file.originalname).toLowerCase();
            const filename = `${req.file.filename.split('.')[0]}${extension}`;
            const targetPath = path.join(uploadDir, filename);
            fs.renameSync(originalPath, targetPath);
            fileUrl = `/uploads/${filename}`;

            console.log(`[UPLOAD] Updating DB for music_url to ${fileUrl}`);
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
                console.log(`[UPLOAD] Updating DB for ${column} (GIF) to ${fileUrl}`);
                await dbRun(`UPDATE users SET ${column} = ? WHERE id = ?`, [fileUrl, req.user.userId]);
                const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
                if (user) profileCache.del(`user:${user.username}`);
            }
        } else {
            const filename = `${req.file.filename.split('.')[0]}.webp`;
            const optimizedPath = path.join(uploadDir, filename);
            let sharpInstance = sharp(originalPath);
            if (type === 'banner') {
                sharpInstance = sharpInstance.resize(1500, 500, { fit: 'cover', position: 'center' });
            } else if (type === 'profile') {
                sharpInstance = sharpInstance.resize(500, 500, { fit: 'cover', position: 'center' });
            } else if (type === 'qr_logo') {
                sharpInstance = sharpInstance.resize(200, 200, { fit: 'inside' });
            }
            await sharpInstance
                .webp({ quality: 85 })
                .toFile(optimizedPath);
            fs.unlink(originalPath, (err) => {
                if (err) console.error('Failed to delete original upload:', err);
            });
            fileUrl = `/uploads/${filename}`;

            if (type !== 'qr_logo') {
                const column = type === 'profile' ? 'profile_image' : 'banner_image';
                console.log(`[UPLOAD] Updating DB for ${column} to ${fileUrl}`);
                await dbRun(`UPDATE users SET ${column} = ? WHERE id = ?`, [fileUrl, req.user.userId]);
                const user = await dbGet('SELECT username FROM users WHERE id = ?', [req.user.userId]);
                if (user) profileCache.del(`user:${user.username}`);
            }
        }
        console.log(`[UPLOAD] Success: ${fileUrl}`);
        res.json({ message: 'Upload successful', url: fileUrl });
    } catch (err) {
        console.error('Upload Optimization Error:', err);
        res.status(500).json({ error: 'Upload or optimization failed' });
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

        const user = await dbGet('SELECT pgp_public_key FROM users WHERE username = ?', [username]);
        if (!user || !user.pgp_public_key) {
            return res.status(404).json({ error: 'PGP not configured for this identity' });
        }

        const challenge = `GOXMR_AUTH_CHALLENGE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        pgpChallengeStore.set(username, { challenge, timestamp: Date.now() });

        // Challenges expire in 5 minutes
        setTimeout(() => pgpChallengeStore.delete(username), 5 * 60 * 1000);

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

        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
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
            pgpChallengeStore.delete(username);
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

// --- SIGNALS & DROPS API ---

function generateShortCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Create Signal (URL)
app.post('/api/tools/signal', verifyAltcha, async (req, res) => {
    try {
        const { url, password, customCode, expiresHours } = req.body;
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
                const existing = await dbGet('SELECT id FROM signals WHERE short_code = ?', [customCode]);
                if (existing) return res.status(400).json({ error: 'Custom alias already taken' });
                finalCode = customCode;
            }
            if (password) {
                const salt = await bcrypt.genSalt(10);
                passHash = await bcrypt.hash(password, salt);
            }
            if (expiresHours !== undefined) {
                expiry = expiresHours === 0 ? null : new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
            }
        }

        await dbRun('INSERT INTO signals (short_code, original_url, user_id, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
            [finalCode, url, userId, passHash, expiry]);

        res.json({ shortCode: finalCode, expiresAt: expiry });

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

// Resolver for Signals
app.get('/api/resolve/signal/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { password } = req.query;
        console.log(`[RESOLVER] Resolving code: ${code}`);

        const signal = await dbGet('SELECT * FROM signals WHERE short_code = ? COLLATE NOCASE AND is_active = 1', [code]);
        if (!signal) {
            console.log(`[RESOLVER] Signal not found (or inactive) for code: ${code}`);
            return res.status(404).json({ error: 'Signal not found' });
        }

        console.log(`[RESOLVER] Found key: ${signal.short_code}, Expires: ${signal.expires_at}, Now: ${new Date().toISOString()}`);

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
        res.json({ url: signal.original_url });

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

        // Return the encrypted blob
        res.json({
            content: drop.encrypted_content,
            method: drop.encryption_method,
            burnAfterRead: !!drop.burn_after_read
        });

        if (drop.burn_after_read) {
            // Self-destruct after serving
            await dbRun('DELETE FROM drops WHERE id = ?', [drop.id]);
        }

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

app.post('/api/register', authLimiter, botHoneypot, verifyAltcha, async (req, res) => {
    try {
        const { username, password, recovery_password, pgp_public_key } = req.body;
        if (!username || (!password && !pgp_public_key)) {
            return res.status(400).json({ error: 'Username and (Password or PGP Key) are required' });
        }
        if (password && password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        const salt = await bcrypt.genSalt(10);
        const hash = password ? await bcrypt.hash(password, salt) : 'PGP_ONLY_ACCOUNT_DISABLED_PASSWORD';
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
        console.error('Register Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/login', authLimiter, botHoneypot, verifyAltcha, async (req, res) => {
    try {
        console.log('Login Attempt Payload:', req.body);
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
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
            challengeStore.delete(userId);
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
            const user = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
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
        console.log('[DEBUG] Auth Verify Request:', {
            username,
            challengeKey,
            credentialId: body?.id
        });
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
        console.log('[DEBUG] Prepared Credential Object (v13.2.2):', {
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
            challengeStore.delete(challengeKey);
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
        const salt = await bcrypt.genSalt(10);
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
        updateQuery = updateQuery.slice(0, -2) + ' WHERE id = ?';
        params.push(userId);
        await dbRun(updateQuery, params);
        res.json({ message: 'Security credentials updated' });
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
app.post('/api/recover-access', botHoneypot, async (req, res) => {
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
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);
        await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
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
        const validPass = await bcrypt.compare(password, user.password_hash);
        const validRecovery = user.recovery_hash ? await bcrypt.compare(recoveryPassword, user.recovery_hash) : true;
        if (!validPass || !validRecovery) {
            return res.status(401).json({ error: 'Verification failed. Both passwords required for destruction.' });
        }
        await dbRun('DELETE FROM links WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM wallets WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM authenticators WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM users WHERE id = ?', [userId]);
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
        const [username, domain] = handle.split('@');

        // Basic check if user exists
        const user = await dbGet('SELECT id FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        res.setHeader('Content-Type', 'application/jrd+json; charset=utf-8');
        res.json({
            subject: `acct:${handle}`,
            links: [
                {
                    rel: 'http://webfinger.net/rel/profile-page',
                    type: 'text/html',
                    href: `${baseUrl}/${username}`
                },
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `${baseUrl}/api/v1/accounts/${username}`
                }
            ]
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.get('/api/v1/accounts/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, handle_config, design_config FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
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

// Production: Serve static files from the 'dist' directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`GOXMR Server running on port ${PORT} (0.0.0.0)`);
});

module.exports = app;