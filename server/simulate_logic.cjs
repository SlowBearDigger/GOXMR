const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const dbGet = (query, params) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (query, params) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

async function simulate(username) {
    try {
        console.log(`Simulating logic for: ${username}`);
        const user = await dbGet('SELECT id, username, display_name, bio, profile_image, handle_config FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);

        if (!user) {
            console.log("User not found");
            return;
        }

        console.log("User found:", JSON.stringify(user, null, 2));

        const wallets = await dbAll('SELECT currency, address FROM wallets WHERE user_id = ?', [user.id]);
        console.log("Wallets found:", JSON.stringify(wallets, null, 2));

        const handleConfig = user.handle_config ? JSON.parse(user.handle_config) : { enabled_currencies: ['XMR'] };
        console.log("Handle Config:", JSON.stringify(handleConfig, null, 2));

        let bioContent = user.bio || '';
        let walletLines = [];

        wallets.forEach(w => {
            console.log(`Checking currency: '${w.currency}' against enabled:`, handleConfig.enabled_currencies);
            if (handleConfig.enabled_currencies.includes(w.currency)) {
                walletLines.push(`${w.currency}: ${w.address}`);
            }
        });

        if (walletLines.length > 0) {
            bioContent += "\n\n" + walletLines.join("\n");
        }

        console.log("\n--- Resulting Note ---");
        console.log(bioContent);
        console.log("----------------------");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        db.close();
    }
}

simulate('SlowBearDigger');
