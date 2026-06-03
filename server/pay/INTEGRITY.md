# GoXMR Pay — integrity & backend-compromise resistance

The threat we design against: **a compromised gateway (our origin, our CDN, or a
MITM) trying to rob or mislead users** — chiefly by swapping the payment address
so a buyer pays an attacker, but also by leaking credentials or faking the "paid"
signal.

This is the running design for that work. Layers ship as independent slices.

## What already mitigates this (shipped)

- **View key only, never spend key** — a compromised backend cannot move merchant
  funds, only watch arrivals.
- **Credentials hashed at rest** — bcrypt-12 passwords, SHA-256 API keys, `whsec_`
  HMAC webhook secrets. A leaked DB is not account takeover.
- **Subaddress per order** — two orders of the same amount never collide; payments
  are never confused.
- **HMAC-signed webhooks** — the merchant verifies the "paid" callback really came
  from us.
- **SRI-pinned embed** (PR #9) — `/pay/embed/integrity` returns the SHA-384 of the
  exact `pay.js` bytes; a tampered shim is rejected by the visitor's browser.

## The three integrity layers

1. **SRI** — tamper-evident embed JS. ✅ shipped.
2. **Signed payment requests** — tamper-evident *address*. ← this document.
3. **Merchant fingerprint** — a short hash of the merchant pubkey, shown on both
   the checkout and the merchant's own site as a human-checkable anchor.

## Scan modes

`pay_merchants.scan_mode`:

- `hosted` (default, today): we hold the view key, derive subaddresses, and scan.
  Convenient; the gateway is trusted not to swap addresses.
- `client`: the merchant holds the view key **and** an Ed25519 signing key, both
  in their own browser/worker (never sent to us). The client derives subaddresses,
  signs each payment request, and attests payments. We store no key material and
  only verify. A fully compromised gateway cannot forge a valid payment request.

## Signing scheme (Ed25519)

The merchant generates an Ed25519 keypair **in-browser**. The 32-byte public key
(`signing_pubkey`, 64 hex) is registered with us and **published on the merchant's
own domain** — that is the trust anchor, because it lives outside our control.

> Note: our own `/.well-known/nostr.json` is *not* a sufficient anchor — it lives
> on goxmr.click, the same trust domain as the gateway. The anchor must be the
> merchant's own site.

Canonical message signed per order (`paymentRequestMessage`, in `auth.js`):

```
goxmr-pay/v1
<order_id>
<amount_in_piconero>      # atomic units, so float formatting can't change bytes
<payment_address>
```

`verifyPaymentSignature(pubkeyHex, message, signatureHex)` verifies a 64-byte hex
Ed25519 signature; it never throws and returns false on any malformed input.

## Anti-swap flow (client mode)

1. Merchant client derives a fresh subaddress (it has the view key).
2. Client signs `paymentRequestMessage({order_id, amount_xmr, payment_address})`.
3. `POST /pay/v1/orders` carries `payment_address`, `payment_subaddress_index`,
   and `signature`. We verify against `signing_pubkey` and store. *(slice 2)*
4. Checkout returns the signature + pubkey; the buyer (and a snippet on the
   merchant's own site) verify it. A swapped address fails verification. *(slice 5)*

## Paid confirmation without a view key (tx proof)

In client mode the gateway has no view key, so it cannot scan. Instead the client
detects the payment and produces a Monero **tx proof** (`get_tx_proof` over the
order's subaddress + a message bound to the order id). `POST /pay/v1/orders/:id/
attest` verifies the proof via the shared node pool (`check_tx_proof`, address +
tx + signature only — no key) and flips the order to `paid`. *(slice 3)*

## Honest limits

- In `hosted` mode a fully compromised gateway can still mislead a buyer who does
  not verify — and most buyers won't click "verify." The strong guarantee is
  `client` mode + a verifier the merchant embeds on their own domain.
- SRI/tx-proof assume the edge serves the origin's bytes; a transforming CDN must
  be pinned at the edge.

## Slices

| # | Slice | Status |
|---|---|---|
| 1 | Signing foundation — schema (`scan_mode`, `signing_pubkey`), Ed25519 verify + canonical message, register via dashboard | ← this PR |
| 2 | Client-mode signed order creation + verification | planned |
| 3 | Tx-proof attestation endpoint | planned |
| 4 | Browser WASM scanner + dashboard UI (needs a funded wallet to test) | planned |
| 5 | Checkout + merchant-site signature verification | planned |
