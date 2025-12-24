const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);
const columnsToAdd = [
    { name: 'display_name', type: 'TEXT' },
    { name: 'bio', type: 'TEXT' },
    { name: 'profile_image', type: 'TEXT' },
    { name: 'banner_image', type: 'TEXT' }
];
const runMigration = async () => {
    console.log("Starting migration...");
    for (const col of columnsToAdd) {
        await new Promise((resolve) => {
            db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                if (err && err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else if (err) {
                    console.error(`Error adding ${col.name}:`, err.message);
                } else {
                    console.log(`Added column: ${col.name}`);
                }
                resolve();
            });
        });
    }
    console.log("Migration complete.");
    db.close();
};
runMigration();
