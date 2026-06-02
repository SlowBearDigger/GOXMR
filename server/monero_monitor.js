const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');
const db = require('./db');

class MoneroMonitor {
    constructor() {
        this.wallet = null;
        this.isSyncing = false;
        this.lastBalance = 0.0;
        this.lastHeight = 3572608;
        this.daemonHeight = 0;
        this.daemonUrl = '';
        this.isDaemonConnected = false;
        this.lastError = null;
        this.walletPath = process.env.MONERO_WALLET_PATH ? path.resolve(process.env.MONERO_WALLET_PATH) : path.resolve('./wallet_data/dev_fund_wallet');
        this.statusMessage = 'Initializing...';

        // Ensure wallet directory exists
        const walletDir = path.dirname(this.walletPath);
        if (!fs.existsSync(walletDir)) {
            try {
                fs.mkdirSync(walletDir, { recursive: true });
                console.log(`[MONERO] Created wallet directory: ${walletDir}`);
            } catch (err) {
                console.error(`[MONERO] Failed to create wallet directory: ${err.message}`);
                this.statusMessage = `Error: Cannot create directory ${walletDir}`;
            }
        }
    }

    // Build prioritized daemon URL list from env: MONERO_NODE_URL is primary,
    // MONERO_NODE_FALLBACKS is a comma/space-separated list. Each entry is normalized
    // to include protocol (https for :443 or no port, http otherwise).
    _buildNodeList() {
        const normalize = (u) => {
            u = u.trim();
            if (!u) return null;
            if (!u.startsWith('http://') && !u.startsWith('https://')) {
                u = (u.includes(':443') || !u.includes(':')) ? ('https://' + u) : ('http://' + u);
            }
            return u;
        };
        const primary = (process.env.MONERO_WALLET_RPC_URL || process.env.MONERO_NODE_URL || '').trim();
        const fallbacks = (process.env.MONERO_NODE_FALLBACKS || '').split(/[,\s]+/).filter(Boolean);
        return [primary, ...fallbacks]
            .map(normalize)
            .filter(Boolean)
            .filter((u, i, arr) => arr.indexOf(u) === i); // dedupe
    }

    async init() {
        console.log('[MONERO] Initializing Monitor Service...');
        try {
            const address = (process.env.MONERO_WALLET_ADDRESS || process.env.MONERO_PRIMARY_ADDRESS || '').trim();
            const viewKey = (process.env.MONERO_VIEW_KEY || '').trim();
            this.nodes = this._buildNodeList();
            if (this.nodes.length === 0) this.nodes = ['https://xmr-node.cakewallet.com:18081'];
            this.activeNodeIdx = 0;
            this.daemonUrl = this.nodes[0];
            console.log(`[MONERO] Daemon priority list: ${this.nodes.join(', ')}`);

            if (!address || !viewKey) {
                console.warn('[MONERO] Missing credentials. Monitor disabled.');
                this.statusMessage = 'Disabled: Missing Credentials';
                return;
            }

            const walletExists = fs.existsSync(this.walletPath) || fs.existsSync(this.walletPath + '.keys');

            if (walletExists) {
                console.log(`[MONERO] Opening existing wallet at ${this.walletPath}`);
                this.wallet = await monerojs.openWalletFull({
                    path: this.walletPath,
                    password: process.env.MONERO_WALLET_PASSWORD || '',
                    networkType: 'mainnet'
                });
                await this.wallet.setDaemonConnection(this.daemonUrl);
            } else {
                console.log(`[MONERO] Creating new wallet at ${this.walletPath}`);
                const restoreHeight = Number(process.env.MONERO_RESTORE_HEIGHT) || 3300000; // Default to ~2024
                console.log(`[MONERO] Using Restore Height: ${restoreHeight}`);

                this.wallet = await monerojs.createWalletFull({
                    path: this.walletPath,
                    password: process.env.MONERO_WALLET_PASSWORD || '',
                    networkType: 'mainnet',
                    serverUri: this.daemonUrl,
                    primaryAddress: address,
                    privateViewKey: viewKey,
                    restoreHeight: restoreHeight
                });
            }

            const primaryAddr = await this.wallet.getPrimaryAddress();
            console.log(`[MONERO] Wallet Initialized. Primary Address: ${primaryAddr.substring(0, 6)}...${primaryAddr.substring(primaryAddr.length - 6)}`);

            console.log('[MONERO] Wallet loaded. Starting background tasks...');
            this.statusMessage = 'Synced';
            this.startBackgroundTasks();
        } catch (error) {
            console.error('[MONERO] Initialization Failed:', error);
            this.statusMessage = `Init Failed: ${error.message}`;
        }
    }

