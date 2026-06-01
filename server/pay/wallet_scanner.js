// per-merchant view-only wallet scanner for the Pay gateway.
//
// each merchant supplies (primary monero_address + private_view_key). we materialise
// a view-only wallet on disk as wallet_data/pay/merchant_<id>.* and cycle through
// merchants serially: open → setDaemonConnection → sync → getTransfers → close.
// orders that match (amount + confirmations) flip to 'paid' and a webhook is queued.
//
// trade-offs:
//   - serial cycle, not parallel — keeps daemon RPS bounded; ~5-15s per merchant
//   - close after each cycle — RAM stays flat regardless of merchant count
//   - last_scanned_height per merchant lets us narrow getTransfers and avoid re-work
//   - one wallet file per merchant on disk (~10KB keys file each)
//
// phase 2 will switch to a long-lived wallet-rpc pool when merchant count justifies.

const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');

const SCAN_INTERVAL_MS = 60 * 1000;      // top-level loop tick
const PER_MERCHANT_TIMEOUT_MS = 90_000;  // hard kill if a single open/sync stalls
const MIN_CONFIRMATIONS = 1;
const PAY_WALLET_DIR = path.resolve('./wallet_data/pay');

function ensureDir() {
    if (!fs.existsSync(PAY_WALLET_DIR)) {
        fs.mkdirSync(PAY_WALLET_DIR, { recursive: true });
    }
}

function walletPathFor(merchantId) {
    return path.join(PAY_WALLET_DIR, `merchant_${merchantId}`);
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout: ${label} after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// open a view-only wallet for the merchant. creates it from the stored
// address+view_key if the wallet file doesn't exist yet.
async function openMerchantWallet({ merchant, daemonUrl }) {
    ensureDir();
    const wpath = walletPathFor(merchant.id);
    const exists = fs.existsSync(wpath + '.keys');
    if (exists) {
        const w = await monerojs.openWalletFull({
            path: wpath,
            password: '',
            networkType: 'mainnet',
        });
        await w.setDaemonConnection(daemonUrl);
        return w;
    }
    const restoreHeight = Number(merchant.restore_height) || 3300000;
    return await monerojs.createWalletFull({
        path: wpath,
        password: '',
        networkType: 'mainnet',
        serverUri: daemonUrl,
        primaryAddress: merchant.monero_address,
        privateViewKey: merchant.private_view_key_enc, // currently stored plaintext in Phase 1
        restoreHeight,
    });
}

// safely extract amount + confirmations from a monero-ts transfer.
// monero-ts amount is BigInt of atomic units (1 XMR = 1e12 atomic units).
function readTransfer(t) {
    try {
        const atomic = t.getAmount ? t.getAmount() : t.amount;
        const amount = parseFloat(atomic.toString()) / 1e12;
        const confs = t.getNumConfirmations ? Number(t.getNumConfirmations()) : Number(t.numConfirmations || 0);
        const txHash = t.getTx ? t.getTx().getHash() : (t.txHash || null);
        return { amount, confs, txHash };
    } catch {
        return { amount: 0, confs: 0, txHash: null };
    }
}

// scan one merchant: open its wallet, sync from last_scanned_height, look for
// transfers matching any pending order's amount, mark matched orders paid.
// returns { checked: N, matched: N }
async function scanOneMerchant({ merchant, daemonUrl, dbAll, dbRun, dbGet, queueWebhook, logError }) {
    const pending = await dbAll(
        "SELECT * FROM pay_orders WHERE merchant_id = ? AND status = 'pending'",
        [merchant.id]
    );
    if (pending.length === 0) return { checked: 0, matched: 0 };

    let wallet = null;
    try {
        wallet = await withTimeout(openMerchantWallet({ merchant, daemonUrl }), PER_MERCHANT_TIMEOUT_MS, 'openWallet');
        await withTimeout(wallet.sync(), PER_MERCHANT_TIMEOUT_MS, 'sync');
        await wallet.save();
        const currentHeight = await wallet.getHeight();
        await dbRun('UPDATE pay_merchants SET restore_height = ? WHERE id = ?', [currentHeight, merchant.id]);

        // incoming transfers — single call per merchant scan, then match in memory
        const transfers = await wallet.getTransfers({ isIncoming: true });

        let matched = 0;
        for (const order of pending) {
            // amount comparison tolerates 0.000001 XMR rounding (1 atomic-unit-ish)
            const hit = transfers.find(t => {
                const r = readTransfer(t);
                return r.confs >= MIN_CONFIRMATIONS && Math.abs(r.amount - order.amount_xmr) <= 0.000001;
            });
            if (!hit) continue;

            const r = readTransfer(hit);
            const update = await dbRun(
                "UPDATE pay_orders SET status = 'paid', tx_hash = ?, confirmations = ?, detected_at = datetime('now'), confirmed_at = datetime('now') WHERE id = ? AND status = 'pending'",
                [r.txHash, r.confs, order.id]
            );
            if (update && update.changes > 0) {
                matched++;
                console.log(`[PAY-SCAN] merchant=${merchant.id} order=${order.order_id} paid: ${r.amount} XMR confs=${r.confs}`);
                try {
                    if (queueWebhook) await queueWebhook({ dbGet, dbRun }, order.id, 'order.paid');
                } catch (whErr) {
                    if (logError) logError('PAY_WEBHOOK_QUEUE', whErr, { orderId: order.id });
                }
            }
        }
        return { checked: pending.length, matched };
    } finally {
        if (wallet) {
            try { await wallet.close(true); } catch { /* save-then-close already happened, ignore */ }
        }
    }
}

// build the list of daemon URLs the gateway scanner will try — reuse the
// dev-fund monitor's env vars so ops only configures nodes once.
function buildNodeList() {
    const normalize = (u) => {
        u = (u || '').trim();
        if (!u) return null;
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = (u.includes(':443') || !u.includes(':')) ? ('https://' + u) : ('http://' + u);
        }
        return u;
    };
    const primary = (process.env.MONERO_WALLET_RPC_URL || process.env.MONERO_NODE_URL || '').trim();
    const fallbacks = (process.env.MONERO_NODE_FALLBACKS || '').split(/[,\s]+/).filter(Boolean);
    const list = [primary, ...fallbacks].map(normalize).filter(Boolean);
    return list.length ? list : ['https://xmr-node.cakewallet.com:18081'];
}

