// Terms-of-use sections. Plain language. Not legal advice — review with a real lawyer
// for jurisdiction-specific exposure before relying on this in production.
export const TERMS_SECTIONS = [
    {
        id: 'platform',
        title: '1. Nature of the service',
        body: 'GOXMR is a peer-to-peer publishing platform. We provide tools for users to claim a handle, publish links, post content, list items for sale, and accept Monero. We do not warehouse goods, hold funds, escrow payments, ship anything, or take any custodial role in transactions between users.'
    },
    {
        id: 'privacy-pointer',
        title: '2. Data handling (see Privacy page for the details)',
        body: 'We minimise what we hold about you. No analytics, no third-party trackers, no advertising cookies, no raw IP addresses in logs (only the /24 network prefix), no fingerprinting, no profiling. Persisted IP hashes for abuse-control are HMAC-SHA256 with a server-only secret — irreversible without that secret. Auth uses a JWT in localStorage; we set no tracking cookies. The Tor v3 hidden service mirror removes IP exposure to the server entirely. The full technical disclosure is at /privacy and is auditable in source control.'
    },
    {
        id: 'no-verify',
        title: '3. No verification, no endorsement',
        body: "We do not verify the identity, age, residence, qualifications, or legitimacy of any user. We do not review, approve, endorse, or quality-check items, services, or content listed on the platform. A listing's presence on goxmr.click does not imply we have inspected it, agree with it, or stand behind it in any way. You alone are responsible for what you publish, list, buy, or read."
    },
    {
        id: 'user-content',
        title: '4. Your content, your responsibility',
        body: 'You retain ownership of everything you publish. You also retain full legal responsibility for it. By publishing on the platform you affirm you have the rights and authority to do so under the law of your jurisdiction. You agree to indemnify GOXMR, its contributors, hosting providers, and infrastructure operators against any claim or cost arising from your content or your conduct on the platform.'
    },
    {
        id: 'prohibited',
        title: '5. What is not allowed',
        body: "Some lines we don't cross regardless of local law: content that sexualises or targets minors, doxxing, content engineered to incite real-world harm against a specific person, and distribution of malicious software disguised as something else. If you publish any of that, you are on your own.\n\nHonest disclosure about cooperation: if served with a valid legal order from a jurisdiction we are forced to respect, we will respond with whatever we actually possess about the named user. By design, that is almost nothing. We do not log raw IPs at all (the OpenLiteSpeed access log redacts the address, the application log writes the /24 prefix only, and the persisted IP hashes used for abuse-control are HMAC-SHA256 keyed with a server-only secret that can be rotated to invalidate every existing row in one command). We do not retain order plaintexts (they are PGP-encrypted to the seller's key), Monero payments never touch us, PGP DMs are stored as opaque ciphertext we cannot read, and there is no shell history because we removed the persistent terminal.\n\nThe opsec stack is yours to use. If you reach the site via the .onion mirror, encrypt your orders, use a real Monero wallet, talk via PGP DMs, and avoid putting identifying info in plaintext fields, then 'what we possess about you' is your handle and the rows you typed in. We can't betray data we never had. That is on purpose."
    },
    {
        id: 'no-custody',
        title: '6. No custody of funds',
        body: 'Monero payments go directly from the buyer to a wallet the seller controls. GOXMR never possesses, holds, escrows, transmits, or has signing authority over user funds at any point. We are not a money services business, exchange, broker, or payment processor. We do not facilitate refunds or dispute mediation.'
    },
    {
        id: 'irreversible',
        title: '7. Transactions are final',
        body: "Monero transactions are cryptographically irreversible. Once sent, funds cannot be recalled. If you pay for an item and the seller does not deliver, your recourse is against the seller — not against GOXMR. Verify a seller's reputation, ask questions, request proof, and use your judgement before sending payment."
    },
    {
        id: 'no-warranty',
        title: '8. No warranty',
        body: 'The platform is provided "AS IS" without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee uptime, data preservation, or that the platform will be free of bugs or interruptions. You use it at your own risk.'
    },
    {
        id: 'limitation',
        title: '9. Limitation of liability',
        body: 'To the maximum extent permitted by law, GOXMR, its contributors, and its operators are not liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages — including loss of funds, data, reputation, business, or goodwill — arising from your use of the platform, your interactions with other users, or any content published on the platform. If a court finds liability, that liability is capped at the lesser of fees you paid in the prior 12 months (which for a free service is zero) or USD 100.'
    },
    {
        id: 'reports',
        title: '10. Reporting (read this before writing us)',
        body: "We are not the moderation arm of your worldview. We do not police taste, opinions, lawful sales you disapprove of, competitor disputes, or ideological discomfort. Block whoever you don't want to see and move on.\n\nWhat we will look at: specific, verifiable reports that match section 5 — content sexualising minors, doxxing, malware distribution, threats targeting a specific identifiable person. Send the URL plus a short factual description to abuse@goxmr.click. We will act when the report is clear and meets that threshold. We will ignore reports that are vague, ideological, attempts to delist a competitor, or part of a coordinated campaign. We will not negotiate, explain our decisions, or respond to follow-ups about reports we declined.\n\nThis platform is built for people who do not want a babysitter. We act as one only at the hard edges."
    },
    {
        id: 'takedown',
        title: '11. Account removal and content removal',
        body: 'We may remove content or terminate accounts at any time, without prior notice, for any reason, including but not limited to suspected violations of these terms. We may also comply with valid legal orders directed at user accounts. Removal does not constitute a waiver of any right or remedy we may have.'
    },
    {
        id: 'jurisdiction',
        title: '12. Jurisdiction',
        body: 'These terms are governed by general principles of contract law. Any dispute that cannot be resolved through good-faith communication shall be brought solely in the jurisdiction where the platform operator resides at the time, and only by the named party (no class actions). If any clause is unenforceable in your jurisdiction, the rest remain in force.'
    },
    {
        id: 'changes',
        title: '13. Changes',
        body: 'We may update these terms. Material changes will be announced on the platform. Continued use after a change indicates acceptance. The current version is the only version that applies.'
    },
];
