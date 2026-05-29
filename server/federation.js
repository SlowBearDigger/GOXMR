// OpenAlias HTTP fallback. The canonical OpenAlias spec uses DNS TXT records, but
// publishing an HTTP mirror at /.well-known/openalias/<handle>.txt lets users verify
// what their alias currently points to without dig/nslookup.
//
// NOTE: NIP-05 (Nostr) and WebFinger (Mastodon/ActivityPub) handlers are defined
// directly in server/index.js — pre-existing. This module only adds OpenAlias to
// complete the trio.

function addFederationRoutes(app, dbGet) {
    app.get('/.well-known/openalias/:handle.txt', async (req, res) => {
        try {
            const name = String(req.params.handle || '').toLowerCase();
            if (!/^[a-z0-9_]{1,30}$/.test(name)) {
                return res.status(404).type('text/plain').send('Not found');
            }
            const user = await dbGet(
                `SELECT u.username, s.monero_address
                 FROM users u
                 LEFT JOIN store_config s ON s.user_id = u.id
                 WHERE LOWER(u.username) = ?`,
                [name]
            );
            if (!user?.monero_address) return res.status(404).type('text/plain').send('Not found');
            const record = `oa1:xmr recipient_address=${user.monero_address}; recipient_name=${user.username}; tx_description=Donation via @${user.username};`;
            res.set('Cache-Control', 'public, max-age=300');
            res.type('text/plain').send(record);
        } catch (err) {
            console.error('[OPENALIAS] error:', err.message);
            res.status(500).type('text/plain').send('Error');
        }
    });
}

module.exports = { addFederationRoutes };
