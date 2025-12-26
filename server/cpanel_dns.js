const axios = require('axios');
require('dotenv').config();

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
        console.log(`[CPANEL] Calling ${module}::${func}...`);
        const response = await axios.get(url, {
            params: params,
            headers: {
                'Authorization': `cpanel ${config.username}:${config.apiToken}`
            },
            timeout: 10000
        });

        if (response.data.errors && response.data.errors.length > 0) {
            const errBase = response.data.errors.join(', ');
            console.error(`[CPANEL] API logical error: ${errBase}`);
            throw new Error(`cPanel Error: ${errBase}`);
        }

        return response.data.data;
    } catch (err) {
        let errorDetail = err.message;
        if (err.response && err.response.data) {
            errorDetail = JSON.stringify(err.response.data);
        }
        console.error(`[CPANEL] Fetch Failed: ${url}`, errorDetail);
        throw new Error(`cPanel Request Failed: ${errorDetail}`);
    }
};

const getZoneRecords = async () => {
    const config = getCpanelConfig();
    return await callCpanel('DNS', 'parse_zone', { zone: config.domain });
};

const updateDNS = async (username, xmrAddress) => {
    const config = getCpanelConfig();
    const cleanUsername = username.toLowerCase().trim();
    const cleanAddress = xmrAddress.trim();
    const subdomain = `${cleanUsername}.${config.domain}.`;

    console.log(`[CPANEL] Updating DNS for ${cleanUsername} via mass_edit_zone...`);

    try {
        // 1. Get existing records and find the SOA serial
        const records = await getZoneRecords();

        // DEBUG: Log structure if SOA fails
        const soaRecord = records.find(r => r.type === 'SOA' || r.record_type === 'SOA');

        if (!soaRecord) {
            console.log('[DEBUG] Records (filtered keys):', records.map(r => ({ type: r.type, record_type: r.record_type, name: r.name })));
            if (records.length > 0) {
                console.log('[DEBUG] First record full sample:', JSON.stringify(records[0], null, 2));
            }
            throw new Error('Could not find SOA record in zone');
        }

        // Try to get serial from 'serial' property first, then data array
        let serial = soaRecord.serial;
        if (!serial) {
            if (soaRecord.data && Array.isArray(soaRecord.data) && soaRecord.data.length >= 3) {
                serial = soaRecord.data[2];
            }
        }

        if (!serial) {
            console.log('[DEBUG] SOA Record found but no serial:', JSON.stringify(soaRecord, null, 2));
            throw new Error('Could not extract serial number from SOA record');
        }

        // 2. Prepare atomic edits
        const edits = [];

        // Find and remove existing records for this user
        const existingRecords = records.filter(r =>
            r.name === subdomain && (r.type === 'TXT' || r.type === 'A')
        );

        existingRecords.forEach(record => {
            edits.push({ action: 'remove', line: record.line });
        });

        // Add New OpenAlias TXT
        edits.push({
            action: 'add',
            name: cleanUsername,
            type: 'TXT',
            txtdata: `oa1:xmr recipient_address=${cleanAddress}; recipient_name=${cleanUsername}; tx_description=GoXMR_Sovereign_Identity;`,
            class: 'IN',
            ttl: 14400
        });

        // Add New Subdomain A
        edits.push({
            action: 'add',
            name: cleanUsername,
            type: 'A',
            address: '66.29.141.119',
            class: 'IN',
            ttl: 14400
        });

        // 3. Commit the mass edit
        console.log(`[CPANEL] Committing ${edits.length} edits for ${cleanUsername} (Serial: ${serial})...`);
        await callCpanel('DNS', 'mass_edit_zone', {
            zone: config.domain,
            serial: serial,
            edit: JSON.stringify(edits)
        });

        console.log(`[CPANEL] DNS Update Successful for ${cleanUsername}`);
        return true;
    } catch (err) {
        console.error(`[CPANEL] DNS Update Failed for ${cleanUsername}:`, err.message);
        return false;
    }
};

module.exports = { updateDNS, getZoneRecords, callCpanel };
