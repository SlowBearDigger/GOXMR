const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();

const NC_CONFIG = {
    apiKey: process.env.NAMECHEAP_API_KEY,
    apiUser: process.env.NAMECHEAP_API_USER,
    userName: process.env.NAMECHEAP_USERNAME,
    clientIp: process.env.NAMECHEAP_CLIENT_IP,
    domain: 'goxmr.click'
};

const NC_ENDPOINT = 'https://api.namecheap.com/xml.response';

const parseXml = (xml) => {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xml, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

const getHosts = async () => {
    const [sld, tld] = NC_CONFIG.domain.split('.');
    try {
        console.log(`[DNS] Fetching hosts for ${NC_CONFIG.domain}...`);
        const response = await axios.get(NC_ENDPOINT, {
            params: {
                ApiUser: NC_CONFIG.apiUser,
                ApiKey: NC_CONFIG.apiKey,
                UserName: NC_CONFIG.userName,
                ClientIp: NC_CONFIG.clientIp,
                Command: 'namecheap.domains.dns.getHosts',
                SLD: sld,
                TLD: tld
            }
        });

        const data = await parseXml(response.data);

        // DEBUG: Force error with structure if things look wrong
        if (!data.ApiResponse || !data.ApiResponse.CommandResponse) {
            const debugInfo = JSON.stringify(data, null, 2);
            console.error('[DNS] Invalid Response:', debugInfo);
            throw new Error(`Invalid API Response Structure. Received: ${debugInfo}`);
        }

        if (data.ApiResponse.Errors && data.ApiResponse.Errors[0] && data.ApiResponse.Errors[0].Error) {
            console.error('[DNS] API Error Response:', JSON.stringify(data.ApiResponse.Errors[0].Error));
            throw new Error(`Namecheap API Error: ${data.ApiResponse.Errors[0].Error[0]._}`);
        }

        if (!data.ApiResponse.CommandResponse ||
            !data.ApiResponse.CommandResponse[0] ||
            !data.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult ||
            !data.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0]) {

            const debugInfo = JSON.stringify(data, null, 2);
            console.error('[DNS] Unexpected Response Structure:', debugInfo);
            throw new Error(`Unexpected Response Structure (No Hosts Result). Received: ${debugInfo}`);
        }

        const hosts = data.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0].host;

        return hosts.map(h => ({
            Name: h.$.Name,
            Type: h.$.Type,
            Address: h.$.Address,
            MXPref: h.$.MXPref,
            TTL: h.$.TTL
        }));
    } catch (err) {
        console.error('[DNS] Error fetching hosts details:', err.message);
        // Do not throw, return empty to prevent creating a loop of retries if API is down
        // throwing would convert to 500 in the endpoint
        // Ensure the full debug info bubbles up to the sync log
        throw new Error(`DNS Fetch Failed: ${err.message}`);
    }
};

const updateOpenAlias = async (username, xmrAddress) => {
    if (!NC_CONFIG.apiKey || !NC_CONFIG.apiUser) {
        console.warn('[DNS] Namecheap API credentials missing. skipping automation.');
        return;
    }

    try {
        const [sld, tld] = NC_CONFIG.domain.split('.');
        const currentHosts = await getHosts();

        // Filter out existing OA TXT and A records for this user to avoid duplicates
        let newHosts = currentHosts.filter(h =>
            !(h.Name === username && (h.Type === 'TXT' || h.Type === 'A'))
        );

        // Add the OpenAlias TXT record
        const cleanAddress = xmrAddress.trim();
        newHosts.push({
            Name: username,
            Type: 'TXT',
            Address: `oa1:xmr recipient_address=${cleanAddress}; recipient_name=${username}; tx_description=GoXMR_Sovereign_Identity;`,
            MXPref: '10',
            TTL: '1799'
        });

        // Add the A record for the subdomain (optional but good for browser discovery)
        newHosts.push({
            Name: username,
            Type: 'A',
            Address: '66.29.141.122',
            MXPref: '10',
            TTL: '1799'
        });

        // Build the request body for setHosts
        // Namecheap requires HostNameN, RecordTypeN, AddressN, MXPrefN, TTLN
        const params = {
            ApiUser: NC_CONFIG.apiUser,
            ApiKey: NC_CONFIG.apiKey,
            UserName: NC_CONFIG.userName,
            ClientIp: NC_CONFIG.clientIp,
            Command: 'namecheap.domains.dns.setHosts',
            SLD: sld,
            TLD: tld
        };

        newHosts.forEach((host, index) => {
            const n = index + 1;
            params[`HostName${n}`] = host.Name;
            params[`RecordType${n}`] = host.Type;
            params[`Address${n}`] = host.Address;
            params[`MXPref${n}`] = host.MXPref || '10';
            params[`TTL${n}`] = host.TTL || '1799';
        });

        const response = await axios.post(NC_ENDPOINT, null, { params });
        const result = await parseXml(response.data);

        if (result.ApiResponse.$.Status === 'OK') {
            console.log(`[DNS] Successfully updated records for ${username}`);
            return true;
        } else {
            console.error('[DNS] Error updating records:', JSON.stringify(result.ApiResponse.Errors));
            return false;
        }
    } catch (err) {
        console.error('[DNS] Update Failed:', err);
        return false;
    }
};

module.exports = { updateOpenAlias, getHosts, parseXml };
