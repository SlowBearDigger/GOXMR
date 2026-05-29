// PGP direct messages between GOXMR users.
//
// Trust model: sender encrypts the message in their browser with the recipient's
// PGP public key (which is already exposed via /api/user/:username). The server
// only sees opaque ciphertext, never plaintext. Recipient decrypts in their browser
// with the same private key they use elsewhere (we never receive it).
//
// Caps: 64KB ciphertext per message, 50 messages/hour/sender, 1000 stored per inbox.

const MAX_CIPHERTEXT = 64 * 1024;
const MAX_SUBJECT_LEN = 200;
const INBOX_CAP = 1000;

function addPgpDmRoutes(app, authenticateToken, dbGet, dbAll, dbRun) {
    // --- send ---
    app.post('/api/pgp/dm', authenticateToken, async (req, res) => {
        try {
            const { to_username, encrypted_payload, subject } = req.body;
            if (!to_username || typeof to_username !== 'string') {
                return res.status(400).json({ error: 'to_username is required' });
            }
            if (typeof encrypted_payload !== 'string' || !encrypted_payload.includes('BEGIN PGP MESSAGE')) {
                return res.status(400).json({ error: 'encrypted_payload must be an ASCII-armored PGP message' });
            }
            if (encrypted_payload.length > MAX_CIPHERTEXT) {
                return res.status(413).json({ error: 'Payload too large (max 64KB)' });
            }
            const cleanSubject = subject ? String(subject).slice(0, MAX_SUBJECT_LEN) : null;

            const recipient = await dbGet(
                'SELECT id, pgp_public_key FROM users WHERE LOWER(username) = LOWER(?)',
                [to_username]
            );
            if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
            if (!recipient.pgp_public_key) {
                return res.status(400).json({ error: 'Recipient has no PGP key configured — cannot accept encrypted messages' });
            }
            if (recipient.id === req.user.userId) {
                return res.status(400).json({ error: 'Cannot message yourself' });
            }

            // soft per-sender rate limit (50/hour); a real prod deploy should use Redis
            const recent = await dbGet(
                `SELECT COUNT(*) as n FROM pgp_messages
                 WHERE from_user_id = ? AND created_at > datetime('now', '-1 hour')`,
                [req.user.userId]
            );
            if (recent && recent.n >= 50) {
                return res.status(429).json({ error: 'Hourly send limit reached. Try again later.' });
            }

            const result = await dbRun(
                'INSERT INTO pgp_messages (from_user_id, to_user_id, encrypted_payload, subject) VALUES (?, ?, ?, ?)',
                [req.user.userId, recipient.id, encrypted_payload, cleanSubject]
            );

            // Trim recipient inbox to the latest INBOX_CAP messages
            await dbRun(
                `DELETE FROM pgp_messages WHERE to_user_id = ? AND id NOT IN (
                    SELECT id FROM pgp_messages WHERE to_user_id = ? ORDER BY created_at DESC LIMIT ?
                )`,
                [recipient.id, recipient.id, INBOX_CAP]
            );

            res.json({ success: true, id: result.lastID });
        } catch (err) {
            console.error('[PGP_DM_SEND] error:', err.message);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // --- inbox ---
    app.get('/api/pgp/dm/inbox', authenticateToken, async (req, res) => {
        try {
            const messages = await dbAll(
                `SELECT m.id, m.encrypted_payload, m.subject, m.read_at, m.created_at,
                        u.username as from_username
                 FROM pgp_messages m
                 LEFT JOIN users u ON u.id = m.from_user_id
                 WHERE m.to_user_id = ?
                 ORDER BY m.created_at DESC
                 LIMIT 200`,
                [req.user.userId]
            );
            const unread = messages.filter(m => !m.read_at).length;
            res.json({ messages, unread });
        } catch (err) {
            console.error('[PGP_DM_INBOX] error:', err.message);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // --- mark read ---
    app.put('/api/pgp/dm/:id/read', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!id) return res.status(400).json({ error: 'Bad id' });
            await dbRun(
                "UPDATE pgp_messages SET read_at = datetime('now') WHERE id = ? AND to_user_id = ? AND read_at IS NULL",
                [id, req.user.userId]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // --- delete ---
    app.delete('/api/pgp/dm/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!id) return res.status(400).json({ error: 'Bad id' });
            // Either sender or recipient can delete their copy
            await dbRun(
                'DELETE FROM pgp_messages WHERE id = ? AND (to_user_id = ? OR from_user_id = ?)',
                [id, req.user.userId, req.user.userId]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });
}

module.exports = { addPgpDmRoutes };
