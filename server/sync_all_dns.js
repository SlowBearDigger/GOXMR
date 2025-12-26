const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Import shared cPanel DNS logic
const { updateDNS, getZoneRecords } = require('./cpanel_dns');

const dbPath = path.join(__dirname, 'database.db');

const syncAll = async () => {
    console.log('🚀 Starting Batch cPanel DNS Synchronization...');
    let logBuffer = [];
    const log = (msg) => {
        console.log(msg);
        logBuffer.push(msg);
    };

    const db = new sqlite3.Database(dbPath);

    try {
        // 1. Get all users with XMR wallets
        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT u.username, w.address 
                FROM users u 
                JOIN wallets w ON u.id = w.user_id 
                WHERE w.currency = 'XMR'
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        log(`📊 Found ${users.length} users with Monero addresses.`);

        // 2. Iterate and update each via cPanel
        // Note: cPanel API doesn't have a clean "batch mass edit" for arbitrary zone changes 
        // that is easy to use, so we iterate for now.
        for (const user of users) {
            log(`🔄 Syncing ${user.username}...`);
            try {
                const success = await updateDNS(user.username, user.address);
                if (success) {
                    log(`✅ ${user.username} synced.`);
                } else {
                    log(`❌ ${user.username} failed.`);
                }
            } catch (e) {
                log(`❌ Error for ${user.username}: ${e.message}`);
            }
        }

        log('🏁 Batch Synchronization Complete.');
        return { success: true, logs: logBuffer };

    } catch (err) {
        log(`❌ BATCH SYNC FAILED: ${err.message}`);
        return { success: false, logs: logBuffer, error: err.message };
    } finally {
        db.close();
    }
};

if (require.main === module) {
    syncAll();
}

module.exports = { syncAll };