    async startBackgroundTasks() {
        if (!this.wallet) return;
        // Periodic Sync & Payment Check
        this.sync();
        setInterval(() => this.sync(), 2 * 60 * 1000); // Sync balance every 2m
        setInterval(() => this.checkPremiumPayments(), 2 * 60 * 1000); // Check payments every 2m
        setInterval(() => this.checkStoreOrderPayments(), 2 * 60 * 1000); // Check store orders every 2m
        setInterval(() => this.expireStaleOrders(), 15 * 60 * 1000); // Expire stale orders every 15m
    }

    async forceCheck() {
        console.log('[MONERO] Force check requested.');
        await this.sync();
        await this.checkPremiumPayments();
        return this.getStatus();
    }

    // Try to (re)establish a daemon connection by walking the priority list.
    // Returns true if we got connected, false if every node failed.
    async _ensureDaemonConnection() {
        if (!this.wallet) return false;
        try {
            if (await this.wallet.isConnectedToDaemon()) return true;
        } catch { /* fall through to rotation */ }
        const nodes = this.nodes && this.nodes.length ? this.nodes : [this.daemonUrl];
        for (let attempt = 0; attempt < nodes.length; attempt++) {
            const idx = (this.activeNodeIdx + attempt) % nodes.length;
            const url = nodes[idx];
            try {
                console.log(`[MONERO] Trying node ${idx + 1}/${nodes.length}: ${url}`);
                await this.wallet.setDaemonConnection(url);
                if (await this.wallet.isConnectedToDaemon()) {
                    this.activeNodeIdx = idx;
                    this.daemonUrl = url;
                    console.log(`[MONERO] Connected to ${url}`);
                    return true;
                }
            } catch (e) {
                console.warn(`[MONERO] Node ${url} failed: ${e.message}`);
            }
        }
        console.error('[MONERO] All daemon candidates exhausted');
        return false;
    }

    async sync() {
        if (this.isSyncing || !this.wallet) return;
        this.isSyncing = true;

        try {
            const ok = await this._ensureDaemonConnection();
            if (!ok) {
                this.isDaemonConnected = false;
                this.lastError = 'No daemon reachable';
                this.statusMessage = 'No daemon reachable';
                return;
            }

            console.log(`[MONERO] Syncing...`);
            await this.wallet.sync();
            await this.wallet.save();
            const balanceBig = await this.wallet.getBalance();
            this.lastBalance = parseFloat(balanceBig.toString()) / 1e12;
            this.lastHeight = await this.wallet.getHeight();

            // Get Daemon Height to compare
            const daemonHeightRaw = await this.wallet.getDaemonHeight();
            this.daemonHeight = Number(daemonHeightRaw.toString());
            this.isDaemonConnected = true;
            this.lastError = null;
            this.statusMessage = 'Synced';

            console.log(`[MONERO] Sync Complete. Balance: ${this.lastBalance} XMR. Height: ${this.lastHeight} / ${this.daemonHeight}`);
        } catch (err) {
            console.error('[MONERO] Sync Error:', err);
            this.isDaemonConnected = false;
            this.lastError = err.message;
            this.statusMessage = `Sync Error: ${err.message}`;
        } finally {
            this.isSyncing = false;
        }
    }

    // --- PREMIUM LOGIC ---

    async getOrCreateSubaddress(userId) {
        if (!this.wallet) throw new Error("Wallet not initialized");

        // 1. Check if user already has an index
        const user = await new Promise((res, rej) => {
            db.get('SELECT premium_subaddress_index FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) rej(err); else res(row);
            });
        });

        let index = user?.premium_subaddress_index;

        if (index === null || index === undefined) {
            // 2. Assign next available index
            const maxRow = await new Promise((res) => {
                db.get('SELECT MAX(premium_subaddress_index) as maxIdx FROM users', (err, row) => {
                    res(row);
                });
            });
            index = (maxRow?.maxIdx || 0) + 1;
            await new Promise((res) => {
                db.run('UPDATE users SET premium_subaddress_index = ? WHERE id = ?', [index, userId], () => res());
            });
        }