// top-level cycle: pick all merchants with active orders + configured address+view_key,
// scan each serially. logs per-cycle summary.
async function runScanCycle({ dbAll, dbRun, dbGet, queueWebhook, logError }) {
    const merchants = await dbAll(
        `SELECT m.* FROM pay_merchants m
         WHERE m.is_active = 1
           AND m.monero_address IS NOT NULL AND m.monero_address != ''
           AND m.private_view_key_enc IS NOT NULL AND m.private_view_key_enc != ''
           AND EXISTS (SELECT 1 FROM pay_orders o WHERE o.merchant_id = m.id AND o.status = 'pending')`
    );
    if (merchants.length === 0) return { cycled: 0, paid: 0 };

    const daemons = buildNodeList();
    let totalPaid = 0;
    for (const merchant of merchants) {
        for (const daemon of daemons) {
            try {
                const r = await scanOneMerchant({ merchant, daemonUrl: daemon, dbAll, dbRun, dbGet, queueWebhook, logError });
                totalPaid += r.matched;
                break; // success — move to next merchant
            } catch (err) {
                console.warn(`[PAY-SCAN] merchant=${merchant.id} on ${daemon}: ${err.message}`);
                if (logError) logError('PAY_SCAN', err, { merchantId: merchant.id, daemon });
                // try the next daemon
            }
        }
    }
    return { cycled: merchants.length, paid: totalPaid };
}

function startWalletScanner(deps) {
    setInterval(async () => {
        try {
            const r = await runScanCycle(deps);
            if (r.cycled > 0) {
                console.log(`[PAY-SCAN] cycle: ${r.cycled} merchants, ${r.paid} new paid`);
            }
        } catch (err) {
            console.error('[PAY-SCAN] cycle error:', err.message);
            if (deps.logError) deps.logError('PAY_SCAN_CYCLE', err);
        }
    }, SCAN_INTERVAL_MS);
    console.log(`[PAY-SCAN] wallet scanner started, cycle every ${SCAN_INTERVAL_MS / 1000}s`);
}

module.exports = { startWalletScanner, runScanCycle, scanOneMerchant };
