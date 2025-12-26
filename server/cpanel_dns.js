const axios = require('axios');
require('dotenv').config();

/**
 * CPANEL_CONFIG = {
 *   apiToken: process.env.CPANEL_API_TOKEN,
 *   username: process.env.CPANEL_USERNAME,
 *   host: process.env.CPANEL_HOST, // e.g., 'goxmr.click'
 *   baseUrl: process.env.CPANEL_BASE_URL || `https://${process.env.CPANEL_HOST}:2083`
 * }
 */

const getCpanelConfig = () => ({
    apiToken: process.env.CPANEL_API_TOKEN,
    username: process.env.CPANEL_USERNAME,
    domain: process.env.CPANEL_HOST || 'goxmr.click',
    baseUrl: process.env.CPANEL_BASE_URL || `https://${process.env.CPANEL_HOST || 'goxmr.click'}:2083`
});

const callCpanel = async (module, func, params = {}) => {
    const config = getCpanelConfig();
    if (!config.apiToken || !config.username) {
        throw new Error('CPANEL_API_TOKEN or CPANEL_USERNAME missing');
    }

    const url = `${config.baseUrl}/execute/${module}/${func}`;

    try {
        const response = await axios.get(url, {
            params: params,
            headers: {
                'Authorization': `cpanel ${config.username}:${config.apiToken}`
            }
        });

        if (response.data.errors && response.data.errors.length > 0) {
            throw new Error(`cPanel Error: ${response.data.errors.join(', ')}`);
        }

        return response.data.data;
    } catch (err) {
        if (err.response && err.response.data && err.response.data.errors) {
            throw new Error(`cPanel API Error: ${err.response.data.errors.join(', ')}`);
        }
        throw err;
    }
};

/**
 * Fetches existing zone records for the domain
 */
const getZoneRecords = async () => {
    const config = getCpanelConfig();
    return await callCpanel('DNS', 'parse_zone', { domain: config.domain });
};

/**
 * Adds or Updates a DNS record for a user
 */
const updateDNS = async (username, xmrAddress) => {
    const config = getCpanelConfig();
    const cleanUsername = username.toLowerCase().trim();
    const cleanAddress = xmrAddress.trim();
    const subdomain = `${cleanUsername}.${config.domain}.`;

    console.log(`[CPANEL] Updating DNS for ${cleanUsername}...`);

    try {
        // 1. Get existing records to check for duplicates/old ones
        const records = await getZoneRecords();

        // Find existing TXT and A records for this subdomain
        const existingRecords = records.filter(r =>
            r.name === subdomain && (r.type === 'TXT' || r.type === 'A')
        );

        // 2. Delete existing records if they exist (to avoid duplication)
        // cPanel usually needs 'line' to delete
        for (const record of existingRecords) {
            console.log(`[CPANEL] Removing existing ${record.type} record for ${cleanUsername} (line ${record.line})...`);
            await callCpanel('DNS', 'remove_zone_record', {
                domain: config.domain,
                line: record.line
            });
        }

        // 3. Add New OpenAlias TXT Record
        console.log(`[CPANEL] Adding OpenAlias TXT record for ${cleanUsername}...`);
        await callCpanel('DNS', 'add_zone_record', {
            domain: config.domain,
            name: cleanUsername,
            type: 'TXT',
            txtdata: `oa1:xmr recipient_address=${cleanAddress}; recipient_name=${cleanUsername}; tx_description=GoXMR_Sovereign_Identity;`,
            class: 'IN',
            ttl: 14400
        });

        // 4. Add Subdomain A Record (Pointing to server IP)
        // Note: Using the discovery from previous step (66.29.141.119)
        console.log(`[CPANEL] Adding A record for ${cleanUsername}...`);
        await callCpanel('DNS', 'add_zone_record', {
            domain: config.domain,
            name: cleanUsername,
            type: 'A',
            address: '66.29.141.119',
            class: 'IN',
            ttl: 14400
        });

        console.log(`[CPANEL] DNS Update Successful for ${cleanUsername}`);
        return true;
    } catch (err) {
        console.error(`[CPANEL] DNS Update Failed for ${cleanUsername}:`, err.message);
        return false;
    }
};

module.exports = { updateDNS, getZoneRecords, callCpanel };
