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
                this.wallet = await monerojs.openWalletFull({
                    path: this.walletPath,
                    password: 'super_secret_local_password',
                    networkType: 'mainnet'
                });
                await this.wallet.setDaemonConnection(daemonUrl);
            } else {
                this.wallet = await monerojs.createWalletFull({
                    path: this.walletPath,
                    password: 'super_secret_local_password',
                    networkType: 'mainnet',
                    serverUri: daemonUrl,
                    primaryAddress: address,
                    privateViewKey: viewKey,
                    restoreHeight: Number(process.env.MONERO_RESTORE_HEIGHT) || 3572608
                });
            }

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

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.wallet.sync();
            await this.wallet.save();
            const balanceBig = await this.wallet.getBalance();
            this.lastBalance = parseFloat(balanceBig.toString()) / 1e12;
            this.lastHeight = await this.wallet.getHeight();
            console.log(`[MONERO] Sync Complete. Balance: ${this.lastBalance} XMR`);
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
        return subaddress.getAddress();
    }

    async checkPremiumPayments() {
        if (!this.wallet || this.isSyncing) return;
        console.log('[MONERO] Checking for new premium payments...');

        try {
            // Get users waiting for activation
            const pendingUsers = await new Promise((res) => {
                db.all('SELECT id, premium_subaddress_index FROM users WHERE is_premium = 0 AND premium_subaddress_index IS NOT NULL', (err, rows) => {
                    res(rows || []);
                });
            });

            if (pendingUsers.length === 0) return;

            // Simple check: Any transfer to the specific subaddress index with confirmations >= 1
            for (const user of pendingUsers) {
                const transfers = await this.wallet.getTransfers({
                    accountIndex: 0,
                    subaddressIndex: user.premium_subaddress_index,
                    isIncoming: true
                });

                const confirmedTransfer = transfers.find(t => {
                    try {
                        const confs = t.getNumConfirmations();
                        return confs !== undefined && confs >= 1;
                    } catch (e) {
                        return false;
                    }
                });

                if (confirmedTransfer) {
                    console.log(`[MONERO] Payment detected for user ${user.id}! Activating Premium.`);
                    await new Promise((res) => {
                        db.run('UPDATE users SET is_premium = 1, premium_activated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id], () => res());
                    });
                }
            }
        } catch (err) {
            console.error('[MONERO] Payment Check Error:', err);
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
