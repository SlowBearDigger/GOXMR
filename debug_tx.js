const monerojs = require('monero-ts');
const path = require('path');
const fs = require('fs');
const db = require('./server/db'); // Adjust path if needed

async function debugTx(userId, txidInput) {
    const txid = txidInput.trim();
    console.log(`[DEBUG] Inspecting TXID: ${txid} for user ${userId}`);

    // CONFIG
    const walletPath = process.env.MONERO_WALLET_PATH ? path.resolve(process.env.MONERO_WALLET_PATH) : path.resolve('./wallet_data/dev_fund_wallet');
    const password = process.env.MONERO_WALLET_PASSWORD || 'super_secret_local_password';
    let daemonUrl = (process.env.MONERO_WALLET_RPC_URL || process.env.MONERO_NODE_URL || 'https://node.monerohash.com:443').trim();
    if (!daemonUrl.startsWith('http')) daemonUrl = 'https://' + daemonUrl;

    console.log(`[DEBUG] Wallet Path: ${walletPath}`);
    console.log(`[DEBUG] Daemon: ${daemonUrl}`);

    try {
        const wallet = await monerojs.openWalletFull({
            path: walletPath,
            password: password,
            networkType: 'mainnet'
        });
        await wallet.setDaemonConnection(daemonUrl);
        console.log(`[DEBUG] Wallet opened. Address: ${await wallet.getPrimaryAddress()}`);

        const height = await wallet.getHeight();
        const daemonHeight = await wallet.getDaemonHeight();
        console.log(`[DEBUG] Wallet Height: ${height}, Daemon Height: ${daemonHeight}`);

        // Get user index
        const user = await new Promise((res, rej) => {
            db.get('SELECT premium_subaddress_index FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) rej(err); else res(row);
            });
        });

        if (!user) { console.error("User not found in DB"); return; }
        console.log(`[DEBUG] User Index: ${user.premium_subaddress_index}`);

        console.log("[DEBUG] Fetching transfers...");
        const transfers = await wallet.getTransfers({
            accountIndex: 0,
            subaddressIndex: user.premium_subaddress_index,
            isIncoming: true
        });

        console.log(`[DEBUG] Found ${transfers.length} transfers.`);

        // Find match loosely
        const match = transfers.find(t => {
            // Try everything to print
            const hash = (t.getTxHash && t.getTxHash()) || (t.getHash && t.getHash()) || "unknown";
            return hash === txid;
        });

        if (match) {
            console.log("\n[DEBUG] !!! MATCH FOUND !!!");
            console.log("---------------------------------------------------");

            // REFLECTION MAGIC: access internal state if possible or just print proto
            console.log("Transfer Object Keys:", Object.keys(match));

            // Try standard methods
            const methods = ['getAmount', 'getNumConfirmations', 'getConfirmations', 'getHeight', 'getBlockHeight', 'isConfirmed', 'isDoubleSpend', 'getTxHubOutput'];

            methods.forEach(m => {
                if (typeof match[m] === 'function') {
                    try {
                        console.log(`${m}():`, match[m]());
                    } catch (e) {
                        console.log(`${m}(): ERROR - ${e.message}`);
                    }
                } else {
                    console.log(`${m}: (not a function)`);
                }
            });

            console.log("\nProperties:");
            console.log("amount:", match.amount);
            console.log("numConfirmations:", match.numConfirmations);
            console.log("confirmations:", match.confirmations);
            console.log("height:", match.height);
            console.log("blockHeight:", match.blockHeight);

            // Deep JSON print (might be circular)
            try {
                // Simplified object for JSON
                const simple = {};
                for (let k in match) {
                    if (typeof match[k] !== 'function') simple[k] = match[k];
                }
                console.log("\nJSON Dump:", JSON.stringify(simple, null, 2));
            } catch (e) { console.log("JSON Dump failed"); }

            console.log("---------------------------------------------------");
        } else {
            console.log("[DEBUG] TXID NOT FOUND in wallet list.");
            console.log("Available hashes:");
            transfers.forEach(t => {
                const hash = (t.getTxHash && t.getTxHash()) || (t.getHash && t.getHash());
                console.log("- " + hash);
            });
        }

    } catch (e) {
        console.error("[DEBUG] CRITICAL ERROR:", e);
    }
}

// ARGS: userId, txid
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node debug_tx.js <userId> <txid>");
} else {
    debugTx(args[0], args[1]);
}
