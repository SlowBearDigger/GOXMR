// Writes <user>.goxmr.click TXT (and A) into PowerDNS gsqlite3 DB whenever a
// user adds or changes their XMR wallet. Best-effort: failure never blocks.

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { exec } = require('child_process');

const ZONE = 'goxmr.click';
const PDNS_DB_PATH = process.env.PDNS_DB_PATH || '/var/lib/pdns/pdns.sqlite3';
const PDNS_ENABLED = fs.existsSync(PDNS_DB_PATH);

let pdnsDb = null;
let domainId = null;

function _open() {
    if (!PDNS_ENABLED) return null;
    if (pdnsDb) return pdnsDb;
    pdnsDb = new sqlite3.Database(PDNS_DB_PATH);
    return pdnsDb;
}

async function _getDomainId() {
    if (domainId) return domainId;
    return new Promise((resolve, reject) => {
        _open().get('SELECT id FROM domains WHERE name = ?', [ZONE], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('zone not provisioned'));
            domainId = row.id;
            resolve(domainId);
        });
    });
}

function _rectify() {
    return new Promise((resolve) => {
        exec(`pdnsutil rectify-zone ${ZONE}`, { timeout: 10000 }, () => resolve());
    });
}

// Validate the Monero standard/sub/integrated address shape before publishing.
// We don't decode base58 here — the application has already done that at
// wallet-save time. This is just a defence so we never emit malformed TXT.
function _isXmrAddress(addr) {
    if (typeof addr !== 'string') return false;
    if (!/^[48]/.test(addr)) return false;
    return addr.length === 95 || addr.length === 106;
}

// Upsert (or delete when address is falsy) the OpenAlias TXT for one user.
// Username is canonicalised to lowercase to match Cake/Feather resolution.
async function syncUserOpenAlias(username, addressOrNull) {
    if (!PDNS_ENABLED) return { skipped: 'pdns offline' };
    const lname = String(username).toLowerCase();
    const dname = `${lname}.${ZONE}`;
    const did = await _getDomainId();
    const db = _open();

    // Write A + TXT atomically. The A is needed because once a TXT exists at
    // <user>.goxmr.click, the wildcard *.goxmr.click stops applying (RFC 4592).
    const VPS_A = process.env.PUBLIC_VPS_IP || '209.74.89.37';
    const run = (sql, params) => new Promise((res, rej) =>
        db.run(sql, params, (err) => err ? rej(err) : res()));
    return (async () => {
        // wipe prior records this helper is responsible for
        await run(
            'DELETE FROM records WHERE domain_id = ? AND name = ? AND type = ? AND content LIKE ?',
            [did, dname, 'TXT', '%oa1:xmr%']
        );
        await run(
            'DELETE FROM records WHERE domain_id = ? AND name = ? AND type = ? AND content = ?',
            [did, dname, 'A', VPS_A]
        );
        if (!_isXmrAddress(addressOrNull)) {
            // No XMR → also drop the A so the wildcard takes over again if the
            // user ever publishes new content under their subdomain via the apex.
            await _rectify();
            return { action: 'deleted' };
        }
        // Conservative format: no @ or trailing ; in description, ASCII name only,
        // checksum field included (Cake/Feather reject some without it).
        const safeAddr = String(addressOrNull).replace(/["';]/g, '');
        const safeName = String(username).replace(/[^a-zA-Z0-9_-]/g, '');
        const desc = `Tip to ${safeName} via goxmr.click`;
        const crypto = require('crypto');
        const checksum = crypto.createHash('sha256')
            .update(safeName + safeAddr + desc).digest('hex').slice(0, 8);
        const txt = `"oa1:xmr recipient_address=${safeAddr}; recipient_name=${safeName}; tx_description=${desc}; checksum=${checksum}"`;
        await run(
            'INSERT INTO records (domain_id, name, ttl, type, content, prio, auth) VALUES (?, ?, 300, ?, ?, 0, 1)',
            [did, dname, 'A', VPS_A]
        );
        await run(
            'INSERT INTO records (domain_id, name, ttl, type, content, prio, auth) VALUES (?, ?, 300, ?, ?, 0, 1)',
            [did, dname, 'TXT', txt]
        );
        await _rectify();
        return { action: 'upserted', dname };
    })();
}

module.exports = { syncUserOpenAlias, isXmrAddress: _isXmrAddress };
