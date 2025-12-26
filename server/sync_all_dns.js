const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Import shared robust DNS logic
const { getHosts, parseXml } = require('./dns');

const dbPath = path.join(__dirname, 'database.db');

const NC_CONFIG = {
    apiKey: process.env.NAMECHEAP_API_KEY,
    apiUser: process.env.NAMECHEAP_API_USER,
    userName: process.env.NAMECHEAP_USERNAME,
    clientIp: process.env.NAMECHEAP_CLIENT_IP,
    domain: 'goxmr.click'
};

// function to allow calling from API
const syncAll = async () => {
    console.log('🚀 Starting Batch DNS Synchronization...');
    let logBuffer = [];
    const log = (msg) => {
        console.log(msg);
        logBuffer.push(msg);
    };

    // Initialize DB connection for this run
    const db = new sqlite3.Database(dbPath);

    if (!NC_CONFIG.apiKey || !NC_CONFIG.apiUser) {
        log('❌ ERROR: Namecheap API credentials missing in .env');
        db.close();
        return { success: false, logs: logBuffer };
    }

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

        // 2. Fetch current DNS records using robust shared function
        log('📥 Fetching current DNS records from Namecheap...');
        let currentHosts;
        try {
            currentHosts = await getHosts();
        } catch (e) {
            log(`❌ Failed to fetch hosts: ${e.message}`);
            return { success: false, logs: logBuffer, error: e.message };
        }

        // 3. Prepare new host list
        let hostMap = new Map();
        currentHosts.forEach(h => hostMap.set(`${h.Name}:${h.Type}`, h));

        users.forEach(user => {
            const username = user.username.toLowerCase();
            const address = user.address.trim();

            hostMap.set(`${username}:TXT`, {
                Name: username,
                Type: 'TXT',
                Address: `oa1:xmr recipient_address=${address}; recipient_name=${username}; tx_description=GoXMR_Sovereign_Identity;`,
                MXPref: '10',
                TTL: '1799'
            });

            hostMap.set(`${username}:A`, {
                Name: username,
                Type: 'A',
                Address: '66.29.141.122',
                MXPref: '10',
                TTL: '1799'
            });
        });

        const finalHosts = Array.from(hostMap.values());
        log(`📝 Prepared ${finalHosts.length} host records.`);

        // 4. Update Namecheap
        const [sld, tld] = NC_CONFIG.domain.split('.');
        const params = {
            ApiUser: NC_CONFIG.apiUser,
            ApiKey: NC_CONFIG.apiKey,
            UserName: NC_CONFIG.userName,
            ClientIp: NC_CONFIG.clientIp,
            Command: 'namecheap.domains.dns.setHosts',
            SLD: sld,
            TLD: tld
        };

        finalHosts.forEach((host, index) => {
            const n = index + 1;
            params[`HostName${n}`] = host.Name;
            params[`RecordType${n}`] = host.Type;
            params[`Address${n}`] = host.Address;
            params[`MXPref${n}`] = host.MXPref || '10';
            params[`TTL${n}`] = host.TTL || '1799';
        });

        log('📤 Uploading updated host records to Namecheap...');
        const response = await axios.post('https://api.namecheap.com/xml.response', null, { params });
        const result = await parseXml(response.data);

        // DEBUG: Force error with structure if things look wrong
        if (!result.ApiResponse || !result.ApiResponse.$.Status) {
            const debugInfo = JSON.stringify(result, null, 2);
            log(`❌ Namecheap API Response Invalid: ${debugInfo}`);
            return { success: false, logs: logBuffer, error: 'Invalid Structure' };
        }

        if (result.ApiResponse.$.Status === 'OK') {
            log('✅ SUCCESS: All DNS records synchronized successfully.');
            return { success: true, logs: logBuffer };
        } else {
            const errorMsg = JSON.stringify(result.ApiResponse.Errors);
            log(`❌ ERROR: ${errorMsg}`);
            return { success: false, logs: logBuffer, error: errorMsg };
        }

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
