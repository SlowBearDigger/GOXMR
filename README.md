# GOXMR

Privacy-first, open-source sovereign identity and storefront for the Monero ecosystem. Each account becomes a federated handle that resolves across the clearnet, Tor, OpenAlias, Nostr, and Mastodon.

Live at **[goxmr.click](https://goxmr.click)** and **[5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion](http://5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion)**.

---

## What you get when you register

A single handle, three URLs, four federated surfaces:

- `https://<username>.goxmr.click` — personal subdomain, wildcard TLS, served from the same vhost
- `<username>@goxmr.click` — OpenAlias for any Monero wallet (Cake, Feather, monerujo, MyMonero)
- `goxmr.click/<username>` — classic path-based profile
- `<username>@goxmr.click` — NIP-05 verification for Nostr clients (Damus, Amethyst, Snort)
- `@<username>@goxmr.click` — WebFinger alias that forwards Mastodon searches to your real fediverse account
- PGP key publishing, plus auto-encrypted email notifications when a key is set

## Features

**Profile**
- Editable identity (display name, bio, avatar, banner, music, tags)
- Inline links, multi-currency wallet addresses, QR generator with custom styling
- Theme presets (default, win98, terminal, cyber)
- Per-user subdomain with HTTPS wildcard cert

**Store**
- Per-seller marketplace with physical, digital, and service product types
- Non-custodial checkout: buyers send Monero directly to seller-controlled addresses
- Per-order subaddresses for payment matching
- Encrypted digital downloads with download-count limits
- Optional access PINs for unlisted products
- Reviews tied to proof-of-purchase
- Optional marketplace opt-in at `/market`

**Crypto tools**
- Swap aggregator (powered by Trocador) for XMR <-> BTC/ETH/LTC and 100+ pairs
- Block explorer for XMR transactions
- Address QR foundry with logo embedding
- Self-destruct timer with arming and heartbeat

**Privacy and messaging**
- PGP direct messages between accounts (server stores ciphertext only)
- Encrypted contact form on public profiles
- Dead Man's Switch with encrypted payload release
- PGP-encrypted email notifications when the user has a key published

**Federated identity**
- OpenAlias TXT auto-published to DNS when seller adds an XMR wallet
- OpenAlias wallet picker for sellers with multiple addresses
- NIP-05 for Nostr verification
- WebFinger for Mastodon/Pleroma alias-forwarding
- Federation Settings panel with live `VERIFY LIVE` buttons that probe each `.well-known` endpoint

## Privacy posture

- No analytics, no third-party scripts, no tracking cookies, no fingerprinting
- No raw IP addresses anywhere. Logs are reduced to a /24 network prefix before they hit disk
- Database hashes (unlock attempts, download counters) use HMAC-SHA256 with a server-only secret. Deleting `server/.ip_hash_secret` invalidates every IP-derived row in one stroke
- Reverse-proxy access log overridden to print `- - -` instead of the client address
- Tor v3 hidden service mirror removes IP exposure to the server entirely
- Auth JWT in `localStorage` is the only browser storage. No cookies require consent under ePrivacy
- Full disclosure at [/privacy](https://goxmr.click/privacy). Terms at [/terms](https://goxmr.click/terms). Public health snapshot at [/status](https://goxmr.click/status).

## Tech stack

**Frontend**
- Vite, React 19, TypeScript, Tailwind CSS, react-router-dom 7
- `@simplewebauthn/browser`, `qr-code-styling`, `openpgp`, `lucide-react`

**Backend**
- Node.js 20, Express
- SQLite via `sqlite3`, bcrypt (cost 12), helmet, express-rate-limit
- `monero-ts` for view-key wallet scanning
- `openpgp` for outbound email encryption
- `altcha-lib` for proof-of-work captcha
- `nodemailer` for SMTP

**Production infrastructure**
- PM2 process manager with pm2-logrotate
- OpenLiteSpeed reverse proxy with SNI mapping for `*.goxmr.click`
- PowerDNS authoritative server (gsqlite3 backend) with DNSSEC signing (ECDSAP256SHA256)
- acme.sh + Let's Encrypt DNS-01 for wildcard certificate, auto-renewing
- Tor v3 hidden service
- fail2ban, key-only SSH

## Architecture at a glance

```
Browser / Tor Browser / Wallet
            |
            v
       *.goxmr.click  (DNSSEC, PowerDNS authoritative on VPS)
            |
            v
       OpenLiteSpeed (wildcard TLS, SNI map)
            |
            v
       Express @ 127.0.0.1:3001
            |
            +--- React SPA from /dist (Host header rewrites <user>.goxmr.click -> /<user>)
            +--- /api/* business logic
            +--- /.well-known/{webfinger,nostr.json,openalias/*}
            +--- /uploads/* static
            |
            v
       SQLite (./database.db) + monero-ts (view-key scan against public Monero node pool)
            +--- writes OpenAlias TXT to PowerDNS gsqlite3 on wallet save
```

## Local development

```bash
git clone https://github.com/SlowBearDigger/GOXMR.git
cd GOXMR

# frontend
npm install
npm run dev          # vite dev server on :5173 (proxies /api to :3001)

# backend
cd server
npm install
cp .env.example .env # then edit
npm start            # express on :3001
```

Minimum `.env` keys you must set before the backend will start:

```
JWT_SECRET=...           # random 32+ chars
ALTCHA_HMAC_KEY=...      # random 32+ chars
MONERO_WALLET_ADDRESS=   # XMR address that backs /api/dev-fund-status
MONERO_VIEW_KEY=         # private view key for that address
MONERO_NODE_URL=https://xmr-node.cakewallet.com:18081
MONERO_NODE_FALLBACKS=https://node.monerodevs.org:18089,https://nodes.hashvault.pro:18081
ALLOWED_ORIGINS=https://goxmr.click,https://www.goxmr.click,http://localhost:5173
RP_ID=goxmr.click
```

Optional but recommended:

```
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=...
SMTP_FROM=noreply@example.com
TROCADOR_API_KEY=...
IP_HASH_SECRET=...   # if absent, auto-generated to server/.ip_hash_secret on first boot
PDNS_DB_PATH=/var/lib/pdns/pdns.sqlite3   # only on production VPS with PowerDNS
```

## Security model

- **Auth**: bcrypt cost 12 password hash, JWT in `localStorage`, optional WebAuthn (passkeys/YubiKey) with `simplewebauthn/server`
- **HIBP** k-anonymity password check on registration
- **CSRF**: stateless token signed with `JWT_SECRET`, served at `GET /api/csrf`, optional middleware (`csrfProtect`) per route
- **CORS**: explicit allow-list + regex for `*.goxmr.click`. Handles twice-forwarded `Origin` headers from OLS
- **Origin/Referer middleware**: state-changing requests require a valid Origin or Referer
- **CSP**: per-request nonce, `frame-ancestors 'none'`, no third-party sources
- **Rate limiting**: HMAC-keyed buckets (no raw IPs in memory)
- **AI crawler blocklist** (GPTBot, ClaudeBot, CCBot, PerplexityBot, Bytespider, etc.) plus tarpit
- **HSTS**, COOP, CORP, X-Content-Type-Options, all set
- **Constant-time** webhook secret comparison
- **CAA records** restrict cert issuance to Let's Encrypt and Sectigo

## Federation endpoints

| Path | Purpose | Spec |
| --- | --- | --- |
| `/.well-known/webfinger?resource=acct:<user>@goxmr.click` | Mastodon alias-forwarding | RFC 7033 |
| `/.well-known/nostr.json?name=<user>` | Nostr NIP-05 verification | NIP-05 |
| `/.well-known/openalias/<user>.txt` | OpenAlias HTTP fallback | OpenAlias spec |
| `<user>.goxmr.click TXT` | OpenAlias canonical DNS record | OpenAlias spec |

The canonical resolution path for wallets is the DNS TXT record. The HTTP endpoint is a fallback for tools that don't speak DNS.

## Project layout

```
.
+-- App.tsx, index.tsx, index.html, vite.config.ts
+-- components/                React surfaces
|   +-- Dashboard.tsx, Settings.tsx, PublicProfile.tsx
|   +-- FederationSettings.tsx  three handles + verify panel
|   +-- MyHandlesCard.tsx       copy buttons for the user's three URLs
|   +-- PgpInbox.tsx            per-account PGP DMs
|   +-- StoreSection.tsx, MarketPage.tsx, StoreCheckout.tsx
|   +-- PrivacyPage.tsx, TermsPage.tsx, StatusPage.tsx
|   +-- ... (Tools, QRTool, Modal, Toast, ...)
+-- utils/                     client helpers
|   +-- crypto.ts              PBKDF2-AES-GCM wrappers
|   +-- privacyCopy.ts         disclosure content
|   +-- termsCopy.ts
+-- server/
|   +-- index.js               express entry, routes, middleware
|   +-- privacy.js             redactIp, hmacIp, rateLimitKey
|   +-- csrf.js                stateless CSRF token
|   +-- openaliasSync.js       writes user TXT/A into PowerDNS
|   +-- federation.js          OpenAlias HTTP fallback
|   +-- pgpDms.js              PGP direct messages
|   +-- selfDestruct.js        timer + background sweeper
|   +-- mailer.js              SMTP + auto PGP encryption
|   +-- botTraps.js            AI crawler block, robots.txt, tarpit
|   +-- store-endpoints.js     marketplace API
|   +-- monero_monitor.js      view-key wallet scanner
|   +-- logger.js              correlation-ID error logging
|   +-- db.js                  SQLite schema and migrations
+-- CHANGELOG.md
```

## Where to read more

- [/privacy](https://goxmr.click/privacy) — GDPR-aligned plain-language data disclosure
- [/terms](https://goxmr.click/terms) — Terms of Use
- [/status](https://goxmr.click/status) — public health snapshot
- [CHANGELOG.md](CHANGELOG.md) — full release history

## Support

If GOXMR is useful to you, contributions keep the infrastructure online and the development moving. Payments go directly to the operator wallet.

- **OpenAlias**: `slowbeardigger@goxmr.click`
- **Direct XMR**: `42EDsE43TWaNxWcN77DZ3oNPkmxC9zsfg9L8Bb6KkwKyTqNng7AsJpuRM1oh8UpkiyfkGLok5ePAMS4miPpXPw8oCKtqwrV`

Public dev fund balance and remaining goal are visible on the homepage donation modal.

## Security reports

- Email: `abuse@goxmr.click`
- PGP key on the homepage for sensitive subjects
- We notify affected accounts within 72 hours of a confirmed incident

## License

MIT. Free as in sovereign.
