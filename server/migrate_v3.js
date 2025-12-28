const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const migrate = () => {
    db.serialize(() => {
        db.run(`ALTER TABLE users ADD COLUMN handle_config TEXT`, (err) => {
            if (err && err.message.includes('duplicate column')) {
                console.log("handle_config column already exists.");
            } else if (err) {
                console.error("Error adding handle_config:", err);
            } else {
                console.log("Added handle_config column.");
            }
        });
    });
};

migrate();
setTimeout(() => db.close(), 1000);