        // 3. Generate subaddress from wallet (Account 0, Index N)
        const subaddress = await this.wallet.getSubaddress(0, index);
        console.log(`[MONERO] Assigned subaddress index ${index} to user ${userId}: ${subaddress.getAddress().substring(0, 8)}...`);
        return subaddress.getAddress();
    }

    async checkPremiumPayments() {
        if (!this.wallet || this.isSyncing) return;
        console.log('[MONERO] Checking for new premium payments...');
        const MIN_PAYMENT_AMOUNT = 0.001; // XMR

        try {
            // Get users waiting for activation
            const pendingUsers = await new Promise((res) => {
                db.all('SELECT id, premium_subaddress_index FROM users WHERE is_premium = 0 AND premium_subaddress_index IS NOT NULL', (err, rows) => {
                    res(rows || []);
                });
            });

            if (pendingUsers.length === 0) return;
            console.log(`[MONERO] Scanning for ${pendingUsers.length} pending users...`);

            // daemon height (blockchain tip) — used as the canonical reference for confirmation
            // calc when the Tx/Transfer objects don't expose a numeric count. Falls back to the
            // wallet's own synced height if the daemon call fails. The single-tx flow in
            // checkPaymentByTxid uses the same daemon path; we mirror it here so the scheduled
            // sweep and the manual fast-track follow identical activation rules.
            let referenceHeight = 0;
            try {
                if (typeof this.wallet.getDaemonHeight === 'function') {
                    referenceHeight = Number((await this.wallet.getDaemonHeight())?.toString?.() ?? 0) || 0;
                }
            } catch { /* non-fatal */ }
            if (!referenceHeight) {
                try {
                    if (typeof this.wallet.getHeight === 'function') {
                        referenceHeight = Number((await this.wallet.getHeight())?.toString?.() ?? 0) || 0;
                    }
                } catch { /* non-fatal */ }
            }

            // Check payments
            for (const user of pendingUsers) {
                const transfers = await this.wallet.getTransfers({
                    accountIndex: 0,
                    subaddressIndex: user.premium_subaddress_index,
                    isIncoming: true
                });

                console.log(`[MONERO] User ${user.id} (Index ${user.premium_subaddress_index}): Found ${transfers.length} transfers.`);

                const MIN_CONFIRMATIONS = 1;
                const confirmedTransfer = transfers.find(t => {
                    const data = this._getSafeTransferData(t);
                    // backfill confs from referenceHeight delta when the parsers couldn't read a number
                    let effectiveConfs = data.confs;
                    if (effectiveConfs === 0 && data.height > 0 && referenceHeight > data.height) {
                        effectiveConfs = referenceHeight - data.height + 1;
                    }
                    console.log(`   -> Tx: ${data.txid}, Confs: ${data.confs} (effective ${effectiveConfs}), Amount: ${data.amount} XMR, Height: ${data.height}, RefHeight: ${referenceHeight}, isConfirmed: ${data.isConfirmed}`);
                    return data.amount >= MIN_PAYMENT_AMOUNT && effectiveConfs >= MIN_CONFIRMATIONS;
                });

                if (confirmedTransfer) {
                    console.log(`[MONERO] Valid Payment detected for user ${user.id}! Activating Premium.`);
                    await new Promise((res) => {
                        db.run('UPDATE users SET is_premium = 1, premium_activated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id], () => res());
                    });
                }
            }
        } catch (err) {
            console.error('[MONERO] Payment Check Error:', err);
        }
    }

    // Helper to safely extract data from different monero-ts transfer object structures.
    //
    // The bug we were hitting: in monero-ts, a Transfer is a leaf object that points at
    // its parent Tx via getTx(). Confirmation count and height live on the Tx, NOT on
    // the Transfer itself. The old code tried t.getNumConfirmations() directly, which
    // doesn't exist, fell through every alternative, and landed on confs=0 forever —
    // so paid users with TXs minutes deep in the chain still read as "0 confirmations"
    // and never had is_premium flipped.
    //
    // Now we go to the Tx first (where the API actually lives) and only fall back to
    // the Transfer-level fields if that path is unavailable.
    _getSafeTransferData(t) {
        let txid = 'unknown';
        let amount = 0;
        let confs = 0;
        let height = 0;
        let isConfirmed = false;

        try {
            // resolve the parent Tx if the wrapper exposes one — that's where confs / height / hash live in monero-ts
            const tx = (t && typeof t.getTx === 'function') ? t.getTx() : null;

            // 1. txid: prefer the Tx hash; fall back to Transfer-level getters
            if (tx) {
                if (typeof tx.getHash === 'function') txid = tx.getHash();
                else if (typeof tx.getTxHash === 'function') txid = tx.getTxHash();
            }
            if (txid === 'unknown' || !txid) {
                if (typeof t.getTxHash === 'function') txid = t.getTxHash();
                else if (typeof t.getHash === 'function') txid = t.getHash();
            }

            // 2. amount (handle BigInt / BigInteger)
            let rawAmount = 0;
            if (typeof t.getAmount === 'function') rawAmount = t.getAmount();
            else if (t.amount !== undefined) rawAmount = t.amount;
            amount = parseFloat(rawAmount.toString()) / 1e12;

            // 3. confirmations + height: ask the Tx first (the correct location), then fall back
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

            const confsFromTx = readConfs(tx);
            const confsFromTransfer = readConfs(t);
            // tx-level wins; transfer-level only if tx didn't provide anything
            let parsedConfs = confsFromTx !== undefined ? confsFromTx : confsFromTransfer;
            confs = Number(parsedConfs?.toString?.() ?? parsedConfs ?? 0) || 0;

            const heightFromTx = readHeight(tx);
            const heightFromTransfer = readHeight(t);
            let parsedHeight = heightFromTx !== undefined ? heightFromTx : heightFromTransfer;
            height = Number(parsedHeight?.toString?.() ?? parsedHeight ?? 0) || 0;

            const confirmedFromTx = readIsConfirmed(tx);
            const confirmedFromTransfer = readIsConfirmed(t);
            isConfirmed = confirmedFromTx ?? confirmedFromTransfer ?? false;

            // last-resort backfill: if we know the tx is on-chain but couldn't read a
            // numeric confs, count it as at least 1 so the activation threshold is reachable.
            if (confs === 0 && isConfirmed) confs = 1;

            // additional backfill: if we have the tx height AND the wallet's current
            // height is reachable on `this`, compute confs from the delta. The wallet
            // reference is on the parent monitor instance, not this helper, so a caller
            // can layer this in if needed.
        } catch (e) {
            console.error("Error parsing transfer object:", e);
        }

        return { txid, amount, confs, height, isConfirmed };
    }

    async checkPaymentByTxid(userId, txidInput) {
        if (!this.wallet) throw new Error("Wallet not initialized");
        const targetTxid = txidInput.trim();
        console.log(`[MONERO] Checking specific TXID: ${targetTxid} for user ${userId}`);

        // 1. Get user index
        const user = await new Promise((res, rej) => {
            db.get('SELECT premium_subaddress_index FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) rej(err); else res(row);
            });
        });

        if (!user || user.premium_subaddress_index === null) throw new Error("User has no assigned subaddress index");

        // Helper to fetch and find
        const findTransfer = async () => {
            const transfers = await this.wallet.getTransfers({
                accountIndex: 0,
                subaddressIndex: user.premium_subaddress_index,
                isIncoming: true
            });
            return transfers.map(t => this._getSafeTransferData(t)).find(data => data.txid === targetTxid);
        };

        // 2. Initial Fetch
        let matchData = await findTransfer();

        // 3. FORCE SYNC if not found OR if found but 0 confirmations
        if (!matchData || matchData.confs < 1) {
            console.log(`[MONERO] TXID ${targetTxid} status: ${matchData ? 'Unconfirmed (0 confs)' : 'Not Found'}. Force syncing wallet...`);
            try {
                // Try to sync to get latest blocks
                await this.wallet.sync();
                // Re-fetch after sync
                matchData = await findTransfer();
            } catch (err) {
                console.error("[MONERO] Force sync failed (might be already syncing):", err.message);
            }
        }

        if (!matchData) {
            console.log(`[MONERO] TXID ${targetTxid} strictly not found after sync.`);
            return { found: false };
        }

        // 4. MANUAL CONFIRMATION CALCULATION OVERRIDE
        // Ensure strictly safe usage of BigInts vs Numbers
        const safeHeight = Number(matchData.height);
        if (matchData.confs < 1 && safeHeight > 0) {
            try {
                const daemonHeightRaw = await this.wallet.getDaemonHeight();
                const daemonHeight = Number(daemonHeightRaw.toString());

                console.log(`[MONERO] Manual Conf Check: TxHeight ${safeHeight}, DaemonHeight ${daemonHeight}`);
                if (daemonHeight >= safeHeight) {
                    const calculatedConfs = (daemonHeight - safeHeight) + 1;
                    console.log(`[MONERO] Overriding 0 confs with calculated: ${calculatedConfs}`);
                    matchData.confs = calculatedConfs;
                }
            } catch (e) {
                console.error('[MONERO] Failed to get daemon height for manual check:', e);
            }
        }

        console.log(`[MONERO] Found TXID! Amount: ${matchData.amount}, Confs: ${matchData.confs}`);

        if (matchData.amount < 0.001) {
            return { found: true, valid: false, reason: 'Amount too low (< 0.001 XMR)' };
        }

        if (matchData.confs === undefined || matchData.confs < 1) {
            return { found: true, valid: false, reason: `Waiting for confirmations (${matchData.confs || 0}/1)` };
        }

        // 5. Activate Premium
        await new Promise((res) => {
            db.run('UPDATE users SET is_premium = 1, premium_activated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId], () => res());
        });

        return { found: true, valid: true };
    }

    // DEBUG METHOD: Returns raw inspection of the transfer object
    async debugCheck(userId, txidInput) {
        if (!this.wallet) return { error: "Wallet not initialized" };
        const targetTxid = txidInput.trim();
        const logs = [];
        const log = (msg) => logs.push(msg);

        log(`Checking TXID: ${targetTxid} for userId: ${userId}`);

        try {
            // Get user index
            const user = await new Promise((res, rej) => {
                db.get('SELECT premium_subaddress_index FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) rej(err); else res(row);
                });
            });

            if (!user) { return { logs, error: "User not found" }; }

            const transfers = await this.wallet.getTransfers({
                accountIndex: 0,
                subaddressIndex: user.premium_subaddress_index,
                isIncoming: true
            });

            log(`Found ${transfers.length} transfers.`);

            const match = transfers.find(t => {
                let id = 'unknown';
                if (typeof t.getTxHash === 'function') id = t.getTxHash();
                else if (typeof t.getHash === 'function') id = t.getHash();
                else if (t.getTx && typeof t.getTx === 'function') {
                    const tx = t.getTx();
                    if (tx && typeof tx.getHash === 'function') id = tx.getHash();
                }
                return id === targetTxid;
            });

            if (!match) {
                log("No matching TXID found.");
                log("Available IDs in wallet:");
                transfers.forEach(t => {
                    let id = 'unknown';
                    if (typeof t.getTxHash === 'function') id = t.getTxHash();
                    else if (typeof t.getHash === 'function') id = t.getHash();
                    log(`- ${id}`);
                });
                return { logs, found: false };
            }

            log("MATCH FOUND.");

            const methods = ['getHeight', 'getBlockHeight', 'getNumConfirmations', 'getConfirmations', 'isConfirmed', 'getAmount'];
            const results = {};

            for (const m of methods) {
                if (typeof match[m] === 'function') {
                    try {
                        let val = match[m]();
                        if (typeof val === 'bigint') val = val.toString();
                        results[m] = val;
                    } catch (e) { results[m] = "ERROR: " + e.message; }
                } else {
                    let val = match[m];
                    if (typeof val === 'bigint') val = val.toString();
                    if (val === undefined) val = "undefined";
                    results[m] = val;
                }
            }

            // Explicit property check safely
            const safeProp = (key) => {
                let v = match[key];
                return typeof v === 'bigint' ? v.toString() : v;
            }

            results['height_prop'] = safeProp('height');
            results['blockHeight_prop'] = safeProp('blockHeight');
            results['numConfirmations_prop'] = safeProp('numConfirmations');

            return { logs, found: true, inspection: results };

        } catch (e) {
            return { logs, error: e.message }; // Removed stack to avoid circular json issues
        }
    }

    // ============================================
    // STORE: Seller Order Payment Verification
    // ============================================

    // For sellers with auto_verify: generate subaddress per order using platform wallet account 1
    async getOrCreateOrderSubaddress(orderId, sellerUserId) {
        if (!this.wallet) return null;

        try {
            // Use account 0 with a high offset to avoid collision with premium subaddresses
            const STORE_INDEX_OFFSET = 10000;
            const nextIndex = STORE_INDEX_OFFSET + orderId;

            const subaddress = await this.wallet.getSubaddress(0, nextIndex);
            // Store the index on the order for later verification
            await new Promise((res) => {
                db.run('UPDATE store_orders SET payment_subaddress_index = ? WHERE id = ?',
                    [nextIndex, orderId], () => res());
            });
            return subaddress.getAddress();
        } catch (e) {
            console.error('[MONERO-STORE] Failed to generate order subaddress:', e.message);
            return null;
        }
    }

    // Check pending store orders for payments (auto_verify sellers only)
    async checkStoreOrderPayments() {
        if (!this.wallet) return;

        try {
            // Find pending orders that have a subaddress (auto_verify sellers)
            const pendingOrders = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT o.id, o.payment_address, o.payment_subaddress_index, o.price_xmr, o.product_id, o.created_at
                     FROM store_orders o
                     JOIN store_config sc ON o.seller_id = sc.user_id
                     WHERE o.status = 'pending' AND sc.auto_verify = 1
                     AND o.payment_subaddress_index IS NOT NULL`,
                    [], (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });

            if (pendingOrders.length === 0) return;

            console.log(`[MONERO-STORE] Checking ${pendingOrders.length} pending auto-verify orders...`);

            for (const order of pendingOrders) {
                // Auto-expire orders older than 48 hours
                const orderAge = Date.now() - new Date(order.created_at).getTime();
                if (orderAge > 48 * 60 * 60 * 1000) {
                    await new Promise((res) => {
                        db.run('UPDATE store_orders SET status = "expired", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [order.id], () => res());
                    });
                    console.log(`[MONERO-STORE] Order #${order.id} expired (>48h)`);
                    continue;
                }

                // Check all incoming transfers and look for matching amount
                try {
                    // Filter transfers by the specific subaddress index for this order
                    const transfers = await this.wallet.getTransfers({
                        accountIndex: 0,
                        subaddressIndex: order.payment_subaddress_index,
                        isIncoming: true
                    });

                    const matchingTransfer = transfers.find(t => {
                        const data = this._getSafeTransferData(t);
                        return data.amount >= order.price_xmr && data.confs >= 1;
                    });

                    if (matchingTransfer) {
                        const data = this._getSafeTransferData(matchingTransfer);
                        console.log(`[MONERO-STORE] Payment detected for order #${order.id}: ${data.amount} XMR, ${data.confs} confs`);
                        // Only update status — stock decrement is handled by updateOrderStatus endpoint
                        // to avoid double-decrement if seller also manually confirms
                        await new Promise((res) => {
                            db.run('UPDATE store_orders SET status = "paid", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"',
                                [order.id], () => res());
                        });
                    }
                } catch (e) {
                    console.error(`[MONERO-STORE] Error checking order #${order.id}:`, e.message);
                }
            }
        } catch (err) {
            console.error('[MONERO-STORE] Order Payment Check Error:', err.message);
        }
    }

    // Expire old pending orders (for all sellers, not just auto_verify)
    async expireStaleOrders() {
        try {
            await new Promise((res) => {
                db.run(
                    `UPDATE store_orders SET status = 'expired', updated_at = CURRENT_TIMESTAMP
                     WHERE status = 'pending' AND created_at < datetime('now', '-48 hours')`,
                    [], () => res()
                );
            });
        } catch (e) {
            console.error('[MONERO-STORE] Expire stale orders error:', e.message);
        }
    }

    getStatus() {
        return {
            balance: this.lastBalance,
            height: this.lastHeight,
            daemonHeight: this.daemonHeight,
            isSyncing: this.isSyncing,
            isDaemonConnected: this.isDaemonConnected,
            node: this.daemonUrl,
            error: this.lastError,
            goal: 5.0,
            message: this.statusMessage
        };
    }
}

module.exports = new MoneroMonitor();
