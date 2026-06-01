import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Terminal, Webhook, ShieldCheck } from 'lucide-react';
import { PayLayout } from './PayLayout';

// integration docs. minimal, copy-paste-ready. one screen to scan, one to read.

export const PayDocsPage: React.FC = () => (
    <PayLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            <header>
                <h1 className="font-mono font-black uppercase text-3xl tracking-tighter italic">GoXMR Pay — Integration</h1>
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">REST API v1 · Base URL: <code className="bg-gray-100 dark:bg-zinc-800 px-1">https://goxmr.click/pay</code></p>
            </header>

            <Section icon={<ShieldCheck size={18} />} title="1. Get your API key">
                <p>Sign up at <Link className="text-monero-orange hover:underline" to="/pay/signup">/pay/signup</Link>, configure your Monero primary address and view key in the dashboard, then generate an API key. The key is shown <em>once</em> — store it server-side as a secret.</p>
                <p className="mt-2 text-monero-orange">Why a view key? GoXMR Pay scans the blockchain to know when your buyers pay. The view key is read-only — we cannot move funds.</p>
            </Section>

            <Section icon={<Terminal size={18} />} title="2. Create an order from your backend">
                <pre className="bg-black text-green-400 font-mono text-[11px] p-3 border-2 border-black overflow-x-auto leading-relaxed">{`POST /pay/v1/orders
Authorization: Bearer gxp_live_…
Content-Type: application/json

{
  "amount_xmr": 0.05,
  "external_order_id": "ORDER-42",       // your internal ID, optional
  "redirect_url": "https://you.com/thanks", // optional, buyer is sent here after pay
  "metadata": { "sku": "T-SHIRT-L" }     // optional, JSON, stored as-is
}`}</pre>
                <p className="mt-3">Response:</p>
                <pre className="bg-black text-green-400 font-mono text-[11px] p-3 border-2 border-black overflow-x-auto leading-relaxed">{`{
  "order_id": "ord_abc123…",
  "payment_address": "4…",
  "amount_xmr": 0.05,
  "status": "pending",
  "expires_at": "2026-06-01T19:30:00Z",
  "checkout_url": "https://goxmr.click/pay/checkout/ord_abc123…",
  "qr_data": "monero:4…?tx_amount=0.05"
}`}</pre>
            </Section>

            <Section icon={<ShieldCheck size={18} />} title="3. Render the pay button">
                <p>Drop the embed shim once on your page, then any button with <code className="bg-gray-100 dark:bg-zinc-800 px-1">data-goxmr-pay</code> + <code className="bg-gray-100 dark:bg-zinc-800 px-1">data-order-id</code> opens the checkout popup.</p>
                <pre className="bg-black text-green-400 font-mono text-[11px] p-3 border-2 border-black overflow-x-auto leading-relaxed">{`<script src="https://goxmr.click/pay/embed/pay.js"></script>

<button data-goxmr-pay data-order-id="ord_abc123…">
  Pay 0.05 XMR
</button>`}</pre>
                <p className="mt-2">No iframe, no client-side amount tampering. The order ID is server-issued; the buyer can only pay the exact amount you set.</p>
            </Section>

            <Section icon={<Webhook size={18} />} title="4. Receive webhook on payment">
                <p>Configure a webhook URL in the dashboard. When an order moves to <code className="bg-gray-100 dark:bg-zinc-800 px-1">paid</code>, we POST:</p>
                <pre className="bg-black text-green-400 font-mono text-[11px] p-3 border-2 border-black overflow-x-auto leading-relaxed">{`POST https://your-site.com/webhooks/goxmr-pay
X-GoXMR-Pay-Signature: sha256=<hex hmac of body using webhook_secret>
X-GoXMR-Pay-Event-Id: <uuid>
Content-Type: application/json

{
  "event": "order.paid",
  "order_id": "ord_abc123…",
  "external_order_id": "ORDER-42",
  "amount_xmr": 0.05,
  "status": "paid",
  "tx_hash": "…",
  "confirmations": 1,
  "timestamp": "2026-06-01T19:25:00Z"
}`}</pre>
                <p className="mt-2">Verify the signature: <code className="bg-gray-100 dark:bg-zinc-800 px-1">HMAC_SHA256(body, webhook_secret) === signature</code>. Reply with 2xx within 8s or we retry (exponential backoff up to 8 attempts).</p>
            </Section>

            <Section icon={<Terminal size={18} />} title="5. Poll for status (alternative to webhook)">
                <pre className="bg-black text-green-400 font-mono text-[11px] p-3 border-2 border-black overflow-x-auto leading-relaxed">{`GET /pay/v1/orders/<order_id>
Authorization: Bearer gxp_live_…

→ same shape as the create response, plus tx_hash and confirmed_at when paid`}</pre>
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
