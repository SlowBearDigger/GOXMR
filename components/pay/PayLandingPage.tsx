import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ShieldCheck, Code2, Wallet, ArrowRight } from 'lucide-react';
import { PayLayout } from './PayLayout';

// public landing for /pay. one screen, one CTA. the message has to land in 5s:
// "Stripe for Monero, 0% fee, non-custodial, one line of HTML."

export const PayLandingPage: React.FC = () => (
    <PayLayout>
        <section className="max-w-4xl mx-auto px-4 pt-16 pb-12">
            <div className="inline-block bg-monero-orange text-white px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest mb-6 border-2 border-black">
                Beta · Free forever
            </div>
            <h1 className="text-5xl md:text-6xl font-black font-mono uppercase tracking-tighter leading-[0.95] mb-4 italic">
                Stripe for Monero.<br />Zero custody. Zero fees.
            </h1>
            <p className="font-mono text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                Drop one <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5">&lt;script&gt;</code> tag on your site, add a button, accept Monero. Payments go straight to <em>your</em> wallet — GoXMR never holds your funds.
            </p>
            <div className="mt-8 flex gap-3 flex-wrap">
                <Link to="/pay/signup" className="bg-black dark:bg-white text-white dark:text-black font-mono text-sm font-black uppercase px-6 py-4 border-2 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(242,104,34,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none inline-flex items-center gap-2">
                    Get an API key <ArrowRight size={16} />
                </Link>
                <Link to="/pay/docs" className="font-mono text-sm font-bold uppercase px-6 py-4 border-2 border-black dark:border-white hover:bg-gray-50 dark:hover:bg-zinc-900">
                    Read the docs
                </Link>
            </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-8 border-t-2 border-black dark:border-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card icon={<ShieldCheck size={20} />} title="Non-custodial">
                    You provide your Monero address + view key. We scan the blockchain for arrivals; funds never touch our wallet.
                </Card>
                <Card icon={<Code2 size={20} />} title="One-line integration">
                    Create an order server-side with a single POST, then a <code className="bg-gray-100 dark:bg-zinc-800 px-1">&lt;button data-order-id&gt;</code> on your site. Done.
                </Card>
                <Card icon={<Wallet size={20} />} title="0% gateway fee">
                    Open source, runs on the same infra as goxmr.click. You pay only network fees — same as a direct wallet send.
                </Card>
            </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-8">
            <h2 className="font-mono font-black uppercase text-2xl tracking-tighter mb-4 italic">30-second integration</h2>
            <pre className="bg-black text-green-400 font-mono text-[11px] p-4 border-2 border-black dark:border-white overflow-x-auto leading-relaxed">{`# 1. create the order from your backend
curl -X POST https://goxmr.click/pay/v1/orders \\
  -H "Authorization: Bearer gxp_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"amount_xmr": 0.05, "external_order_id": "ORDER-42"}'

# response → { "order_id": "ord_abc…", "checkout_url": "…" }

# 2. drop this on your page
<script src="https://goxmr.click/pay/embed/pay.js"></script>
<button data-goxmr-pay data-order-id="ord_abc…">Pay 0.05 XMR</button>`}</pre>
            <p className="mt-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                The button opens a centred checkout popup with QR + address. Status polls automatically. Your webhook fires when paid.
            </p>
        </section>
    </PayLayout>
);

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 mb-2">
            <span className="text-monero-orange">{icon}</span>
            <span className="font-mono font-black uppercase text-xs tracking-tighter">{title}</span>
        </div>
        <p className="font-mono text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{children}</p>
    </div>
);
