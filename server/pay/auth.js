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

// payment-request signing (Ed25519). in scan_mode='client' the merchant holds
// the private signing key (generated in-browser, never sent to us) and signs each
// payment request; we store only the 32-byte public key and verify. a tampered
// gateway can't forge a signature for a swapped address, so a buyer/merchant who
// checks the signature against the pubkey published on the merchant's OWN domain
// detects the swap. node verifies a raw key once it's wrapped in the fixed SPKI
// DER prefix for Ed25519.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
function ed25519PubFromHex(hex) {
    const raw = Buffer.from(String(hex), 'hex');
    if (raw.length !== 32) throw new Error('ed25519 public key must be 32 bytes (64 hex)');
    return crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
}

function isValidSigningPubkey(hex) {
    return typeof hex === 'string' && /^[0-9a-f]{64}$/i.test(hex.trim());
}

// canonical string a merchant signs. amount pinned in atomic units (piconero) so
// float formatting can't change the bytes; fields are exactly what a swap attack
// would tamper — order id, amount, and the address funds land on.
function paymentRequestMessage({ order_id, amount_xmr, payment_address }) {
    const piconero = BigInt(Math.round(Number(amount_xmr) * 1e12)).toString();
    return `goxmr-pay/v1\n${order_id}\n${piconero}\n${payment_address}`;
}

// verify a hex Ed25519 signature over a message. never throws.
function verifyPaymentSignature(pubkeyHex, message, signatureHex) {
    try {
        if (!isValidSigningPubkey(pubkeyHex)) return false;
        const sig = Buffer.from(String(signatureHex), 'hex');
        if (sig.length !== 64) return false;
        return crypto.verify(null, Buffer.from(message, 'utf8'), ed25519PubFromHex(pubkeyHex), sig);
    } catch { return false; }
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
    isValidSigningPubkey, paymentRequestMessage, verifyPaymentSignature,
};
