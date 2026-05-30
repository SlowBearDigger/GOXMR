# GOXMR Changelog

## v2.4.5 — 2026-05-29

Sidebar Deploy button always visible on desktop.

### Dashboard
- The desktop sidebar's Deploy button was sitting at the bottom of a single block, taller than the viewport on most screens. Sticky positioning meant the button silently slipped below the fold and the user could not save profile customisation without scrolling
- Sidebar restructured into three regions inside one sticky box:
  pinned action bar (Deploy + Preview) at the top, scrollable section index in the middle (`overflow-y-auto`, `flex-1`), and an internal `max-h-[calc(100vh-9rem)]` cap so the whole box always fits the viewport. The middle scrolls; the action bar never moves
- Deploy is now the FIRST thing in the sidebar instead of the last, matching the priority of the action

---

## v2.4.4 — 2026-05-29

Subdomain routing on the client + mobile Deploy/Preview surface.

### Public profile
- Hitting `https://<user>.goxmr.click/` now lands on that user's PublicProfile instead of the marketing home. The server middleware was rewriting the response but the React Router on the client read `window.location.pathname === '/'` and fell through to `LandingPage`
- New client-side subdomain detection in App.tsx derives the user from `window.location.hostname`, falls through for reserved subdomains (www, api, mail, ns1, ns2, etc.), and passes it as a `usernameOverride` prop to PublicProfile
- Subdomain-scoped store routes added: `/store` and `/store/<slug>` on a user subdomain render the same PublicProfile as the apex `/:username/store` would

### Dashboard
- Preview button now also lives in the header next to Deploy so it's reachable on tablet and mobile, not just desktop sidebar
- New floating mobile-only bottom action bar on `< lg:` viewports with Deploy + Preview side by side. Sticky so the user can save personalization changes from any section without scrolling back to the top

---

## v2.4.3 — 2026-05-29

Dashboard sidebar active-section tracker rewritten.

### Dashboard
- Replaced the old `offsetTop` arithmetic with an `IntersectionObserver` so the sidebar highlight stays accurate regardless of transforms on ancestor elements. The old version was missing 4 sections (overview, handles, gallery, pgp-dms) and tracking the wrong slot under transformed parents
- Active section is now the topmost one inside an upper-band rootMargin (`-100px / -60%`), so scrolling normally highlights the next item the moment its top edge crosses the band — and click-to-scroll lands you on the same active highlight without lag
- requestAnimationFrame-throttled scroll listener keeps the topmost-visible sort accurate when two sections sit in the band at once
- Default `activeSection` set to `overview` (was `identity`) so a fresh login lands on the right highlight

---

## v2.4.2 — 2026-05-29

Modal positioning fix.

### Public profile
- Gallery lightbox, ShareModal and TipXmrModal now render through React Portal
  directly under document.body. The hero card in PublicProfile uses CSS
  transforms which broke `position: fixed` for any descendant — the portal
  escapes the transformed ancestor so modals stay anchored to the viewport
- Body scroll locked while a modal is open so the page behind cannot slip out
  from under it
- Lightbox image cap reduced from 80vh to 75vh so the caption and prev/next
  controls always fit on screen without scrolling on shorter viewports

---

## v2.4.1 — 2026-05-29

Dashboard scroll-flow fix.

### Dashboard
- Reordered the dashboard JSX sections so the physical render order matches the sidebar nav groups. Clicking "Gallery" no longer jumps below "Wallets"; clicking "Store" no longer jumps past four unrelated tools
- Final order: Overview, Your handles, Identity, Links, Gallery, Design, Wallets, Store, Drops & Signals, QR foundry, Contact inbox, PGP direct messages, Security & ops

---

## v2.4.0 — 2026-05-29

Dashboard rework phase 1 + responsive width rhythm on public profile.

### Dashboard
- New Overview section at the top of the dashboard with 4 metric cards (profile views, pending orders, unread contact-form messages, unread PGP DMs) and a 6-tile quick-jump grid linking to the main work areas (Identity, Links, Gallery, Wallets, Store, PGP DMs)
- Sidebar nav reorganised into 5 named groups with visual headers: Home, Brand, Commerce, Comms, Account. Each group renders its own dividers so the long flat list is now scannable
- New Preview button in the sidebar opens the user's live profile (`https://<user>.goxmr.click`) in a new tab — paired with the existing Deploy button
- Deploy button compacted, no more standalone memory-usage bar

