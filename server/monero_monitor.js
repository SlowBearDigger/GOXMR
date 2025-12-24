const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');

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

            // Ensure protocol is present
            if (!daemonUrl.startsWith('http://') && !daemonUrl.startsWith('https://')) {
                daemonUrl = 'https://' + daemonUrl;
                console.log(`[MONERO] Prepended https:// to daemon URL: ${daemonUrl}`);
            }

            console.log(`[MONERO] Config Check: Address=${!!address}, ViewKey=${!!viewKey}, Daemon=${daemonUrl}`);

            if (!address || !viewKey) {
                console.warn('[MONERO] Missing credentials. Monitor disabled.');
                this.statusMessage = 'Disabled: Missing Credentials (MONERO_WALLET_ADDRESS / MONERO_VIEW_KEY)';
                return;
            }

            const walletExists = fs.existsSync(this.walletPath) || fs.existsSync(this.walletPath + '.keys');

            if (walletExists) {
                console.log(`[MONERO] Loading existing wallet from ${this.walletPath}`);
                this.statusMessage = 'Loading existing wallet...';
                this.wallet = await monerojs.openWalletFull({
                    path: this.walletPath,
                    password: 'super_secret_local_password',
                    networkType: 'mainnet'
                });
                await this.wallet.setDaemonConnection(daemonUrl);
            } else {
                console.log(`[MONERO] Creating new view-only wallet...`);
                this.statusMessage = 'Creating new wallet...';
                this.wallet = await monerojs.createWalletFull({
                    path: this.walletPath,
                    password: 'super_secret_local_password',
                    networkType: 'mainnet',
                    serverUri: daemonUrl,
                    primaryAddress: address,
                    privateViewKey: viewKey,
                    restoreHeight: Number(process.env.MONERO_RESTORE_HEIGHT) || 3572608
                });
                await this.wallet.setRestoreHeight(Number(process.env.MONERO_RESTORE_HEIGHT) || 3572608);
            }

            console.log('[MONERO] Wallet loaded. Starting background sync...');
            this.statusMessage = 'Wallet loaded. Syncing...';
            this.startSync();
        } catch (error) {
            console.error('[MONERO] Initialization Failed:', error);
            this.statusMessage = `Init Failed: ${error.message}`;
        }
    }

    async startSync() {
        if (!this.wallet) return;
        this.sync();
        setInterval(() => this.sync(), 2 * 60 * 1000);
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        console.log('[MONERO] Syncing...');
        try {
            await this.wallet.sync();
            await this.wallet.save();
            const balanceBig = await this.wallet.getBalance();
            this.lastBalance = parseFloat(balanceBig.toString()) / 1e12;
            this.lastHeight = await this.wallet.getHeight();
            console.log(`[MONERO] Sync Complete. Balance: ${this.lastBalance} XMR. Height: ${this.lastHeight}`);
            this.statusMessage = 'Synced';
        } catch (err) {
            console.error('[MONERO] Sync Error:', err);
            this.statusMessage = `Sync Error: ${err.message}`;
        } finally {
            this.isSyncing = false;
        }
    }

    getStatus() {
        return {
            balance: this.lastBalance,
            height: this.lastHeight,
            isSyncing: this.isSyncing,
            goal: 5.0,
            message: this.statusMessage
        };
    }
}

module.exports = new MoneroMonitor();
