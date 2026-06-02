// GoXMR Pay schema. Three tables: merchants, orders, webhook_deliveries.
// Lives in the same SQLite as the rest of the app — separate prefix so a future
// extraction into its own service is a single ALTER TABLE rename away.

function applyPaySchema(db) {
    db.serialize(() => {
        // invite codes — phase-1 access control. only someone with a valid code
        // can register a merchant while PAY_PUBLIC=0. codes are single-use, can
        // carry a label so the operator remembers who they were handed to, and
        // can optionally expire. revoked codes flip is_active=0 instead of being
        // deleted so audit history survives.
        db.run(`CREATE TABLE IF NOT EXISTS pay_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            label TEXT,
            used_by_merchant_id INTEGER,
            used_at DATETIME,
            expires_at DATETIME,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (used_by_merchant_id) REFERENCES pay_merchants(id) ON DELETE SET NULL
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_pay_invites_active ON pay_invites(is_active, used_at)');

        db.run(`CREATE TABLE IF NOT EXISTS pay_merchants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            business_name TEXT,
            monero_address TEXT,
            private_view_key_enc TEXT,
            restore_height INTEGER,
            api_key_hash TEXT,
            api_key_prefix TEXT,
            webhook_url TEXT,
            webhook_secret TEXT,
            is_active INTEGER DEFAULT 1,
            is_testnet INTEGER DEFAULT 1,
            opt_in_directory INTEGER DEFAULT 0,
            self_host_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS pay_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            merchant_id INTEGER NOT NULL,
            external_order_id TEXT,
            amount_xmr REAL NOT NULL,
            payment_address TEXT NOT NULL,
            payment_subaddress_index INTEGER,
            status TEXT DEFAULT 'pending',
            tx_hash TEXT,
            confirmations INTEGER DEFAULT 0,
            redirect_url TEXT,
            metadata TEXT,
            user_agent_redacted TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            detected_at DATETIME,
            confirmed_at DATETIME,
            FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id) ON DELETE CASCADE
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_pay_orders_merchant ON pay_orders(merchant_id, created_at DESC)');
        db.run('CREATE INDEX IF NOT EXISTS idx_pay_orders_status ON pay_orders(status, expires_at)');
        db.run('CREATE INDEX IF NOT EXISTS idx_pay_orders_addr ON pay_orders(payment_address)');

        db.run(`CREATE TABLE IF NOT EXISTS pay_webhook_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_pk INTEGER NOT NULL,
            url TEXT NOT NULL,
            payload TEXT NOT NULL,
            status_code INTEGER,
            response_excerpt TEXT,
            attempt INTEGER DEFAULT 1,
            delivered_at DATETIME,
            next_retry_at DATETIME,
            failed_permanently INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_pk) REFERENCES pay_orders(id) ON DELETE CASCADE
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_pay_webhooks_pending ON pay_webhook_deliveries(failed_permanently, next_retry_at)');
    });
}

module.exports = { applyPaySchema };