### Public profile width rhythm
- Outer hero container is now `max-w-3xl` on mobile/tablet and `max-w-5xl` from `xl:` up. Bio stays narrow but gallery and store get room to breathe on desktop
- PublicGallery grid scales 2 → 3 → 4 → 5 columns across `sm: lg: xl:` breakpoints
- StoreProductGrid scales 2 → 3 → 4 columns across `sm: lg: xl:` breakpoints
- Intentionally keeps the intimate centered hero — content sections breathe, identity stays personal

---

## v2.3.0 — 2026-05-29

Public profile redesign (option A: editorial stack).

### Hero
- New QuickActions row under the bio with up to 4 buttons: Tip XMR / Contact / Share / Store. Each button only renders if the corresponding surface exists on the profile (no XMR wallet, no Tip button; no PGP key, no Contact button)
- Tip button opens TipXmrModal — large QR for `monero:<addr>`, OpenAlias handle copy, raw address copy
- Share button opens ShareModal — three URLs (subdomain, OpenAlias, classic path) each with a downloadable QR and one-click copy
- Contact and Store buttons smooth-scroll to their on-page anchors

### Section reorder
- Gallery now renders inside the hero card area, immediately after the bio, ahead of links and store. Visitors see media first when there is any
- Store keeps its mid-page slot but gets a `store-section` anchor for QuickActions
- Encrypted contact form gets `contact-form` anchor
- The CTA "Forge Your Own Base" demoted to a small footer link

### Federation handles row
- New row of compact chips at the bottom of every profile listing federated surfaces: OpenAlias, NIP-05, Mastodon (linked to external account if set), Tor v3 mirror

### Music player
- SonicModule now floats fixed bottom-right on tablet/desktop, full-width footer on mobile. Persistent across all sections instead of being stuck at the bottom of the document

### Backend
- Added `pinned_section` column to users (about | links | gallery | store, default 'about') for an upcoming per-user lead-section selector
- `/api/user/:name` now exposes `pinned_section`, `has_mastodon`, and `mastodon_handle` so the public surface can render Mastodon chips and forwarders without an extra round-trip
- `PUT /api/me` accepts `pinned_section`

---

## v2.2.1 — 2026-05-29

Gallery improvements.

### Gallery
- Per-image visibility: public (on profile), unlisted (link-only), private (dashboard only)
- Alt text field separate from caption for screen-reader accessibility
- Bulk upload: drop multiple files onto the editor at once, multer accepts up to the quota in one POST
- Anonymous view counter per image, no IP storage. Client dedupes per session via sessionStorage so a single visitor cannot inflate the counter on reload. Increment fires on lightbox open, not page load
- EXIF strip is explicit: sharp `.rotate()` honours then drops the orientation tag, `.webp()` strips everything else (GPS, IPTC, XMP). GIFs pass through unchanged

### API
- `GET /api/user/:name/gallery/:id` for unlisted image fetch by direct link, private gated on owner JWT
- `POST /api/user/:name/gallery/:id/view` anonymous view-counter bump (no auth)
- `POST /api/me/gallery` now accepts `images[]` for bulk and still accepts the legacy `image` field

---

## v2.2.0 — 2026-05-29

User-facing gallery feature for public profiles.

### Gallery
- New `gallery_images` table with foreign key to users (CASCADE on delete) + composite index on (user_id, sort_order)
- 4 endpoints: `GET /api/me/gallery` (own), `GET /api/user/:name/gallery` (public, 60s cache), `POST /api/me/gallery` (multipart upload), `PUT /api/me/gallery/:id` (caption + order), `DELETE /api/me/gallery/:id` (also unlinks file)
- Per-user quota (default 12 images, configurable via `MAX_GALLERY_PER_USER` env var)
- Sharp pipeline reused: max 1600x1600, webp quality 82; GIFs pass through up to 5MB to preserve animation
- Dashboard section `04_GALLERY` with add/delete/caption inline editing and drag-to-reorder (persisted in parallel)
- PublicProfile renders `PublicGallery` masonry-style grid below bio with hover captions and a click-to-zoom lightbox (Esc to close, arrow keys to navigate)
- Optimistic UI for delete and reorder; file cleanup on delete is best-effort

