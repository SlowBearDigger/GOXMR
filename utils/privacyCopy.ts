// Privacy disclosure copy. Plain language, GDPR-aligned.

export interface PrivacySection {
    id: string;
    heading: string;
    body: string;
    bullets?: string[];
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
    {
        id: 'summary',
        heading: 'Short version',
        body: 'No analytics. No trackers. No advertising cookies. No third-party scripts. No raw IP logs. No fingerprinting. If you delete your account, the rows that identify you leave the database.',
    },
    {
        id: 'who',
        heading: 'Who runs the site',
        body: 'GOXMR is operated by SlowBearDigger as an individual project. Contact: abuse@goxmr.click for security and privacy reports, or the public PGP key on the homepage for sensitive correspondence. No parent company, no investors, no employee with read access to your account.',
    },
    {
        id: 'collected',
        heading: 'What we actually store about you',
        body: 'Everything is voluntary. You give us the data, we keep it only as long as you keep your account.',
        bullets: [
            'Your username, the one you typed at registration.',
            'A bcrypt hash of your password (cost 12). The plaintext is never written to disk or memory beyond the bcrypt verification path.',
            'Optional profile fields: display name, bio, profile image, banner image, music URL, design configuration. All editable, all deletable from the dashboard.',
            'Optional federation handles: Nostr npub, Mastodon handle, OpenAlias. These are exposed via the well-known endpoints because that is the point of federation.',
            'Optional PGP public key. Stored as ASCII armoured text. Public keys are public by definition; we treat them as such.',
            'Your links and crypto wallet addresses if you add any. These are visible on your public profile because you put them there.',
            'For sellers: store config, products, encrypted product data, encrypted digital downloads. Customer payment data flows directly to your wallet, we never see it.',
        ],
    },
    {
        id: 'what-we-dont',
        heading: 'What we never collect',
        body: 'The list of things absent is the point of this project.',
        bullets: [
            'No raw IP addresses anywhere. Logs show only the /24 network prefix. Database tables use HMAC-SHA256 with a server-only secret that can be rotated to invalidate every hash.',
            'No browser fingerprint, no canvas hash, no device IDs, no User-Agent persistence.',
            'No third-party JavaScript. Zero. Every dependency is hosted from our own origin.',
            'No analytics. Not Google, Plausible, Matomo, Cloudflare, none.',
            'No advertising cookies. No tracking pixels. No conversion tags.',
            'No location data beyond what you literally type into your profile.',
            'No email beyond the optional notification address you choose to set.',
            'No SMS, phone, KYC, ID document. We cannot verify your identity even if a government asked us to.',
        ],
    },
    {
        id: 'how-ip-handling-works',
        heading: 'How IP handling works (technical)',
        body: 'Three layers protect any incidental IP exposure:',
        bullets: [
            'Logs (application + reverse proxy): the client IP is reduced to its /24 network prefix before it lands on disk. The OpenLiteSpeed access log format is overridden to print "- - -" in place of the remote address field.',
            'Rate-limit memory (express-rate-limit buckets): keyed by HMAC-SHA256(IP, secret) instead of the raw IP. The process memory map never holds a recoverable address.',
            'Database (abuse-prevention hashes for product unlocks and download counters): same HMAC, persisted. SHA-256 of a bare IPv4 is brute-forceable in seconds (4 billion possibilities); the HMAC with a 32-byte server secret is not. Deleting /server/.ip_hash_secret on the server purges every existing IP-derived row in one stroke.',
        ],
    },
    {
        id: 'cookies-and-storage',
        heading: 'Cookies and browser storage',
        body: 'No tracking cookies. The browser storage we use is strictly functional:',
        bullets: [
            'localStorage: your auth JWT (so you stay logged in across tabs), your last-used username, your design preference. Removing this clears your session. No third party can read it.',
            'sessionStorage: cached PGP private key during decryption flow (cleared on tab close). Unlock tokens for products you just opened. Nothing identifying.',
            'No third-party cookies. No fingerprint cookies. No "essential" advertising cookies.',
        ],
    },
    {
        id: 'crypto-payments',
        heading: 'Crypto payments and wallet visibility',
        body: 'Payment flows are non-custodial. Buyers send Monero (or other allowed crypto) directly to the seller-controlled wallet. We never possess, custody, or proxy funds. The protocol visibility on the Monero blockchain is what it is. That is the user threat-model choice, not ours.',
    },
    {
        id: 'pgp-and-e2e',
        heading: 'PGP, end-to-end content, and encrypted messages',
        body: 'PGP direct messages, encrypted bios, encrypted product blobs are all ciphertext to us. Encryption and decryption happen in your browser using a key we cannot derive. If the database is seized tomorrow, the contents of those rows are opaque without the keys you control.',
    },
    {
        id: 'tor',
        heading: 'Tor / .onion mirror',
        body: 'A v3 hidden service mirror is published at 5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion. Reaching the app through Tor removes IP exposure to the server entirely. Functionality is identical to the clearnet domain.',
    },
    {
        id: 'self-destruct',
        heading: 'Self-destruct and account deletion',
        body: 'From the dashboard you can arm a timer (7 / 30 / 90 / 180 / 365 days) after which your profile is automatically tombstoned: content deleted, identity fields nulled. You can disarm at any time. A manual "delete now" is also available. There is no soft-delete-but-actually-retained backup we keep "for legal reasons".',
    },
    {
        id: 'retention',
        heading: 'Data retention',
        body: 'Per-row policies:',
        bullets: [
            'Account-bound data (profile, links, wallets): kept as long as the account exists.',
            'PGP DMs: capped at 1000 messages per inbox; oldest pruned on new sends.',
            'Unlock-attempt counters: cleared on first successful unlock or after the lockout window expires.',
            'Server logs: rotated daily, retained 7 days, then deleted. Already IP-redacted before they are written.',
            'Encrypted backups: nightly snapshot, encrypted, kept off-host for 30 days, then rotated.',
        ],
    },
    {
        id: 'third-parties',
        heading: 'Third parties we touch',
        body: 'Only what is operationally unavoidable:',
        bullets: [
            'A public Monero remote node (xmr-node.cakewallet.com primary, two fallbacks). They see view-key scans, not your IP. The wallet code runs server-side.',
            'CoinGecko price feed for XMR/USD/EUR conversion. Public endpoint, no per-user query data.',
            'Trocador swap aggregator if you use the swap tool. Trocador sees the swap details by definition. You opt in.',
            'ZeroSSL / Let\'s Encrypt for TLS certificates. They see domain names, not user data.',
            'Mail relay for outbound notifications you opt into. SMTP credentials live on the server; bodies are functional ("your order shipped"), never marketing.',
        ],
    },
    {
        id: 'rights',
        heading: 'Your rights and how to exercise them',
        body: 'You can do all of the following from the dashboard without contacting us:',
        bullets: [
            'See everything we have on you: /api/me returns the full row.',
            'Edit any field: profile, federation handles, PGP key, links, wallets.',
            'Export: your public profile JSON is fetched at /api/user/<your-name>. Your encrypted blobs come back via your dashboard.',
            'Delete: identity-destruction section in Settings, or the self-destruct timer.',
            'Object to anything: nothing here is processed for marketing, profiling, automated decisions, or cross-platform tracking.',
        ],
    },
    {
        id: 'breach',
        heading: 'In case of a breach',
        body: 'If the server is compromised: password hashes are bcrypt-12 (slow), PGP keys are public, encrypted blobs are useless without user keys, IP hashes are useless without the secret. The high-value secrets (JWT_SECRET, ALTCHA_HMAC_KEY, IP_HASH_SECRET, mailer credentials, Monero view key) all live in .env on a chmod 600 file owned by root. We will notify affected accounts via in-app notice and, if you set one, your notification email within 72 hours of the incident becoming known. No PR spin.',
    },
    {
        id: 'changes',
        heading: 'Changes to this policy',
        body: 'Material changes are announced via the in-app banner at least 7 days before they take effect. The policy is versioned in source control so every diff is auditable.',
    },
    {
        id: 'contact',
        heading: 'Questions or reports',
        body: 'abuse@goxmr.click for incidents. Public PGP key on the homepage for sensitive subjects.',
    },
];

export const PRIVACY_VERSION = '2026-05-29';
