// Merchant auth: bcrypt-cost-12 passwords, API keys with prefix + hashed body.
// API keys never round-trip: shown once on creation, then user has to regenerate
// to recover. Keeps the gateway promise of "non-custodial" honest at the meta
// layer too — we can't help you if you lose the key.

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const API_KEY_PREFIX = 'gxp';   // GoXMR Pay
const BCRYPT_COST = 12;

function generateApiKey(isTestnet) {
    const env = isTestnet ? 'test' : 'live';
    const random = crypto.randomBytes(24).toString('base64url');
    return `${API_KEY_PREFIX}_${env}_${random}`;
}

async function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function maskApiKey(key) {
    if (!key || key.length < 16) return '****';
    return key.slice(0, 12) + '...' + key.slice(-4);
}

async function hashPassword(plain) {
    const salt = await bcrypt.genSalt(BCRYPT_COST);
    return bcrypt.hash(plain, salt);
}

async function verifyPassword(plain, hash) {
    if (!hash) return false;
    return bcrypt.compare(plain, hash);
}

// Webhook secret: 32-byte random, used for HMAC-SHA256(payload).
function generateWebhookSecret() {
    return 'whsec_' + crypto.randomBytes(32).toString('base64url');
}

function signWebhook(payload, secret) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Middleware: authenticate a request via Bearer API key, populate req.merchant.
function apiKeyAuth(dbGet) {
    return async (req, res, next) => {
        try {
            const auth = req.headers['authorization'];
            const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
            if (!token) return res.status(401).json({ error: 'Missing Bearer API key' });
            const hashed = await hashApiKey(token);
            const merchant = await dbGet('SELECT * FROM pay_merchants WHERE api_key_hash = ? AND is_active = 1', [hashed]);
            if (!merchant) return res.status(401).json({ error: 'Invalid or revoked API key' });
            req.merchant = merchant;
            next();
        } catch (err) {
            res.status(500).json({ error: 'Auth error' });
        }
    };
}

module.exports = {
    generateApiKey, hashApiKey, maskApiKey,
    hashPassword, verifyPassword,
    generateWebhookSecret, signWebhook,
    apiKeyAuth,
};
