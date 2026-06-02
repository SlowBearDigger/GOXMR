// Periodic scan of pending gateway orders against the merchant's view key.
//
// Phase 1 keeps this simple: each merchant supplies a (Monero address +
// encrypted view key) pair. We don't run a wallet-rpc per merchant in this
// phase — that's Phase 2. Instead this scanner is a stub that:
//   1) Expires orders past their TTL
//   2) Re-queues webhook deliveries that need retry
//
// Real tx detection per merchant address requires either:
//   a) per-merchant monero-wallet-rpc spinning up on demand, or
//   b) a shared scanning daemon that takes (address, view_key) pairs
// We pick (b) in Phase 2 — for now this scaffolds the loop so the UI flows
// end-to-end and merchants can manually mark an order paid via webhook
// during integration testing.

const crypto = require('crypto');
const { signWebhook } = require('./auth');

function startPaymentScanner({ dbAll, dbRun, dbGet, logError }) {
    // Expire pending orders every minute
    setInterval(async () => {
        try {
            await dbRun(
                "UPDATE pay_orders SET status = 'expired' WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
            );
        } catch (err) {
            logError('PAY_EXPIRE', err);
        }
    }, 60 * 1000);

    // Webhook retry queue every 30 seconds
    setInterval(() => deliverPendingWebhooks({ dbAll, dbRun, dbGet, logError }).catch(() => {}), 30 * 1000);
}

// Build the signed payload for an order event and queue a delivery row.
async function queueWebhook({ dbGet, dbRun }, orderPk, event) {
    const o = await dbGet('SELECT * FROM pay_orders WHERE id = ?', [orderPk]);
    if (!o) return;
    const m = await dbGet('SELECT webhook_url FROM pay_merchants WHERE id = ?', [o.merchant_id]);
    if (!m || !m.webhook_url) return;
    const payload = JSON.stringify({
        event,
        order_id: o.order_id,
        external_order_id: o.external_order_id,
        amount_xmr: o.amount_xmr,
        status: o.status,
        tx_hash: o.tx_hash,
        confirmations: o.confirmations,
        timestamp: new Date().toISOString(),
    });
    await dbRun(
        'INSERT INTO pay_webhook_deliveries (order_pk, url, payload, next_retry_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [orderPk, m.webhook_url, payload]
    );
}

async function deliverPendingWebhooks({ dbAll, dbRun, dbGet, logError }) {
    const due = await dbAll(
        "SELECT id, order_pk, url, payload, attempt FROM pay_webhook_deliveries WHERE failed_permanently = 0 AND delivered_at IS NULL AND (next_retry_at IS NULL OR next_retry_at <= datetime('now')) ORDER BY id ASC LIMIT 25"
    );
    for (const d of due) {
        try {
            const order = await dbGet('SELECT merchant_id FROM pay_orders WHERE id = ?', [d.order_pk]);
            if (!order) continue;
            const m = await dbGet('SELECT webhook_secret FROM pay_merchants WHERE id = ?', [order.merchant_id]);
            const sig = m && m.webhook_secret ? signWebhook(d.payload, m.webhook_secret) : '';
            const r = await fetch(d.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-GoXMR-Pay-Signature': sig,
                    'X-GoXMR-Pay-Event-Id': crypto.randomUUID(),
                },
                body: d.payload,
                timeout: 8000,
            });
            const status = r.status;
            const excerpt = (await r.text()).slice(0, 500);
            if (status >= 200 && status < 300) {
                await dbRun(
                    "UPDATE pay_webhook_deliveries SET status_code = ?, response_excerpt = ?, delivered_at = datetime('now') WHERE id = ?",
                    [status, excerpt, d.id]
                );
            } else {
                await scheduleRetry({ dbRun, deliveryId: d.id, attempt: d.attempt, statusCode: status, excerpt });
            }
        } catch (err) {
            await scheduleRetry({ dbRun, deliveryId: d.id, attempt: d.attempt, statusCode: 0, excerpt: err.message }).catch(() => {});
        }
    }
}

async function scheduleRetry({ dbRun, deliveryId, attempt, statusCode, excerpt }) {
    const next = attempt + 1;
    const MAX = 8;
    if (next > MAX) {
        return dbRun(
            "UPDATE pay_webhook_deliveries SET status_code = ?, response_excerpt = ?, failed_permanently = 1 WHERE id = ?",
            [statusCode, excerpt, deliveryId]
        );
    }
    // exponential backoff: 30s, 1m, 3m, 10m, 30m, 1h, 2h, 6h
    const seconds = [30, 60, 180, 600, 1800, 3600, 7200, 21600][attempt - 1] || 21600;
    return dbRun(
        `UPDATE pay_webhook_deliveries SET status_code = ?, response_excerpt = ?, attempt = ?, next_retry_at = datetime('now', '+${seconds} seconds') WHERE id = ?`,
        [statusCode, excerpt, next, deliveryId]
    );
}

module.exports = { startPaymentScanner, queueWebhook };
