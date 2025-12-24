const db = require('./db');
const targetUser = 'SlowBearDigger';
db.serialize(() => {
    db.get('SELECT id, username FROM users WHERE LOWER(username) = ?', [targetUser.toLowerCase()], (err, row) => {
        if (err) {
            console.error('Error fetching user:', err);
            return;
        }
        if (!row) {
            console.log(`User '${targetUser}' (or variant) not found in database.`);
            return;
        }
        const userId = row.id;
        console.log(`Found user '${row.username}' with ID: ${userId}. Purging...`);
        db.run('DELETE FROM authenticators WHERE user_id = ?', [userId], (err) => {
            if (err) console.error('Error deleting authenticators:', err);
            else console.log('- Authenticators deleted');
        });
        db.run('DELETE FROM links WHERE user_id = ?', [userId], (err) => {
            if (err) console.error('Error deleting links:', err);
            else console.log('- Links deleted');
        });
        db.run('DELETE FROM wallets WHERE user_id = ?', [userId], (err) => {
            if (err) console.error('Error deleting wallets:', err);
            else console.log('- Wallets deleted');
        });
        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
            if (err) console.error('Error deleting user:', err);
            else console.log(`- User '${row.username}' fully PURGED.`);
        });
    });
});
