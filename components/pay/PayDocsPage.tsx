import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, Webhook, ShieldCheck, Copy, Check } from 'lucide-react';
import { PayLayout } from './PayLayout';

// integration docs. minimal, copy-paste-ready. one screen to scan, one to read.
// each code block has a copy button + language tabs where multiple flavours apply.

type Lang = 'curl' | 'node' | 'python';

const CREATE_ORDER: Record<Lang, string> = {
    curl: `curl -X POST https://goxmr.click/pay/v1/orders \\
  -H "Authorization: Bearer gxp_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_xmr": 0.05,
    "external_order_id": "ORDER-42",
    "redirect_url": "https://you.com/thanks",
    "metadata": { "sku": "T-SHIRT-L" }
  }'`,
    node: `// node >= 18 — uses built-in fetch
const r = await fetch('https://goxmr.click/pay/v1/orders', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + process.env.GOXMR_PAY_KEY,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        amount_xmr: 0.05,
        external_order_id: 'ORDER-42',
        redirect_url: 'https://you.com/thanks',
        metadata: { sku: 'T-SHIRT-L' },
    }),
});
const order = await r.json();
// order.order_id, order.payment_address, order.checkout_url, order.qr_data`,
    python: `import os, requests

r = requests.post(
    'https://goxmr.click/pay/v1/orders',
    headers={'Authorization': f"Bearer {os.environ['GOXMR_PAY_KEY']}"},
    json={
        'amount_xmr': 0.05,
        'external_order_id': 'ORDER-42',
        'redirect_url': 'https://you.com/thanks',
        'metadata': {'sku': 'T-SHIRT-L'},
    },
    timeout=10,
)
order = r.json()
# order['order_id'], order['payment_address'], order['checkout_url'], order['qr_data']`,
};

const CREATE_RESPONSE = `{
  "order_id": "ord_abc123...",
  "payment_address": "8...",
  "payment_subaddress_index": 17,
  "amount_xmr": 0.05,
  "status": "pending",
  "expires_at": "2026-06-01T19:30:00Z",
  "checkout_url": "https://goxmr.click/pay/checkout/ord_abc123...",
  "qr_data": "monero:8...?tx_amount=0.05"
}`;

const EMBED_BUTTON = `<button data-goxmr-pay data-order-id="ord_abc123...">
  Pay 0.05 XMR
</button>`;

const WEBHOOK_PAYLOAD = `POST https://your-site.com/webhooks/goxmr-pay
X-GoXMR-Pay-Signature: sha256=<hex hmac of body using webhook_secret>
X-GoXMR-Pay-Event-Id: <uuid>
Content-Type: application/json

{
  "event": "order.paid",
  "order_id": "ord_abc123...",
  "external_order_id": "ORDER-42",
  "amount_xmr": 0.05,
  "status": "paid",
  "tx_hash": "...",
  "confirmations": 1,
  "timestamp": "2026-06-01T19:25:00Z"
}`;

const WEBHOOK_VERIFY: Record<Lang, string> = {
    // curl doesn't really apply here — show the principle as a shell one-liner
    curl: `# the signature header is: sha256=<hex hmac>
# verify by recomputing hmac over the raw body using webhook_secret:
echo -n "$RAW_BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex
# the output must match the hex in the X-GoXMR-Pay-Signature header (after the "sha256=" prefix).`,
    node: `// node >= 18 — express handler that verifies the signature in constant time
import crypto from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.GOXMR_PAY_WEBHOOK_SECRET;

// IMPORTANT: capture the RAW body bytes — JSON.parse loses formatting and
// hmac compares byte-for-byte. use express.raw() for the webhook route only.
app.post('/webhooks/goxmr-pay',
    express.raw({ type: 'application/json' }),
    (req, res) => {
        const header = req.get('X-GoXMR-Pay-Signature') || '';
        const expected = 'sha256=' + crypto
            .createHmac('sha256', SECRET)
            .update(req.body)
            .digest('hex');
        const a = Buffer.from(header);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return res.status(401).end();
        }
        const evt = JSON.parse(req.body.toString('utf8'));
        // evt.event === 'order.paid' | 'order.expired'
        // fulfil the order here; reply 2xx within 8s or we retry.
        res.json({ ok: true });
    },
);`,
    python: `# flask handler that verifies the signature in constant time
import hmac, hashlib, os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ['GOXMR_PAY_WEBHOOK_SECRET'].encode()

@app.post('/webhooks/goxmr-pay')
def webhook():
    raw = request.get_data()  # raw bytes, NOT request.json
    header = request.headers.get('X-GoXMR-Pay-Signature', '')
    expected = 'sha256=' + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(header, expected):
        abort(401)
    evt = request.get_json()
    # evt['event'] == 'order.paid' | 'order.expired'
    # fulfil the order here; reply 2xx within 8s or we retry.
    return {'ok': True}`,
};

const STATUS_POLL = `curl https://goxmr.click/pay/v1/orders/<order_id> \\
  -H "Authorization: Bearer gxp_live_..."

# same shape as create response, plus tx_hash + confirmed_at when paid.
# alternative when webhooks aren't an option (mobile apps, static sites).`;

