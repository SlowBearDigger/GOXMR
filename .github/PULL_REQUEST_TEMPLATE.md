<!-- Thanks for contributing. Please fill in every section. Empty sections will slow review. -->

## Summary

<!-- One paragraph. What the change does and what it intentionally does not do. -->

## Why

<!-- The problem this solves. Link to an issue if there is one: Closes #N. -->

## How to verify

<!-- Exact commands or click-paths a reviewer can run to confirm it works. -->

1. `git checkout this-branch`
2. `npm install && cd server && npm install`
3. ...

## Screenshots

<!-- Only for UI changes. Drag images here. -->

## Privacy or security impact

<!-- Tick every box that applies. -->

- [ ] Does not touch auth, sessions, or user identity
- [ ] Does not log raw IP addresses or any caller-identifying field
- [ ] Does not introduce a new third-party script, tracker, or analytics call
- [ ] Does not set any new browser storage key beyond functional auth
- [ ] Does not publish new DNS records or change federation endpoints
- [ ] Does not add a new outbound HTTP call to a third-party service

If any box is unchecked, describe the change here:

## Checklist

- [ ] Branch is rebased on `main`
- [ ] Commits are signed (GPG or SSH)
- [ ] New user-facing strings are plain language (no em-dash separators, no "TL;DR", no triple structures)
- [ ] New endpoints handle CORS, Origin/Referer, and rate limiting where appropriate
- [ ] CHANGELOG.md updated under the upcoming version section, if the change is user-visible
- [ ] README.md updated, if a new feature or env key is introduced
