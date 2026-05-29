# Contributing to GOXMR

Thanks for taking the time to look at the code. This project is small, opinionated, and aims to stay that way. If you want to ship a change, this file explains how to land it without surprises.

## Quick rules

- **Open an issue first** for anything beyond a small fix. Two paragraphs are enough.
- **Open a pull request from a feature branch.** No commits land directly on `main`.
- **Sign your commits.** GPG or SSH signing. Unsigned PRs are still reviewable, but the merge commit will not be.
- **Tests, where they exist, must pass.** New surfaces should ship with at least one smoke test.
- **No new dependencies without a reason.** The frontend bundle already needs trimming.
- **No analytics, no trackers, no third-party scripts.** This is non-negotiable.
- **All code, comments, docs and copy in English.** Chat in any language is fine.

## How to work locally

```bash
git clone https://github.com/SlowBearDigger/GOXMR.git
cd GOXMR
npm install
cd server && npm install && cp .env.example .env
# edit .env (see README.md for required keys)
npm start          # backend on :3001
cd .. && npm run dev   # vite on :5173, proxies /api to :3001
```

## Branching

- `main` is always deployable
- Feature branches: `feat/<short-slug>` for new functionality, `fix/<short-slug>` for bug fixes, `chore/<short-slug>` for tooling, `docs/<short-slug>` for documentation
- Rebase on `main` before opening a PR. Keep the history linear.

## Commit messages

Imperative present, no scope prefix needed unless it helps. First line under 70 chars.

```
Good:  Fix subdomain CORS reject when Origin is array
Good:  Add OpenAlias wallet picker to FederationSettings
Bad:   added some stuff
Bad:   Fixed CORS bug (this is a really long message...)
```

The body explains *why*, not *what*. The diff already says what.

## Pull request expectations

When you open a PR, the template will ask you to fill in:

- **Summary**: one paragraph, what the change does and what it does not do
- **Why**: the problem this solves
- **How to verify**: the exact commands or click-paths a reviewer needs to confirm it works
- **Screenshots**: only for UI changes
- **Privacy or security impact**: anything that touches auth, logging, IP handling, DNS records, or third-party calls

Reviewers will check:

- Does the diff match the stated scope? No drive-by refactors.
- Do new endpoints handle CORS, Origin/Referer, and rate limiting?
- Are new user-facing strings free of AI-shaped phrasing (em-dash separators, "TL;DR", triple structures)?
- Are any new IP-touching surfaces routed through `redactIp` / `hmacIp` / `rateLimitKey`?
- Are any new browser storage keys functional only (no tracking)?

PRs that touch user data, federation endpoints, or DNS publishing get a second pair of eyes.

## Security reports

Do not open a public issue for vulnerabilities. Email `abuse@goxmr.click` or use the PGP key on the homepage. We acknowledge within 72 hours and coordinate a fix and disclosure timeline.

See [SECURITY.md](.github/SECURITY.md) for details.

## Code style

There is no formatter configured because the diff is the source of truth. Match the surrounding file. Some house rules:

- Comments in lowercase, no decorative borders (no `═══`, no `###`, no ASCII art in comments)
- One short paragraph at the top of a file explaining what the module does. Avoid multi-paragraph preambles.
- Prefer explicit names over clever ones
- Tailwind classes inline. No CSS modules.
- Server: CommonJS, async/await, helmet/CORS first

## What does not get merged

- Analytics, telemetry, "performance metrics" beacons
- Tracking cookies of any kind
- New third-party JavaScript loaded at runtime
- Anything that logs raw IP addresses
- Hard-coded credentials, even in tests
- Bundled binaries or large media (use external links)
- Marketing copy presented as documentation

## License

By submitting a PR you agree your contribution is licensed under the MIT license that covers the repo.