### Infrastructure
- OLS `Server:` header rewritten to "GOXMR", `X-Powered-By` stripped via vhost `extraHeaders` block

---

## v2.1.1 — 2026-05-29

Hardening and branding round.

### Branding
- Replaced the favicon set with the official Monero brand symbol (16, 32, 180, 192, 512 px). Apple touch icon and PWA icons regenerated
- New 1200x630 og-image.png for Twitter / Telegram / Discord previews
- index.html meta tags rewritten: og:site_name, og:image:width/height/alt, twitter:site, twitter:image:alt, theme-color split by prefers-color-scheme

### Security headers
- CSP allow-list cleaned: dropped stale third-party origins (sethforprivacy, gift.runa, cloudfront, reloadly, wikipedia), added the actual Monero remote-node pool plus DoH endpoints (dns.google, cloudflare-dns.com), allowed `https://*.goxmr.click` for the per-user subdomain assets
- Added directives: script-src-attr 'none', frame-src 'none', media-src 'self' blob:, upgrade-insecure-requests
- HSTS upgraded to 2-year max-age with includeSubDomains and preload
- Explicit referrer-policy: strict-origin-when-cross-origin
- app.disable('x-powered-by') (helmet already strips but explicit is cheap)

### Resilience
- Final Express error middleware: any uncaught throw returns `{ error, id }` with a correlation ID logged server-side, never leaks stack traces
- process.on('unhandledRejection') and process.on('uncaughtException') now route through logError
- CORS rejections surface as HTTP 403 instead of 500 (clearer for the client)

### Dependencies
- nodemailer pinned to ^6.10.1 (latest CRLF-injection-fixed 6.x)
- Added npm overrides for serialize-javascript ^6.0.2 (transitive RCE fix)
- Bumped helmet, cors, @simplewebauthn/server to latest patch
- Outstanding: sqlite3 v5 -> v6 and bcrypt v5 -> v6 majors deferred to next maintenance window (transitive build-time-only vulns in node-gyp/tar chain, not exploitable at runtime)

---

## v2.1.0 — 2026-05-29

Infrastructure migration to VPS, authoritative DNS, full subdomain identity, zero-IP-collection privacy posture, Tor mirror.

### Infrastructure
- Migrated full stack to dedicated VPS (Node 20 + PM2 + OpenLiteSpeed). Backend listens on 127.0.0.1:3001 behind OLS reverse proxy with HTTPS termination
- HTTP-only and stale-token redirects fixed; auth JWT validation hardened against migration-induced 403 spam
- Wildcard TLS certificate `*.goxmr.click + goxmr.click` via acme.sh + Let's Encrypt DNS-01, auto-renewing
- pm2-logrotate installed (10MB / 7 day retention)
- fail2ban + key-only SSH replaces per-IP whitelist
- SQLite migration with SHA-256 verification, 227 user accounts restored from prior install (full image rescue via FTP, 329 of 331 uploads recovered)

### DNS — PowerDNS authoritative
- Replaced Namecheap nameservers with self-operated PowerDNS (`ns1.goxmr.click`, `ns2.goxmr.click`)
- DNSSEC signed (ECDSAP256SHA256, DS records registered with `.click` TLD)
- Wildcard `*.goxmr.click → VPS` record for zero-config user subdomains
- Curated zone import (apex, mail, www, autoconfig, SPF, DKIM, DMARC, CAA). Old cPanel cruft (`lets.*`, `store.*`, `cpcalendars.*` and friends) dropped

### Identity
- Each user now resolves three ways: `https://<user>.goxmr.click` (subdomain), `<user>@goxmr.click` (OpenAlias for any XMR wallet), and the classic `goxmr.click/<user>` path
- **OpenAlias auto-publish**: when a seller adds an XMR wallet, a DNSSEC-signed TXT record appears at `<user>.goxmr.click` within seconds
- **OpenAlias wallet picker**: sellers with multiple XMR wallets can choose which one backs their OpenAlias handle, live DNS update on save
- **NIP-05 (Nostr)** and **WebFinger (Mastodon)** federation endpoints. WebFinger acts as an alias to the user's external Mastodon/Pleroma account; NIP-05 publishes the user's nostr pubkey
- **Federation Settings panel** in dashboard with live `VERIFY LIVE` buttons that probe `.well-known` endpoints via DoH so the user sees what wallets and fediverse clients see
- New `MyHandlesCard` at the top of the dashboard with copy buttons for all three URLs

