const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');
const db = require('./db');

class MoneroMonitor {
    constructor() {
        this.wallet = null;
        this.isSyncing = false;
        this.lastBalance = 0.0;
        this.lastHeight = 0;
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

    async init() {
        console.log('[MONERO] Initializing Monitor Service...');
        try {
            const address = (process.env.MONERO_WALLET_ADDRESS || '').trim();
            const viewKey = (process.env.MONERO_VIEW_KEY || '').trim();
            let daemonUrl = (process.env.MONERO_WALLET_RPC_URL || process.env.MONERO_NODE_URL || 'https://node.monerohash.com:443').trim();

            if (!daemonUrl.startsWith('http://') && !daemonUrl.startsWith('https://')) {
                daemonUrl = 'https://' + daemonUrl;
            }

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
                    password: process.env.MONERO_WALLET_PASSWORD || 'super_secret_local_password',
                    networkType: 'mainnet'
                });
                await this.wallet.setDaemonConnection(daemonUrl);
            } else {
                console.log(`[MONERO] Creating new wallet at ${this.walletPath}`);
                const restoreHeight = Number(process.env.MONERO_RESTORE_HEIGHT) || 3300000; // Default to ~2024
                console.log(`[MONERO] Using Restore Height: ${restoreHeight}`);

                this.wallet = await monerojs.createWalletFull({
                    path: this.walletPath,
                    password: process.env.MONERO_WALLET_PASSWORD || 'super_secret_local_password',
                    networkType: 'mainnet',
                    serverUri: daemonUrl,
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
    }

    async forceCheck() {
        console.log('[MONERO] Force check requested.');
        await this.sync();
        await this.checkPremiumPayments();
        return this.getStatus();
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.wallet.sync();
            await this.wallet.save();
            const balanceBig = await this.wallet.getBalance();
            this.lastBalance = parseFloat(balanceBig.toString()) / 1e12;
            this.lastHeight = await this.wallet.getHeight();
            // Get Daemon Height to compare
            const daemonHeight = await this.wallet.getDaemonHeight();
            console.log(`[MONERO] Sync Complete. Balance: ${this.lastBalance} XMR. Height: ${this.lastHeight} / ${daemonHeight}`);
        } catch (err) {
            console.error('[MONERO] Sync Error:', err);
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

            // Check payments
            for (const user of pendingUsers) {
                const transfers = await this.wallet.getTransfers({
                    accountIndex: 0,
                    subaddressIndex: user.premium_subaddress_index,
                    isIncoming: true
                });

                console.log(`[MONERO] User ${user.id} (Index ${user.premium_subaddress_index}): Found ${transfers.length} transfers.`);

                const confirmedTransfer = transfers.find(t => {
                    const data = this._getSafeTransferData(t);
                    console.log(`   -> Tx: ${data.txid}, Confs: ${data.confs}, Amount: ${data.amount} XMR`);
                    return data.confs >= 1 && data.amount >= MIN_PAYMENT_AMOUNT;
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

    // Helper to safely extract data from different monero-ts transfer object structures
    _getSafeTransferData(t) {
        let txid = 'unknown';
        let amount = 0;
        let confs = 0;
        let height = 0;

        try {
            // 1. Extract TXID
            if (typeof t.getTxHash === 'function') txid = t.getTxHash();
            else if (typeof t.getHash === 'function') txid = t.getHash();
            else if (t.getTx && typeof t.getTx === 'function') {
                const tx = t.getTx();
                if (tx && typeof tx.getHash === 'function') txid = tx.getHash();
            }

            // 2. Extract Amount (handle BigInt/BigInteger)
            let rawAmount = 0;
            if (typeof t.getAmount === 'function') rawAmount = t.getAmount();
            else if (t.amount !== undefined) rawAmount = t.amount;

            amount = parseFloat(rawAmount.toString()) / 1e12;

            // 3. Extract Confirmations & Height
            if (typeof t.getNumConfirmations === 'function') confs = t.getNumConfirmations();
            else if (typeof t.getConfirmations === 'function') confs = t.getConfirmations();
            else if (t.numConfirmations !== undefined) confs = t.numConfirmations;
            else if (t.confirmations !== undefined) confs = t.confirmations;

            if (typeof t.getHeight === 'function') height = t.getHeight();
            else if (t.height !== undefined) height = t.height;

            // Fallback: Check isConfirmed boolean
            if (confs === 0 || confs === undefined) {
                if (typeof t.isConfirmed === 'function' && t.isConfirmed()) confs = 1;
                else if (t.isConfirmed === true) confs = 1;
            }

        } catch (e) {
            console.error("Error parsing transfer object:", e);
        }

        return { txid, amount, confs, height };
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
            return { found: true, valid: false, reason: 'Transaction pending (0 confirmations)' };
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

    getStatus() {
        return {
            balance: this.lastBalance,
            height: this.lastHeight,
            isSyncing: this.isSyncing,
            message: this.statusMessage
        };
    }
}

module.exports = new MoneroMonitor();
