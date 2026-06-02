// per-merchant view-only scanner — uses subaddress-per-order to disambiguate
// arrivals so two orders of the same amount can't collide.
//
// each order has a payment_subaddress_index assigned at creation time
// (via WalletPool.nextSubaddress). the scanner asks the wallet for transfers
// filtered by that exact index, then matches confirmations + amount.
//
// the WalletPool caches open wallets so we don't pay the open/close cost on
// every cycle. all wallets share the same daemon priority list.

const { WalletPool } = require('./wallet_pool');

const SCAN_INTERVAL_MS = 60 * 1000;
const MIN_CONFIRMATIONS = 1;

const pool = new WalletPool();

// in monero-ts a Transfer is a leaf that points at its parent Tx via getTx();
// confirmation count and block height live on the Tx, not the Transfer. reading
// confs from the Transfer object directly returns 0 forever, so paid orders
// would never cross MIN_CONFIRMATIONS and stay pending. mirror the fix already
// applied to monero_monitor._getSafeTransferData() — ask the Tx first, fall
// back to the Transfer-level shape, and surface an isConfirmed boolean so the
// caller can backfill via daemon height when neither path returns a number.
function readTransfer(t) {
    try {
        const tx = (t && typeof t.getTx === 'function') ? t.getTx() : null;

        const atomic = (typeof t.getAmount === 'function') ? t.getAmount() : t.amount;
        const amount = parseFloat((atomic ?? 0).toString()) / 1e12;

        const readConfs = (obj) => {
            if (!obj) return undefined;
            if (typeof obj.getNumConfirmations === 'function') return obj.getNumConfirmations();
            if (typeof obj.getConfirmations === 'function') return obj.getConfirmations();
            if (obj.numConfirmations !== undefined) return obj.numConfirmations;
            if (obj.confirmations !== undefined) return obj.confirmations;
            return undefined;
        };
        const readHeight = (obj) => {
            if (!obj) return undefined;
            if (typeof obj.getHeight === 'function') return obj.getHeight();
            if (obj.height !== undefined) return obj.height;
            return undefined;
        };
        const readIsConfirmed = (obj) => {
            if (!obj) return undefined;
            if (typeof obj.getIsConfirmed === 'function') return !!obj.getIsConfirmed();
            if (typeof obj.isConfirmed === 'function') return !!obj.isConfirmed();
            if (obj.isConfirmed !== undefined) return !!obj.isConfirmed;
            return undefined;
        };

        const confsRaw = readConfs(tx) ?? readConfs(t);
        let confs = Number(confsRaw?.toString?.() ?? confsRaw ?? 0) || 0;

        const heightRaw = readHeight(tx) ?? readHeight(t);
        const height = Number(heightRaw?.toString?.() ?? heightRaw ?? 0) || 0;

        const isConfirmed = readIsConfirmed(tx) ?? readIsConfirmed(t) ?? false;
        if (confs === 0 && isConfirmed) confs = 1;

        let txHash = null;
        if (tx && typeof tx.getHash === 'function') txHash = tx.getHash();
        if (!txHash && typeof t.getTxHash === 'function') txHash = t.getTxHash();
        if (!txHash && typeof t.getHash === 'function') txHash = t.getHash();
        if (!txHash && t.txHash) txHash = t.txHash;

        return { amount, confs, txHash, height, isConfirmed };
    } catch {
        return { amount: 0, confs: 0, txHash: null, height: 0, isConfirmed: false };
    }
}

