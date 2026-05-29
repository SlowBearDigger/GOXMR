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
        const migrations = [
            `ALTER TABLE users ADD COLUMN recovery_hash TEXT`,
            `ALTER TABLE users ADD COLUMN design_config TEXT`,
            `ALTER TABLE users ADD COLUMN pgp_public_key TEXT`,
            `ALTER TABLE users ADD COLUMN handle_config TEXT`,
            `ALTER TABLE users ADD COLUMN music_url TEXT`,
            `ALTER TABLE users ADD COLUMN premium_subaddress_index INTEGER`,
            `ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN premium_activated_at DATETIME`,
            `ALTER TABLE users ADD COLUMN tokens_valid_after INTEGER`
        ];

        migrations.forEach(sql => {
            db.run(sql, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    // Ignore expected "already exists" errors, log others
                    console.log(`[DB Migration] Note: ${sql.slice(0, 30)}... skipped or already applied.`);
                } else if (!err) {
                    console.log(`[DB Migration] Applied: ${sql}`);
                }
            });
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

        // --- SIGNALS & DROPS ---
        db.run(`
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                short_code TEXT UNIQUE NOT NULL,
                original_url TEXT NOT NULL,
                user_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                visit_count INTEGER DEFAULT 0,
                password_hash TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS drops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drop_code TEXT UNIQUE NOT NULL,
                encrypted_content TEXT NOT NULL,
                user_id INTEGER,
                is_encrypted BOOLEAN DEFAULT 1,
                encryption_method TEXT, -- 'AES' or 'PGP'
                burn_after_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        db.run(`CREATE INDEX IF NOT EXISTS idx_signals_code ON signals(short_code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_drops_code ON drops(drop_code)`);

        // --- STORE ---
        db.run(`
            CREATE TABLE IF NOT EXISTS store_config (
                user_id INTEGER PRIMARY KEY,
                encrypted_wallet TEXT,
                public_wallet_address TEXT,
                view_key_hash TEXT,
                monero_address TEXT,
                encrypted_view_key TEXT,
                auto_verify INTEGER DEFAULT 0,
                is_verified INTEGER DEFAULT 0,
                store_name TEXT,
                store_bio TEXT,
                store_banner TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS store_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_type TEXT NOT NULL CHECK(product_type IN ('physical', 'digital', 'service')),
                encrypted_data TEXT NOT NULL,
                thumbnail_url TEXT,
                category TEXT,
                price_xmr REAL NOT NULL,
                stock INTEGER DEFAULT -1,
                is_active INTEGER DEFAULT 1,
                views INTEGER DEFAULT 0,
                sales INTEGER DEFAULT 0,
                name TEXT,
                description TEXT,
                visibility TEXT DEFAULT 'public',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS store_digital_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                content_type TEXT NOT NULL CHECK(content_type IN ('file', 'link', 'code', 'text')),
                encrypted_content TEXT NOT NULL,
                file_name TEXT,
                file_size INTEGER,
                download_limit INTEGER DEFAULT -1,
                downloads_used INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES store_products(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS store_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_code TEXT UNIQUE NOT NULL,
                product_id INTEGER NOT NULL,
                buyer_id INTEGER,
                seller_id INTEGER NOT NULL,
                encrypted_data TEXT NOT NULL,
                tx_hash TEXT,
                payment_address TEXT,
                buyer_proof TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'complete', 'cancelled', 'refunded', 'expired')),
                price_xmr REAL NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                FOREIGN KEY(product_id) REFERENCES store_products(id),
                FOREIGN KEY(buyer_id) REFERENCES users(id),
                FOREIGN KEY(seller_id) REFERENCES users(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS store_downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                content_id INTEGER NOT NULL,
                downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                ip_hash TEXT,
                FOREIGN KEY(order_id) REFERENCES store_orders(id),
                FOREIGN KEY(content_id) REFERENCES store_digital_content(id)
            )
        `);
        // 3C: rate limiting for product access-code unlock attempts. Keyed by ip_hash+product_id.
        // Hash the IP so the table doesn't store raw IP addresses.
        db.run(`
            CREATE TABLE IF NOT EXISTS store_unlock_attempts (
                ip_hash TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                attempt_count INTEGER DEFAULT 0,
                locked_until TEXT,
                last_attempt TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ip_hash, product_id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS store_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                order_id INTEGER NOT NULL UNIQUE,
                buyer_id INTEGER,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                encrypted_review TEXT,
                is_verified INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES store_products(id),
                FOREIGN KEY(order_id) REFERENCES store_orders(id),
                FOREIGN KEY(buyer_id) REFERENCES users(id)
            )
        `);

        // Store migrations for existing databases
        // These run on every startup — duplicates are silently ignored
        const storeMigrations = [
            // store_config columns
            `ALTER TABLE store_config ADD COLUMN monero_address TEXT`,
            `ALTER TABLE store_config ADD COLUMN encrypted_view_key TEXT`,
            `ALTER TABLE store_config ADD COLUMN auto_verify INTEGER DEFAULT 0`,
            `ALTER TABLE store_config ADD COLUMN is_verified INTEGER DEFAULT 0`,
            `ALTER TABLE store_config ADD COLUMN store_name TEXT`,
            `ALTER TABLE store_config ADD COLUMN store_bio TEXT`,
            `ALTER TABLE store_config ADD COLUMN store_banner TEXT`,
            `ALTER TABLE store_config ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`,
            `ALTER TABLE store_config ADD COLUMN store_pgp_public_key TEXT`,
            // 3E: JSON map of accepted non-XMR payment methods, e.g. {BTC:"bc1...", LTC:"ltc1..."}.
            // XMR is implicit (lives in monero_address). Other addresses are reused per order
            // (less privacy than XMR sub-addresses) — UI warns the seller.
            `ALTER TABLE store_config ADD COLUMN payment_addresses TEXT`,
            // #4.4: seller-controlled opt-in to appear on the public /market discovery page.
            // Default OFF — no store leaks to the marketplace without explicit consent.
            `ALTER TABLE store_config ADD COLUMN marketplace_optin INTEGER DEFAULT 0`,
            // store_orders columns
            `ALTER TABLE store_orders ADD COLUMN buyer_id INTEGER`,
            `ALTER TABLE store_orders ADD COLUMN seller_id INTEGER`,
            `ALTER TABLE store_orders ADD COLUMN order_code TEXT`,
            `ALTER TABLE store_orders ADD COLUMN encrypted_data TEXT`,
            `ALTER TABLE store_orders ADD COLUMN tx_hash TEXT`,
            `ALTER TABLE store_orders ADD COLUMN payment_address TEXT`,
            `ALTER TABLE store_orders ADD COLUMN buyer_proof TEXT`,
            `ALTER TABLE store_orders ADD COLUMN price_xmr REAL`,
            `ALTER TABLE store_orders ADD COLUMN status TEXT DEFAULT 'pending'`,
            `ALTER TABLE store_orders ADD COLUMN completed_at TEXT`,
            `ALTER TABLE store_orders ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`,
            `ALTER TABLE store_orders ADD COLUMN payment_subaddress_index INTEGER`,
            // store_products columns
            `ALTER TABLE store_products ADD COLUMN name TEXT`,
            `ALTER TABLE store_products ADD COLUMN description TEXT`,
            `ALTER TABLE store_products ADD COLUMN visibility TEXT DEFAULT 'public'`,
            `ALTER TABLE store_products ADD COLUMN views INTEGER DEFAULT 0`,
            `ALTER TABLE store_products ADD COLUMN sales INTEGER DEFAULT 0`,
            `ALTER TABLE store_products ADD COLUMN thumbnail_url TEXT`,
            `ALTER TABLE store_products ADD COLUMN category TEXT`,
            // buyer_form_fields: JSON array of {key,label,type,required} the buyer must fill at checkout.
            // The values are PGP-encrypted client-side with the seller's effective pubkey and stored as
            // ciphertext in store_orders.encrypted_data — server never sees the plaintext.
            `ALTER TABLE store_products ADD COLUMN buyer_form_fields TEXT`,
            // 3C: bcrypt hash of the seller-set access PIN. Plaintext never stored.
            // Combined with visibility='unlisted' it gates product details + ordering.
            `ALTER TABLE store_products ADD COLUMN access_code_hash TEXT`,
            // #10: older databases were created before is_active landed in the digital content
            // table's CREATE TABLE. Without this column, GET /api/store/products/id/:id 500s on
            // any digital product because the listing query filters by is_active.
            `ALTER TABLE store_digital_content ADD COLUMN is_active INTEGER DEFAULT 1`,
            // #10 (again): the download endpoint logs ip_hash but legacy schema named the column
            // ip_address. Add the new column; old rows just leave ip_hash NULL.
            `ALTER TABLE store_downloads ADD COLUMN ip_hash TEXT`,
            // #10: legacy digital content table missed the downloads_used counter too.
            `ALTER TABLE store_digital_content ADD COLUMN downloads_used INTEGER DEFAULT 0`,
            // store_reviews columns
            `ALTER TABLE store_reviews ADD COLUMN buyer_id INTEGER`,
            `ALTER TABLE store_reviews ADD COLUMN is_verified INTEGER DEFAULT 1`,
        ];
        storeMigrations.forEach(sql => {
            db.run(sql, () => {}); // Silently ignore if column already exists
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_products_user ON store_products(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON store_products(category)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_seller ON store_orders(seller_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_buyer ON store_orders(buyer_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_code ON store_orders(order_code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_digital_content_product ON store_digital_content(product_id)`);

        // --- ENCRYPTED MESSAGES ---
        db.run(`
            CREATE TABLE IF NOT EXISTS encrypted_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_user_id INTEGER NOT NULL,
                sender_name TEXT,
                encrypted_content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(recipient_user_id) REFERENCES users(id)
            )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON encrypted_messages(recipient_user_id)`);

        // --- DEAD MAN'S SWITCH ---
        db.run(`
            CREATE TABLE IF NOT EXISTS dead_mans_switches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                encrypted_content TEXT NOT NULL,
                encryption_method TEXT DEFAULT 'AES',
                recipient_code TEXT,
                heartbeat_interval_days INTEGER NOT NULL DEFAULT 30,
                last_heartbeat TEXT DEFAULT CURRENT_TIMESTAMP,
                next_trigger_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                is_triggered INTEGER DEFAULT 0,
                triggered_drop_code TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_deadman_trigger ON dead_mans_switches(is_active, next_trigger_at)`);

        // --- PGP DIRECT MESSAGES ---
        // Sender encrypts client-side with recipient's PGP public key, so the
        // payload stored here is opaque ciphertext only.
        db.run(`
            CREATE TABLE IF NOT EXISTS pgp_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user_id INTEGER NOT NULL,
                to_user_id INTEGER NOT NULL,
                encrypted_payload TEXT NOT NULL,
                subject TEXT,
                read_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(from_user_id) REFERENCES users(id),
                FOREIGN KEY(to_user_id) REFERENCES users(id)
            )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pgp_inbox ON pgp_messages(to_user_id, created_at DESC)`);

        // --- ANALYTICS ---
        db.run(`
            CREATE TABLE IF NOT EXISTS link_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link_id INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(link_id) REFERENCES links(id)
            )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(link_id)`);

        // Additional user column migrations
        const extraMigrations = [
            `ALTER TABLE users ADD COLUMN profile_views INTEGER DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN nostr_pubkey TEXT`,
            `ALTER TABLE users ADD COLUMN notification_email TEXT`,
            `ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'`,
            // Federated identity hub fields (Mastodon/ActivityPub handle for WebFinger)
            `ALTER TABLE users ADD COLUMN mastodon_handle TEXT`,
            // Self-destruct: when set in the future, the account is wiped on this timestamp
            `ALTER TABLE users ADD COLUMN self_destruct_at TEXT`
        ];
        extraMigrations.forEach(sql => { db.run(sql, () => {}); });
    });
};
initDb();
module.exports = db;
