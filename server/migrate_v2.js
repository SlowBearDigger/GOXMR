const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);
const migrate = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT,
            title TEXT,
            url TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creating links table:", err);
            else console.log("Links table ready.");
        });
        db.run(`CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            currency TEXT,
            label TEXT,
            address TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creating wallets table:", err);
            else console.log("Wallets table ready.");
        });
        db.run(`ALTER TABLE users ADD COLUMN design_config TEXT`, (err) => {
            if (err && err.message.includes('duplicate column')) {
                console.log("design_config column already exists.");
            } else if (err) {
                console.error("Error adding design_config:", err);
            } else {
                console.log("Added design_config column.");
            }
        });
    });
};
migrate();
