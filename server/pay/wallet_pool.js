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
const crypto = require('crypto');
const { nodePool } = require('../monero/nodePool');

const PAY_WALLET_DIR = path.resolve('./wallet_data/pay');
const WALLET_IDLE_TTL_MS = 5 * 60 * 1000;        // close if untouched for 5 min
const REAP_INTERVAL_MS = 60 * 1000;              // sweep idle wallets every 1 min

// derive a per-merchant wallet password from the server secret + merchant id.
// the wallet file on disk is encrypted with this; even if someone reads the
// wallet_data dir they need JWT_SECRET to unlock it. on first open after this
// helper landed, wallets written with the old empty password are migrated
// transparently via _openWithMigration() — we try the derived password first,
// fall back to the empty one, and on success rewrite the keys with the new
// password by saving immediately.
function walletPasswordFor(merchantId) {
    const secret = process.env.JWT_SECRET || '';
    if (!secret) return ''; // no secret → degrade to empty rather than locking forever
    return crypto.createHash('sha256').update(`pay-wallet:${secret}:${merchantId}`).digest('hex');
}

function ensureDir() {
    if (!fs.existsSync(PAY_WALLET_DIR)) {
        fs.mkdirSync(PAY_WALLET_DIR, { recursive: true });
    }
}
function walletPathFor(merchantId) {
    return path.join(PAY_WALLET_DIR, `merchant_${merchantId}`);
}
// daemon list + failover ordering now live in the shared, health-aware nodePool.

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
    // password handling:
    //   - new wallets are created with walletPasswordFor(merchantId) — derived
    //     from JWT_SECRET so the on-disk file can't be opened without the server secret
    //   - existing wallets created before this change used password '' — we try
    //     the derived password first, fall back to '' on auth failure, and if the
    //     fallback worked we re-save with the new password to migrate transparently
    async _open(merchant) {
        const cached = this.cache.get(merchant.id);
        if (cached) { cached.lastUsed = Date.now(); return cached.wallet; }
        ensureDir();
        const wpath = walletPathFor(merchant.id);
        const exists = fs.existsSync(wpath + '.keys');
        const targetPassword = walletPasswordFor(merchant.id);
        let lastErr = null;
        // fresh health-sorted list each open so we follow the prober's latest
        // verdict rather than a snapshot frozen at construction time.
        for (const daemon of nodePool.urls()) {
            try {
                let wallet;
                let needsRekey = false;
                if (exists) {
                    // try derived password first, fall back to empty for legacy wallets
                    try {
                        wallet = await monerojs.openWalletFull({
                            path: wpath,
                            password: targetPassword,
                            networkType: 'mainnet',
                        });
                    } catch (primaryErr) {
                        try {
                            wallet = await monerojs.openWalletFull({
                                path: wpath,
                                password: '',
                                networkType: 'mainnet',
                            });
                            needsRekey = !!targetPassword;
                            if (needsRekey) console.log(`[PAY-POOL] migrating wallet merchant=${merchant.id} to derived password`);
                        } catch (legacyErr) {
                            throw primaryErr; // surface the more informative error
                        }
                    }
                    await wallet.setDaemonConnection(daemon);
                } else {
                    const restoreHeight = Number(merchant.restore_height) || 3300000;
                    wallet = await monerojs.createWalletFull({
                        path: wpath,
                        password: targetPassword,
                        networkType: 'mainnet',
                        serverUri: daemon,
                        primaryAddress: merchant.monero_address,
                        privateViewKey: merchant.private_view_key_enc,
                        restoreHeight,
                    });
                }
                // if we opened a legacy '' wallet under a target password we want the
                // re-encrypted version on disk. monero-ts re-encrypts on save() when
                // the wallet was opened with one password and we changed it; the
                // simplest portable path is to use changePassword() then save().
                if (needsRekey) {
                    try {
                        if (typeof wallet.changePassword === 'function') {
                            await wallet.changePassword('', targetPassword);
                        }
                        await wallet.save();
                    } catch (rekeyErr) {
                        console.warn(`[PAY-POOL] rekey failed merchant=${merchant.id}: ${rekeyErr.message} — wallet still functional with old password`);
                    }
                }
                this.cache.set(merchant.id, { wallet, lastUsed: Date.now() });
                nodePool.markOk(daemon);
                console.log(`[PAY-POOL] opened wallet merchant=${merchant.id} via ${daemon}${needsRekey ? ' (migrated)' : ''}`);
                return wallet;
            } catch (err) {
                lastErr = err;
                nodePool.markFail(daemon);
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
