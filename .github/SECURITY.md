# Security Policy

## Reporting a vulnerability

Do not open a public GitHub issue. Send a report to:

- **Email**: `abuse@goxmr.click`
- **PGP**: public key on the homepage at https://goxmr.click

We acknowledge within 72 hours of receipt. Coordinated disclosure with affected accounts is preferred. Public credit is offered on request.

## Scope

In scope:

- The application code in this repository (frontend, backend, server modules)
- The production deployment at goxmr.click and the .onion mirror
- The federation endpoints under `/.well-known/*`
- The DNS records published at `*.goxmr.click`

Out of scope:

- Third-party public Monero nodes we relay to
- Trocador swap aggregator and its infrastructure
- CoinGecko price feed
- Let's Encrypt / ZeroSSL certificate issuance
- Email deliverability of the SMTP relay (separate operator)

## Supported versions

| Version | Supported |
| --- | --- |
| 2.1.x   | Yes |
| < 2.1   | No (please upgrade) |

## What counts as a vulnerability

- Authentication or authorization bypass
- Account takeover, including via WebAuthn or recovery flows
- Server-side request forgery, remote code execution, SQL injection
- Cross-site scripting that survives the CSP
- Subdomain or DNS takeover scenarios
- Privacy regressions (raw IPs in logs, fingerprinting, unintended third-party calls)
- Cryptographic mistakes (broken PGP handling, weak randomness, key leakage)

## What does not

- Reports that the site has no analytics or tracking. That is intentional.
- Reports that we use a public Monero node. Self-hosting a node is a known future task.
- Reports based on automated scanners with no demonstrated exploit
- Social engineering of operators, users, or third-party providers
- Volumetric denial of service against the public endpoints