### Privacy posture — zero raw IP collection
- New `server/privacy.js` module: `redactIp()` for log lines (/24 prefix), `hmacIp()` for any DB-persisted abuse-prevention hash (HMAC-SHA256 with a server-only secret), `rateLimitKey()` for express-rate-limit buckets
- OpenLiteSpeed access log format overridden to print `- - -` instead of the client address
- `IP_HASH_SECRET` lifecycle: auto-generated 32-byte hex on first boot, persisted to `.ip_hash_secret` (chmod 600). Deleting the file invalidates every IP-derived row in one stroke
- `store_unlock_attempts.ip_hash` and `store_downloads.ip_hash` migrated from plain SHA-256 to HMAC
- All `console.warn(... req.ip ...)` callsites in `index.js` and `logError(...{ ip: req.ip })` now go through `redactIp`
- Removed the vite-plugin-pwa registration that was prompting Brave/Firefox for permissions; ships a kill-switch `sw.js` to unregister any previously installed worker

### Surfaces
- New `/privacy` page (GDPR-aligned plain-language disclosure, 15 sections)
- First-visit transparency banner (`PrivacyNotice`) keyed to policy version; no consent ceremony because nothing here requires consent
- New `/status` public page polling `/api/status` every 30s — HTTP API, database, Monero daemon, Tor mirror
- New `/.onion` Tor v3 hidden service mirror — same backend, no IP exposure: `5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion`
- Footer cleaned up: Privacy · Status · Terms · Abuse · .onion mirror

### PGP and messaging
- New dashboard section `10_PGP_DIRECT_MSGS` with unread count badge in the sidebar (`PgpInbox` lifted out of Settings)
- `EmailPgpStatusCard` in Settings shows whether outbound notifications will be auto-encrypted with the user's public key (the mailer already supported this, the panel makes it visible)
- `/api/me/notifications/summary` now includes `pgp_dms_unread`

### Security hardening
- CORS allow-list now regex-aware for the `*.goxmr.click` subdomain pattern
- `Origin: array-form` (twice-forwarded header) bug fixed; CORS callback normalizes before allow-list lookup
- WebAuthn `RP_ID` set explicitly to `goxmr.click` in production env
- CSRF defence-in-depth helper (`server/csrf.js`): stateless token signed with `JWT_SECRET`, opt-in `csrfProtect` middleware
- Bcrypt cost 12 (OWASP 2024 baseline), constant-time webhook secret comparison, CSP nonces per request, HIBP k-anonymity password check
- AI crawler block + tarpit decoy

### Bug fixes
- Sharp `Cannot use same file for input and output` on `.webp` uploads (rename to `-opt.webp`)
- Dashboard `'Loading...'` placeholder username caused child fetches to hit `/api/store/config/Loading...`
- Donation modal opened multiple times because the listener was registered per-mount; split into `<DonationGoalButton/>` (button-only) and `<DonationGoal hidden/>` (modal singleton)
- NIP-05 now returns `200 {"names":{}}` instead of 404 for unknown names (spec compliance)
- Wildcard `*.goxmr.click` was shadowed by per-user TXT records; added matching A records (RFC 4592)
- Removed embedded terminal that was overlapping the footer on short viewports
- Added optional encryption for product details — password is no longer required for plain physical/service listings

### Frontend
- New `vite.config.ts` without `vite-plugin-pwa`
- Per-user subdomain routing handled by Express middleware before SPA fallback
- Wildcard subdomain origin accepted in CORS and CSRF helpers

---

## v2.0.0 — 2026-04-02

Major release: E-Commerce, Crypto Swaps, Encrypted Messaging, Privacy Tools, and full UX overhaul.

---

### New Features

#### Store / E-Commerce
- **Full Monero marketplace** — sellers configure store with XMR address, list products (physical, digital, service), manage orders
- **Checkout flow** — buyer gets unique payment address + QR, submits TXID proof, seller verifies on-chain or manually
- **Digital content delivery** — encrypted assets with download limits, per-order tracking
- **Product reviews** — proof-of-purchase required (1 review per order), 1-5 rating
- **Store visibility** — public or PGP-only product listings
- **Auto-verify payments** — sellers with view key get automatic order confirmation via subaddress monitoring
- **Global listings** — public `/api/store/listings` endpoint for discovery
- **Order tracking** — public tracking by order code, no auth required

