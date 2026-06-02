// in-memory cache of open view-only wallets, one per merchant.
//
// opening a monero-ts wallet costs ~1-3s (load keys + connect daemon). doing
// that on every /pay/v1/orders POST would make order creation feel sluggish,
// so we cache the wallet handle and idle-close after WALLET_IDLE_TTL_MS.
// the scanner shares the same pool: when it picks up a merchant for its cycle,
// it grabs the cached handle (or opens fresh), syncs, and the next requester
// gets the warm wallet for free.

const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');

const PAY_WALLET_DIR = path.resolve('./wallet_data/pay');
const WALLET_IDLE_TTL_MS = 5 * 60 * 1000;        // close if untouched for 5 min
const REAP_INTERVAL_MS = 60 * 1000;              // sweep idle wallets every 1 min

function ensureDir() {
    if (!fs.existsSync(PAY_WALLET_DIR)) {
        fs.mkdirSync(PAY_WALLET_DIR, { recursive: true });
    }
}
function walletPathFor(merchantId) {
    return path.join(PAY_WALLET_DIR, `merchant_${merchantId}`);
}
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

// per-merchant async mutex. monero-ts wallet objects are NOT safe for concurrent
// access — running sync() in the scanner while a request handler calls
// createSubaddress() against the same wallet deadlocked our first test run.
// every public method below acquires this lock for the merchant id before
// touching wallet state.
function makeQueue() {
    let chain = Promise.resolve();
    return (fn) => {
        const next = chain.then(() => fn());
        // swallow rejections so subsequent callers aren't poisoned
        chain = next.catch(() => {});
        return next;
    };
}

class WalletPool {
    constructor() {
        // merchantId -> { wallet, lastUsed }
        this.cache = new Map();
        // merchantId -> queue function (one mutex per merchant)
        this.locks = new Map();
        this.daemons = buildNodeList();
        this._startReaper();
    }

    _lockFor(merchantId) {
        let q = this.locks.get(merchantId);
        if (!q) { q = makeQueue(); this.locks.set(merchantId, q); }
        return q;
    }

    _startReaper() {
        setInterval(() => this._reap().catch(() => {}), REAP_INTERVAL_MS);
    }

    async _reap() {
        const now = Date.now();
        for (const [id, entry] of this.cache.entries()) {
            if (now - entry.lastUsed > WALLET_IDLE_TTL_MS) {
                // acquire the lock so we never close a wallet mid-operation
                await this._lockFor(id)(async () => {
                    try { await entry.wallet.close(true); } catch {}
                    this.cache.delete(id);
                });
                console.log(`[PAY-POOL] reaped idle wallet merchant=${id}`);
            }
        }
    }

    // internal: open from disk or create. caller already holds the lock.
    async _open(merchant) {
        const cached = this.cache.get(merchant.id);
        if (cached) { cached.lastUsed = Date.now(); return cached.wallet; }
        ensureDir();
        const wpath = walletPathFor(merchant.id);
        const exists = fs.existsSync(wpath + '.keys');
        let lastErr = null;
        for (const daemon of this.daemons) {
            try {
                let wallet;
                if (exists) {
                    wallet = await monerojs.openWalletFull({
                        path: wpath,
                        password: '',
                        networkType: 'mainnet',
                    });
                    await wallet.setDaemonConnection(daemon);
                } else {
                    const restoreHeight = Number(merchant.restore_height) || 3300000;
                    wallet = await monerojs.createWalletFull({
                        path: wpath,
                        password: '',
                        networkType: 'mainnet',
                        serverUri: daemon,
                        primaryAddress: merchant.monero_address,
                        privateViewKey: merchant.private_view_key_enc,
                        restoreHeight,
                    });
                }
                this.cache.set(merchant.id, { wallet, lastUsed: Date.now() });
                console.log(`[PAY-POOL] opened wallet merchant=${merchant.id} via ${daemon}`);
                return wallet;
            } catch (err) {
                lastErr = err;
                console.warn(`[PAY-POOL] open failed merchant=${merchant.id} via ${daemon}: ${err.message}`);
            }
        }
        throw lastErr || new Error('no daemon reachable');
    }

    // derive the next subaddress index. serialized per merchant.
    async nextSubaddress(merchant) {
        return this._lockFor(merchant.id)(async () => {
            const wallet = await this._open(merchant);
            const sub = await wallet.createSubaddress(0);
            const address = sub.getAddress();
            const index = sub.getIndex();
            await wallet.save();
            return { address, index };
        });
    }

    async syncAndSave(merchant) {
        return this._lockFor(merchant.id)(async () => {
            const wallet = await this._open(merchant);
            await wallet.sync();
            await wallet.save();
            return wallet;
        });
    }

    async incomingTransfersForIndex(merchant, subaddressIndex) {
        return this._lockFor(merchant.id)(async () => {
            const wallet = await this._open(merchant);
            return wallet.getTransfers({
                accountIndex: 0,
                subaddressIndex,
                isIncoming: true,
            });
        });
    }
}

module.exports = { WalletPool };
