// Self-destruct profile timer.
//
// User sets a future timestamp on their account. If they don't extend it (heartbeat)
// before that time, a background task wipes the profile content. We deliberately
// keep some references (orders, reviews referencing other parties) intact but
// detach them — the other party still sees their side, just with @[redacted].

function addSelfDestructRoutes(app, authenticateToken, dbGet, dbRun) {
    // Arm or update the timer. days = how many days from now.
    app.put('/api/me/self-destruct', authenticateToken, async (req, res) => {
        try {
            const days = Number(req.body?.days);
            if (!Number.isInteger(days) || days < 1 || days > 3650) {
                return res.status(400).json({ error: 'days must be an integer between 1 and 3650' });
            }
            const target = new Date(Date.now() + days * 86400 * 1000).toISOString();
            await dbRun('UPDATE users SET self_destruct_at = ? WHERE id = ?', [target, req.user.userId]);
            res.json({ success: true, self_destruct_at: target });
        } catch (err) {
            console.error('[SELF_DESTRUCT_SET] error:', err.message);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Heartbeat — resets timer back to its original interval, or to a new one
    app.post('/api/me/self-destruct/heartbeat', authenticateToken, async (req, res) => {
        try {
            const days = Number(req.body?.days) || 30;
            if (days < 1 || days > 3650) return res.status(400).json({ error: 'bad days' });
            const target = new Date(Date.now() + days * 86400 * 1000).toISOString();
            await dbRun('UPDATE users SET self_destruct_at = ? WHERE id = ?', [target, req.user.userId]);
            res.json({ success: true, self_destruct_at: target });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Disarm
    app.delete('/api/me/self-destruct', authenticateToken, async (req, res) => {
        try {
            await dbRun('UPDATE users SET self_destruct_at = NULL WHERE id = ?', [req.user.userId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Status
    app.get('/api/me/self-destruct', authenticateToken, async (req, res) => {
        try {
            const u = await dbGet('SELECT self_destruct_at FROM users WHERE id = ?', [req.user.userId]);
            res.json({ self_destruct_at: u?.self_destruct_at || null });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });
}

// Background sweep — runs every 30 minutes.
async function startSelfDestructSweeper(dbAll, dbRun) {
    async function tick() {
        try {
            const due = await dbAll(
                "SELECT id, username FROM users WHERE self_destruct_at IS NOT NULL AND self_destruct_at <= datetime('now')"
            );
            for (const u of due) {
                // Wipe user-owned content. We keep store_orders/store_reviews rows for the
                // other party's records but null the user link so the wiped user can't be
                // queried by id afterwards.
                await dbRun('DELETE FROM links WHERE user_id = ?', [u.id]);
                await dbRun('DELETE FROM wallets WHERE user_id = ?', [u.id]);
                await dbRun('DELETE FROM store_products WHERE user_id = ?', [u.id]);
                await dbRun('DELETE FROM store_config WHERE user_id = ?', [u.id]);
                await dbRun('DELETE FROM dead_mans_switches WHERE user_id = ?', [u.id]);
                await dbRun('DELETE FROM pgp_messages WHERE from_user_id = ? OR to_user_id = ?', [u.id, u.id]);
                await dbRun('UPDATE store_orders SET buyer_id = NULL WHERE buyer_id = ?', [u.id]);
                await dbRun('UPDATE store_orders SET seller_id = NULL WHERE seller_id = ?', [u.id]);
                await dbRun('UPDATE store_reviews SET buyer_id = NULL WHERE buyer_id = ?', [u.id]);
                // Tombstone the user row: keep the id so foreign keys still resolve, but
                // null out everything identifying.
                await dbRun(
                    `UPDATE users SET
                        username = 'wiped_' || id,
                        password_hash = '',
                        recovery_hash = NULL,
                        pgp_public_key = NULL,
                        nostr_pubkey = NULL,
                        mastodon_handle = NULL,
                        notification_email = NULL,
                        email_notifications = 0,
                        bio = NULL,
                        display_name = NULL,
                        profile_image = NULL,
                        banner_image = NULL,
                        design_config = NULL,
                        encrypted_bio = NULL,
                        encrypted_display_name = NULL,
                        self_destruct_at = NULL,
                        tokens_valid_after = datetime('now')
                     WHERE id = ?`,
                    [u.id]
                );
                console.warn(`[SELF_DESTRUCT] Wiped user ${u.username} (id=${u.id})`);
            }
        } catch (err) {
            console.error('[SELF_DESTRUCT_SWEEP] error:', err.message);
        }
    }
    // First sweep on boot, then every 30 minutes
    await tick();
    setInterval(tick, 30 * 60 * 1000);
}

module.exports = { addSelfDestructRoutes, startSelfDestructSweeper };
