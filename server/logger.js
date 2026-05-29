// Lightweight structured logger. Use logError to wrap any server-side error so
// each occurrence gets a correlation ID the client can quote when reporting issues.
//
// Usage:
//   const { logError } = require('./logger');
//   catch (err) {
//       const id = logError('[ROUTE_NAME]', err, { userId: req.user?.userId, ip: req.ip });
//       res.status(500).json({ error: 'Server error', id });
//   }

const crypto = require('crypto');

function newId() {
    // Short, URL-safe, low collision odds for the volume this app handles.
    return crypto.randomBytes(6).toString('base64url');
}

function logError(tag, err, context = {}) {
    const id = newId();
    const ts = new Date().toISOString();
    const safeCtx = {};
    for (const [k, v] of Object.entries(context || {})) {
        // Avoid leaking large objects or buffers into stdout.
        if (v == null) continue;
        if (typeof v === 'string') safeCtx[k] = v.length > 200 ? v.slice(0, 200) + '…' : v;
        else if (typeof v === 'number' || typeof v === 'boolean') safeCtx[k] = v;
        // skip objects/arrays — caller can stringify if they really want them logged
    }
    // One-line JSON for log aggregators; falls back to readable form for humans.
    try {
        console.error(JSON.stringify({
            level: 'error', ts, id, tag,
            msg: err?.message || String(err),
            ...safeCtx,
        }));
    } catch {
        console.error(`[${ts}] ${tag} (${id}):`, err?.message || err, safeCtx);
    }
    return id;
}

function logInfo(tag, msg, context = {}) {
    const ts = new Date().toISOString();
    try {
        console.log(JSON.stringify({ level: 'info', ts, tag, msg, ...context }));
    } catch {
        console.log(`[${ts}] ${tag}: ${msg}`, context);
    }
}

module.exports = { logError, logInfo, newId };
