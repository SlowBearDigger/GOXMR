const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});
const initDb = () => {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                recovery_hash TEXT,
                display_name TEXT,
                bio TEXT,
                profile_image TEXT,
                banner_image TEXT,
                design_config TEXT,
                pgp_public_key TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating users table', err);
            else console.log('Users table ready');
        });
        db.run(`ALTER TABLE users ADD COLUMN recovery_hash TEXT`, (err) => {
        });
        db.run(`ALTER TABLE users ADD COLUMN design_config TEXT`, (err) => {
        });
        db.run(`ALTER TABLE users ADD COLUMN pgp_public_key TEXT`, (err) => {
        });
        db.run(`
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                currency TEXT,
                label TEXT,
                address TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        db.run(`
             CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                type TEXT,
                title TEXT,
                url TEXT,
                icon TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        db.run(`ALTER TABLE links ADD COLUMN icon TEXT`, (err) => {
        });
        db.run(`
            CREATE TABLE IF NOT EXISTS authenticators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                credential_id TEXT NOT NULL,
                credential_public_key TEXT NOT NULL,
                counter INTEGER,
                transports TEXT,
                attachment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('Error creating authenticators table', err);
            else console.log('Authenticators table ready');
        });
        db.run(`ALTER TABLE authenticators ADD COLUMN attachment TEXT`, (err) => {
        });
    });
};
initDb();
module.exports = db;
