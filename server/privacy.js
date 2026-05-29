// IP handling: redactIp for logs (/24 prefix only), hmacIp for DB rows
// (HMAC-SHA256 with a server-only secret), rateLimitKey for express-rate-limit.
// Secret lives in IP_HASH_SECRET env var or auto-generated at .ip_hash_secret.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_FILE = path.join(__dirname, '.ip_hash_secret');

function loadOrCreateSecret() {
    if (process.env.IP_HASH_SECRET && process.env.IP_HASH_SECRET.length >= 32) {
        return process.env.IP_HASH_SECRET;
    }
    if (fs.existsSync(SECRET_FILE)) {
        const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
        if (s.length >= 32) return s;
    }
    const fresh = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(SECRET_FILE, fresh, { mode: 0o600 });
    } catch (e) {
        console.warn('[PRIVACY] Could not persist ip-hash secret to disk:', e.message);
    }
    return fresh;
}

const IP_SECRET = loadOrCreateSecret();

function _rawIp(req) {
    return (
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        ''
    );
}

// Returns IPv4 /24 prefix or IPv6 /64, suitable for logs.
function redactIp(req) {
    const ip = _rawIp(req);
    if (!ip) return 'unknown';
    // IPv4
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        const parts = ip.split('.');
        parts[3] = '0';
        return parts.join('.') + '/24';
    }
    // IPv4-mapped IPv6 like ::ffff:1.2.3.4
    const v4m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4m) {
        const parts = v4m[1].split('.');
        parts[3] = '0';
        return parts.join('.') + '/24';
    }
    // IPv6 — keep first 4 groups (64 bits) and zero the rest.
    if (ip.includes(':')) {
        const groups = ip.split(':').filter(Boolean).slice(0, 4);
        while (groups.length < 4) groups.push('0');
        return groups.join(':') + '::/64';
    }
    return 'unknown';
}

// HMAC-SHA256(IP, secret). Deterministic, irreversible without the secret.
function hmacIp(req) {
    const ip = _rawIp(req);
    if (!ip) return 'unknown';
    return crypto.createHmac('sha256', IP_SECRET).update(ip).digest('hex');
}

// Key generator for express-rate-limit. Bucket map never holds raw IPs.
function rateLimitKey(req) {
    return hmacIp(req);
}

module.exports = { redactIp, hmacIp, rateLimitKey };