export const PayDocsPage: React.FC = () => (
    <PayLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            <header>
                <h1 className="font-mono font-black uppercase text-3xl tracking-tighter italic">GoXMR Pay — Integration</h1>
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">REST API v1 · Base URL: <code className="bg-gray-100 dark:bg-zinc-800 px-1">https://goxmr.click/pay</code></p>
            </header>

            <Section icon={<ShieldCheck size={18} />} title="1. Get your API key">
                <p>Sign up at <Link className="text-monero-orange hover:underline" to="/pay/signup">/pay/signup</Link>, configure your Monero primary address and view key in the dashboard, then generate an API key. The key is shown <em>once</em> — store it server-side as a secret.</p>
                <p className="mt-2 text-monero-orange">Why a view key? GoXMR Pay scans the blockchain to know when your buyers pay. The view key is read-only — it cannot move funds. Each order gets its own subaddress derived from your wallet so two orders of the same amount can't collide.</p>
            </Section>

            <Section icon={<Terminal size={18} />} title="2. Create an order from your backend">
                <CodeTabs blocks={CREATE_ORDER} />
                <p className="mt-3">Response:</p>
                <CodeBlock code={CREATE_RESPONSE} />
            </Section>

            <Section icon={<ShieldCheck size={18} />} title="3. Render the pay button">
                <p>Drop the embed shim once on your page, then any button with <code className="bg-gray-100 dark:bg-zinc-800 px-1">data-goxmr-pay</code> + <code className="bg-gray-100 dark:bg-zinc-800 px-1">data-order-id</code> opens the checkout popup.</p>
                <EmbedSnippet />
                <p className="mt-2">The <code className="bg-gray-100 dark:bg-zinc-800 px-1">integrity</code> hash pins the exact shim bytes — if our origin or CDN ever served tampered JS, your visitors' browsers refuse to run it. Fetch the current value any time from <code className="bg-gray-100 dark:bg-zinc-800 px-1">/pay/embed/integrity</code>.</p>
                <p className="mt-2">No iframe, no client-side amount tampering. The order ID is server-issued; the buyer can only pay the exact amount you set.</p>
            </Section>

            <Section icon={<Webhook size={18} />} title="4. Receive webhook on payment">
                <p>Configure a webhook URL in the dashboard. When an order moves to <code className="bg-gray-100 dark:bg-zinc-800 px-1">paid</code>, we POST:</p>
                <CodeBlock code={WEBHOOK_PAYLOAD} />
                <p className="mt-2">Verify the signature with the webhook secret you stored at API-key generation time. Reply with 2xx within 8s or we retry with exponential backoff (8 attempts, last one ~6 hours later).</p>
                <p className="mt-3 font-bold text-monero-orange">⚠ Constant-time compare matters. Naive `===` leaks timing.</p>
                <div className="mt-2">
                    <CodeTabs blocks={WEBHOOK_VERIFY} />
                </div>
            </Section>

            <Section icon={<Terminal size={18} />} title="5. Poll for status (alternative to webhook)">
                <CodeBlock code={STATUS_POLL} />
            </Section>

            <div className="border-t-2 border-black dark:border-white pt-6">
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-3">Ready? Five minutes from signup to first test payment.</p>
                <Link to="/pay/signup" className="bg-black dark:bg-white text-white dark:text-black font-mono text-sm font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] inline-flex items-center gap-2">
                    Get your API key <ArrowRight size={14} />
                </Link>
            </div>
        </div>
    </PayLayout>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section>
        <h2 className="font-mono font-black uppercase text-lg tracking-tighter italic flex items-center gap-2">
            <span className="text-monero-orange">{icon}</span> {title}
        </h2>
        <div className="mt-2 font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed space-y-2">
            {children}
        </div>
    </section>
);

const EmbedSnippet: React.FC = () => {
    // pull the live SRI digest so the snippet pins the exact shim we serve. if a
    // compromised origin/CDN ever altered pay.js the hash wouldn't match and the
    // visitor's browser refuses to run it.
    const [integrity, setIntegrity] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        fetch('/pay/embed/integrity')
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (alive && d && d.integrity) setIntegrity(d.integrity); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);
    const script = integrity
        ? `<script src="https://goxmr.click/pay/embed/pay.js"\n        integrity="${integrity}"\n        crossorigin="anonymous"></script>`
        : `<script src="https://goxmr.click/pay/embed/pay.js" crossorigin="anonymous"></script>`;
    return <CodeBlock code={`${script}\n\n${EMBED_BUTTON}`} />;
};

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative group">
            <pre className="bg-black text-green-400 font-mono text-[11px] p-3 pr-12 border-2 border-black overflow-x-auto leading-relaxed">{code}</pre>
            <button onClick={copy} title="Copy"
                className="absolute top-2 right-2 p-1.5 bg-zinc-800 text-gray-300 hover:bg-monero-orange hover:text-white border border-zinc-600 transition-colors">
                {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
        </div>
    );
};

const CodeTabs: React.FC<{ blocks: Record<Lang, string> }> = ({ blocks }) => {
    const [lang, setLang] = useState<Lang>('curl');
    const tabs: { id: Lang; label: string }[] = [
        { id: 'curl', label: 'curl' },
        { id: 'node', label: 'Node' },
        { id: 'python', label: 'Python' },
    ];
    return (
        <div>
            <div className="flex gap-0">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setLang(t.id)}
                        className={`font-mono text-[10px] font-bold uppercase px-3 py-1.5 border-2 border-black dark:border-white border-b-0 ${lang === t.id ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-zinc-900 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
                        {t.label}
                    </button>
                ))}
            </div>
            <CodeBlock code={blocks[lang]} />
        </div>
    );
};
