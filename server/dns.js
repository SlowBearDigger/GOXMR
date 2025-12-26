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
        const hosts = data.ApiResponse.CommandResponse[0].DomainDNSGetHostsResult[0].host;

        return hosts.map(h => ({
            Name: h.$.Name,
            Type: h.$.Type,
            Address: h.$.Address,
            MXPref: h.$.MXPref,
            TTL: h.$.TTL
        }));
    } catch (err) {
        console.error('[DNS] Error fetching hosts:', err);
        throw err;
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

module.exports = { updateOpenAlias };
