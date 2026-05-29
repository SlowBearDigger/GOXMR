require('dotenv').config();
const axios = require('axios');

let TROCADOR_API_KEY = process.env.TROCADOR_API_KEY;
if (!TROCADOR_API_KEY) process.exit(1);
TROCADOR_API_KEY = TROCADOR_API_KEY.trim();

console.log(`🔑 Testing Key: ${TROCADOR_API_KEY.substring(0, 4)}...4Ex2 (Len: ${TROCADOR_API_KEY.length})`);

const tests = [
    { name: 'Standard /coins', url: 'https://api.trocador.app/coins', headers: { 'API-Key': TROCADOR_API_KEY } },
    { name: 'Trailing Slash /coins/', url: 'https://api.trocador.app/coins/', headers: { 'API-Key': TROCADOR_API_KEY } },
    { name: 'Lowercase Header', url: 'https://api.trocador.app/coins', headers: { 'api-key': TROCADOR_API_KEY } },
    { name: 'Alt Header (api_key)', url: 'https://api.trocador.app/coins', headers: { 'api_key': TROCADOR_API_KEY } },
];

(async () => {
    for (const t of tests) {
        try {
            console.log(`\nTesting: ${t.name}...`);
            await axios.get(t.url, { headers: t.headers });
            console.log('✅ SUCCESS!');
            process.exit(0); // Exit on first success
        } catch (err) {
            console.log(`❌ Failed: ${err.response ? err.response.status : err.message}`);
            if (err.response && err.response.data) {
                console.log(`   Msg: ${JSON.stringify(err.response.data)}`);
            }
        }
    }
    console.log('\n🏁 All variations failed.');
})();
