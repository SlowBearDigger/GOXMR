// CSRF defence-in-depth. Stateless token signed with JWT_SECRET.
// Primary protection is Origin/Referer + CORS + Authorization-header auth
// (JWT in localStorage, not cookies). This is the belt-and-suspenders layer.

const crypto = require('crypto');

const TTL_SECONDS = 3600;

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET required for CSRF helper');
    return s;
}

// Token = `${exp}.${sig}` where sig = HMAC-SHA256(SECRET, `csrf|${exp}`).
function issueCsrfToken() {
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const payload = `csrf|${exp}`;
    const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    return `${exp}.${sig}`;
}

function verifyCsrfToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return false;
    const [expStr, sig] = token.split('.');
    const exp = parseInt(expStr, 10);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = crypto.createHmac('sha256', getSecret()).update(`csrf|${exp}`).digest('base64url');
    try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
        return false;
    }
}

// Middleware: enforces CSRF token on POST/PUT/PATCH/DELETE only.
function csrfProtect(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const token = req.get('X-CSRF-Token');
    if (!token || !verifyCsrfToken(token)) {
        return res.status(419).json({ error: 'CSRF token missing or expired. GET /api/csrf to refresh.' });
    }
    next();
}

function registerCsrfEndpoint(app) {
    app.get('/api/csrf', (req, res) => {
        res.json({ token: issueCsrfToken(), ttl: TTL_SECONDS });
    });
}

module.exports = { issueCsrfToken, verifyCsrfToken, csrfProtect, registerCsrfEndpoint };