async function scanOneMerchant({ merchant, dbAll, dbRun, dbGet, queueWebhook, logError }) {
    // only orders that have an assigned subaddress index are auto-scannable;
    // orders without it were created before the subaddress refactor or with
    // the merchant address as fallback — skip those, the merchant can mark
    // them paid manually.
    const pending = await dbAll(
        "SELECT * FROM pay_orders WHERE merchant_id = ? AND status = 'pending' AND payment_subaddress_index IS NOT NULL",
        [merchant.id]
    );
    if (pending.length === 0) return { checked: 0, matched: 0 };

    // sync once per merchant per cycle, then loop orders against the in-memory
    // wallet state. avoids 1 sync per pending order.
    const wallet = await pool.syncAndSave(merchant);

    // daemon height (blockchain tip) — used as canonical reference when neither
    // the Tx nor the Transfer expose a numeric confirmation count but we do know
    // the tx height. mirrors the daemon-height path in monero_monitor.
    let referenceHeight = 0;
    try {
        if (wallet && typeof wallet.getDaemonHeight === 'function') {
            referenceHeight = Number((await wallet.getDaemonHeight())?.toString?.() ?? 0) || 0;
        }
    } catch { /* non-fatal */ }
    if (!referenceHeight && wallet) {
        try {
            if (typeof wallet.getHeight === 'function') {
                referenceHeight = Number((await wallet.getHeight())?.toString?.() ?? 0) || 0;
            }
        } catch { /* non-fatal */ }
    }

    const effectiveConfs = (r) => {
        if (r.confs > 0) return r.confs;
        if (r.height > 0 && referenceHeight > r.height) return referenceHeight - r.height + 1;
        return 0;
    };

    let matched = 0;
    for (const order of pending) {
        try {
            const transfers = await pool.incomingTransfersForIndex(merchant, order.payment_subaddress_index);
            const hit = transfers.find(t => {
                const r = readTransfer(t);
                return effectiveConfs(r) >= MIN_CONFIRMATIONS &&
                       Math.abs(r.amount - order.amount_xmr) <= 0.000001;
            });
            if (!hit) continue;
            const r = readTransfer(hit);
            const finalConfs = effectiveConfs(r);
            const update = await dbRun(
                "UPDATE pay_orders SET status = 'paid', tx_hash = ?, confirmations = ?, detected_at = datetime('now'), confirmed_at = datetime('now') WHERE id = ? AND status = 'pending'",
                [r.txHash, finalConfs, order.id]
            );
            if (update && update.changes > 0) {
                matched++;
                console.log(`[PAY-SCAN] merchant=${merchant.id} order=${order.order_id} paid: ${r.amount} XMR confs=${r.confs} (effective ${finalConfs}, height=${r.height}, refHeight=${referenceHeight}, isConfirmed=${r.isConfirmed}) tx=${r.txHash}`);
                try {
                    if (queueWebhook) await queueWebhook({ dbGet, dbRun }, order.id, 'order.paid');
                } catch (whErr) {
                    if (logError) logError('PAY_WEBHOOK_QUEUE', whErr, { orderId: order.id });
                }
            }
        } catch (err) {
            if (logError) logError('PAY_SCAN_ORDER', err, { merchantId: merchant.id, orderId: order.order_id });
        }
    }
    return { checked: pending.length, matched };
}

async function runScanCycle({ dbAll, dbRun, dbGet, queueWebhook, logError }) {
    const merchants = await dbAll(
        `SELECT m.* FROM pay_merchants m
         WHERE m.is_active = 1
           AND m.monero_address IS NOT NULL AND m.monero_address != ''
           AND m.private_view_key_enc IS NOT NULL AND m.private_view_key_enc != ''
           AND EXISTS (
               SELECT 1 FROM pay_orders o
               WHERE o.merchant_id = m.id AND o.status = 'pending' AND o.payment_subaddress_index IS NOT NULL
           )`
    );
    if (merchants.length === 0) return { cycled: 0, paid: 0 };

    let totalPaid = 0;
    for (const merchant of merchants) {
        try {
            const r = await scanOneMerchant({ merchant, dbAll, dbRun, dbGet, queueWebhook, logError });
            totalPaid += r.matched;
        } catch (err) {
            console.warn(`[PAY-SCAN] merchant=${merchant.id}: ${err.message}`);
            if (logError) logError('PAY_SCAN_CYCLE_MERCHANT', err, { merchantId: merchant.id });
        }
    }
    return { cycled: merchants.length, paid: totalPaid };
}

function startWalletScanner(deps) {
    setInterval(async () => {
        try {
            const r = await runScanCycle(deps);
            if (r.cycled > 0) console.log(`[PAY-SCAN] cycle: ${r.cycled} merchants, ${r.paid} new paid`);
        } catch (err) {
            console.error('[PAY-SCAN] cycle error:', err.message);
            if (deps.logError) deps.logError('PAY_SCAN_CYCLE', err);
        }
    }, SCAN_INTERVAL_MS);
    console.log(`[PAY-SCAN] wallet scanner started, cycle every ${SCAN_INTERVAL_MS / 1000}s`);
}

module.exports = { startWalletScanner, runScanCycle, scanOneMerchant, pool };