#### Crypto Swaps (Trocador Integration)
- **Swap tab** — get rates and create BTC/LTC/ETH/USDT/DOGE/BCH -> XMR exchanges
- **Shop tab** — gift cards and prepaid cards via Trocador
- **Activity tab** — in-memory trade history (privacy-first, not persisted)
- **Checkout page** — `/checkout/:tradeId` with QR, live status polling, progress steps
- **Privacy ratings** — shows exchange provider privacy rating (A/B/C/D)
- **Webhook support** — receives Trocador status updates

#### Encrypted Messaging
- **Contact form on profiles** — visitors send PGP-encrypted messages, encryption happens client-side
- **Message inbox** — decrypt with PGP private key (client-side only, key never leaves browser)
- **Proper decrypt modal** — replaced insecure `window.prompt()` with inline textarea + passphrase input
- **Email notifications** — seller/recipient notified on new message (fire-and-forget)

#### Privacy Tools
- **Signals** — URL shortener with optional password gate, custom aliases (premium), expiration control
- **Dead Drops** — encrypted notes with AES-256 or PGP, burn-after-read (premium), configurable expiry
- **Block Explorer** — live Monero blockchain viewer proxied through configured node, search by height/hash/TXID
- **Dead Man's Switch** — premium feature: encrypted content auto-released as a Drop if heartbeat not renewed
- **Resolver pages** — `/s/:code` for signals, `/d/:code` for drops, with password gates and AES decryption

#### Payment Pages
- **`/pay/:username`** — standalone payment page with user's QR style, preset amounts, Monero URI
- **Amount presets** — quick-select 0.01, 0.05, 0.1, 0.5, 1.0 XMR or custom input

#### Email System
- **Mailer module** — SMTP-based notification emails for orders, messages, premium activation
- **PGP-encrypted emails** — if recipient has PGP key, notification body is encrypted

#### Dashboard Enhancements
- **Store management section** — setup wizard, product CRUD, order management with status flow
- **Encrypted inbox** — view/decrypt/delete messages from dashboard
- **Signal & Drop management** — view active signals/drops, edit, deactivate
- **Dead Man's Switch panel** — arm switches, send heartbeats, view triggered switches
- **Notification badges** — pending order counts on store nav item

#### Profile Enhancements
- **Trust badge** — displays account age, PGP status, Nostr, premium status
- **Encrypted contact form** — shown on public profiles when user has PGP key
- **Store section** — products displayed on public profile with buy buttons
- **Contribute page** — developer fund, technical roadmap, contribution guide

---

### Backend Changes

#### New Endpoints
- `POST /api/store/setup` — initialize store with Monero address
- `PUT /api/store/config` — update store branding
- `GET /api/store/config/:username` — public store info
- `POST /api/store/products` — create product
- `GET /api/store/products/:username` — list products (now filters `pgp_only`)
- `GET /api/store/products/id/:productId` — product detail + view counter
- `PUT /api/store/products/:productId` — update product
- `DELETE /api/store/products/:productId` — soft delete
- `POST /api/store/orders` — create order with payment address
- `GET /api/store/orders/mine` — buyer/seller order views
- `PUT /api/store/orders/:orderId/status` — status transitions with stock management
- `POST /api/store/orders/:orderId/proof` — submit TXID + TX key
- `GET /api/store/orders/track/:orderCode` — public order tracking
- `POST /api/store/download/:orderId/:contentId` — digital content delivery
- `POST /api/store/reviews` — proof-of-purchase reviews
- `GET /api/store/reviews/:productId` — product reviews
- `GET /api/store/notifications` — pending/paid order counts
- `GET /api/store/listings` — global product + store discovery
- `POST /api/store/verify-payment` — on-chain payment verification
- `POST /api/user/:username/message` — send encrypted message
- `GET /api/me/messages` — list received messages
- `PUT /api/me/messages/:id/read` — mark read
- `DELETE /api/me/messages/:id` — delete message
- `POST /api/tools/signal` — create signal
- `GET/POST /api/resolve/signal/:code` — resolve signal
- `POST /api/tools/drop` — create drop
- `GET /api/resolve/drop/:code` — resolve drop
- `POST /api/tools/deadman` — create dead man's switch
- `PUT /api/tools/deadman/:id/heartbeat` — heartbeat
- `DELETE /api/tools/deadman/:id` — deactivate
- `GET /api/me/deadman` — list switches
- `POST /api/explorer/rpc` — Monero daemon RPC proxy
- `GET /api/trocador/rates` — swap rates
- `POST /api/trocador/exchange` — create trade
- `GET/POST /api/trocador/cards`, `giftcards`, `order_*` — card marketplace
- `POST /api/trocador/webhook` — trade status webhook
- `GET /api/trocador/trade/:id` — trade status

