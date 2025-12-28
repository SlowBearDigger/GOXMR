const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath);

console.log('🚀 Starting Migration V4: Adding music_url column...');

db.serialize(() => {
    // Check if column exists first
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('❌ Error checking table info:', err);
            process.exit(1);
        }

        const hasMusicUrl = rows.some(row => row.name === 'music_url');

        if (!hasMusicUrl) {
            console.log('📦 Adding music_url column to users table...');
            db.run("ALTER TABLE users ADD COLUMN music_url TEXT", (err) => {
                if (err) {
                    console.error('❌ Error adding music_url column:', err);
                } else {
                    console.log('✅ music_url column added successfully.');
                }
                db.close();
            });
        } else {
            console.log('ℹ️ music_url column already exists. Skipping.');
            db.close();
        }
    });
});