#### Database (non-destructive migrations)
- New tables: `signals`, `drops`, `dead_mans_switches`, `encrypted_messages`, `link_clicks`, `store_config`, `store_products`, `store_digital_content`, `store_orders`, `store_downloads`, `store_reviews`
- All migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` with duplicate column guards

#### Monero Monitor Enhancements
- Store order payment verification (subaddress index 10000+ offset)
- Auto-expire stale orders (>48h)
- Background tasks: premium check (2min), store order check (2min), dead man's switch (15min)

---

### Bug Fixes
- **`proofLimiter` naming mismatch** — parameter in `store-endpoints.js` now matches what `index.js` passes (`authLimiter`)
- **`pgp_only` visibility not enforced** — product listing endpoint now filters out `pgp_only` products from public queries
- **Deploy script missing files** — `store-endpoints.js` and `mailer.js` were not included in previous deploy script

---

### UX / Accessibility Fixes
- **Replaced `window.prompt()`** — MessageInbox PGP decrypt and AddProductModal encryption password now use secure inline modals
- **Button targets increased to 44px** — Modal close, MessageInbox decrypt/delete, DeadMansSwitchTool heartbeat/delete
- **`aria-label` added** — all icon-only buttons (close, dismiss, decrypt, delete, deactivate)
- **Global `focus-visible` ring** — keyboard users see orange focus ring on all interactive elements
- **Dark mode placeholder visibility** — global CSS fix for input/textarea placeholders in dark mode
- **Header dropdown z-index** — `z-50` added to prevent rendering behind other elements
- **EncryptedContactForm dark mode** — added `dark:` variants for container, inputs, text, errors
- **Character counter** — added to EncryptedContactForm textarea (shows X/5000)
- **StoreCheckout address** — now shows "click to copy" hint, `role="button"`, keyboard accessible
- **PaymentPage address** — increased from `text-[9px]` to `text-[10px]`, keyboard accessible
- **Order status confirmation** — "Mark Complete" now requires `confirm()` dialog
- **GlitchText accessibility** — decorative spans marked `aria-hidden`, `dark:mix-blend-screen` for dark mode
- **Toast dismiss button** — added `aria-label="Dismiss"`

---

### New Files
- `components/StoreSection.tsx` — store management dashboard
- `components/StoreProductGrid.tsx` — product display grid
- `components/StoreCheckout.tsx` — checkout flow modal
- `components/AddProductModal.tsx` — product creation form
- `components/StoreDisclaimer.tsx` — store terms banner
- `components/TrocadorSwap.tsx` — swap/shop/activity tabs
- `components/SwapCheckout.tsx` — swap checkout page
- `components/EncryptedContactForm.tsx` — PGP contact form
- `components/MessageInbox.tsx` — encrypted inbox
- `components/PaymentPage.tsx` — standalone payment page
- `components/Toast.tsx` — global toast notification system
- `components/TrustBadge.tsx` — profile trust indicators
- `components/Contribute.tsx` — contribution/donate page
- `components/Tools/BlockExplorer.tsx` — Monero block explorer
- `components/Tools/DeadMansSwitchTool.tsx` — dead man's switch UI
- `components/98theme.css` — Windows 98 retro theme styles
- `server/store-endpoints.js` — store API endpoints module
- `server/mailer.js` — SMTP email notification system
- `server/migrate_v5_public_fields.js` — v5 database migration
- `utils/api.ts` — authenticated fetch wrapper
- `utils/crypto.ts` — AES-GCM encryption utilities
