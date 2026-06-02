import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Copy, Check, RefreshCw, AlertTriangle, Eye, EyeOff, Save } from 'lucide-react';
import { PayLayout, payApi } from './PayLayout';
import { ConfirmDialog } from '../ConfirmDialog';
import { showToast } from '../Toast';

const ORDERS_PAGE_SIZE = 50;
const ORDERS_REFRESH_MS = 30 * 1000;

// merchant dashboard. four panels: account, wallet config, api key, orders.
// reads goxmr_pay_token from localStorage; redirects to /pay/login if absent.

interface Merchant {
    id: number;
    email: string;
    business_name: string | null;
    monero_address: string | null;
    restore_height: number | null;
    webhook_url: string | null;
    is_testnet: number;
    opt_in_directory: number;
    self_host_url: string | null;
    api_key_prefix: string | null;
    created_at: string;
}

interface Order {
    order_id: string;
    external_order_id: string | null;
    amount_xmr: number;
    status: string;
    tx_hash: string | null;
    confirmations: number;
    created_at: string;
    confirmed_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    paid: 'bg-green-100 text-green-800 border-green-300',
    expired: 'bg-gray-100 text-gray-600 border-gray-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const PayDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [merchant, setMerchant] = useState<Merchant | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // wallet config form state, hydrated from merchant on load
    const [walletAddr, setWalletAddr] = useState('');
    const [viewKey, setViewKey] = useState('');
    const [restoreHeight, setRestoreHeight] = useState('');
    const [showViewKey, setShowViewKey] = useState(false);
    const [businessName, setBusinessName] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [optInDirectory, setOptInDirectory] = useState(false);
    const [saving, setSaving] = useState(false);

    // orders pagination
    const [ordersOffset, setOrdersOffset] = useState(0);
    const [ordersFull, setOrdersFull] = useState(false); // true if last page returned ORDERS_PAGE_SIZE rows

    // api key reveal — only present right after rotation, never round-tripped
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
    const [rotating, setRotating] = useState(false);
    const [confirmRotateOpen, setConfirmRotateOpen] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('goxmr_pay_token')) {
            navigate('/pay/login');
            return;
        }
        load();
    }, []);

    // refresh orders silently every 30s. payApi handles 401 globally so a stale
    // session just bounces the user to /pay/login — we don't need a special path.
    useEffect(() => {
        const id = setInterval(() => {
            loadOrders(ordersOffset).catch(() => {});
        }, ORDERS_REFRESH_MS);
        return () => clearInterval(id);
    }, [ordersOffset]);

    // when offset changes (Prev/Next clicked), pull that page.
    useEffect(() => {
        if (!merchant) return; // don't fire before initial load completes
        loadOrders(ordersOffset).catch(() => {});
    }, [ordersOffset]);

    const loadOrders = async (offset: number) => {
        const ord = await payApi(`/pay/admin/orders?limit=${ORDERS_PAGE_SIZE}&offset=${offset}`);
        const rows = ord.orders || [];
        setOrders(rows);
        setOrdersFull(rows.length === ORDERS_PAGE_SIZE);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [m, ord] = await Promise.all([
                payApi('/pay/admin/me'),
                payApi(`/pay/admin/orders?limit=${ORDERS_PAGE_SIZE}&offset=0`),
            ]);
            setMerchant(m);
            const rows = ord.orders || [];
            setOrders(rows);
            setOrdersFull(rows.length === ORDERS_PAGE_SIZE);
            setOrdersOffset(0);
            setWalletAddr(m.monero_address || '');
            setRestoreHeight(m.restore_height ? String(m.restore_height) : '');
            setBusinessName(m.business_name || '');
            setWebhookUrl(m.webhook_url || '');
            setOptInDirectory(!!m.opt_in_directory);
            // view_key is never returned in /me for safety — keep input empty
            setViewKey('');
        } catch (e: any) {
            // payApi already redirects on 401; anything else surfaces as an error banner
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        setError('');
        try {
            const body: Record<string, any> = {
                business_name: businessName,
                monero_address: walletAddr || null,
                webhook_url: webhookUrl || null,
                opt_in_directory: optInDirectory ? 1 : 0,
            };
            if (restoreHeight) body.restore_height = parseInt(restoreHeight);
            // only send view_key if the user typed one this session — empty means "no change"
            if (viewKey) body.private_view_key_enc = viewKey;
            await payApi('/pay/admin/me', { method: 'PUT', body: JSON.stringify(body) });
            showToast('Settings saved', 'success');
            setViewKey('');
            await load();
        } catch (e: any) {
            setError(e.message);
            showToast(e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const performRotate = async () => {
        setConfirmRotateOpen(false);
        setRotating(true);
        try {
            const r = await payApi('/pay/admin/api-key/rotate', { method: 'POST' });
            setRevealedKey(r.api_key);
            setRevealedSecret(r.webhook_secret);
            await load();
            showToast('API key rotated — copy it now, it will not be shown again', 'info', 6000);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setRotating(false);
        }
    };

    if (loading) return <PayLayout><div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" /></div></PayLayout>;
    if (!merchant) return <PayLayout><div className="max-w-3xl mx-auto p-6 font-mono text-sm">Could not load merchant. <button onClick={load} className="underline text-monero-orange">Retry</button></div></PayLayout>;

    return (
        <PayLayout>
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div className="flex justify-between items-end flex-wrap gap-3 border-b-2 border-black dark:border-white pb-3">
                    <div>
                        <h1 className="font-mono font-black uppercase text-2xl tracking-tighter italic">Merchant Dashboard</h1>
                        <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">{merchant.email} · joined {new Date(merchant.created_at).toLocaleDateString()}</p>
                    </div>
                    {!walletAddr && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-2 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="font-mono text-[10px] text-amber-700 dark:text-amber-300 uppercase">Configure wallet below before creating orders</p>
                        </div>
                    )}
                </div>

                {/* WALLET CONFIG */}
                <Panel title="Wallet · Where payments arrive">
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                        Your Monero primary address and <em>view key</em>. The view key lets the scanner see incoming transfers (read-only) — it cannot move funds.
                        <span className="block text-monero-orange mt-1">Never share your spend key with us or anyone. Only the view key.</span>
                    </p>
                    <div className="space-y-3">
                        <Field label="Monero Primary Address" hint="Mainnet 4… 95 chars">
                            <input type="text" value={walletAddr} onChange={e => setWalletAddr(e.target.value.trim())} placeholder="4..."
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[11px] break-all" />
                        </Field>
                        <Field label="Private View Key" hint={merchant.monero_address ? 'Leave empty to keep current. Type new to replace.' : '64 hex chars'}>
                            <div className="relative">
                                <input type={showViewKey ? 'text' : 'password'} value={viewKey} onChange={e => setViewKey(e.target.value.trim())} placeholder={merchant.monero_address ? '(unchanged)' : '64 hex chars'}
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 pr-10 font-mono text-[11px]" />
                                <button onClick={() => setShowViewKey(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-monero-orange" aria-label="Toggle view key visibility">
                                    {showViewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </Field>
                        <Field label="Restore Height (optional)" hint="Block height to start scanning from. Leave empty to scan from the current tip.">
                            <input type="number" value={restoreHeight} onChange={e => setRestoreHeight(e.target.value)} placeholder="3300000"
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs" />
                        </Field>
                    </div>
                </Panel>

                {/* PROFILE / WEBHOOK / DIRECTORY */}
                <Panel title="Profile & Webhook">
                    <div className="space-y-3">
                        <Field label="Business Name">
                            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="ACME Corp"
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm" />
                        </Field>
                        <Field label="Webhook URL (HTTPS)" hint="POSTed with order events (paid, expired). Signed with HMAC-SHA256 in X-GoXMR-Pay-Signature.">
                            <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value.trim())} placeholder="https://your-site.com/webhooks/goxmr-pay"
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs" />
                        </Field>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={optInDirectory} onChange={e => setOptInDirectory(e.target.checked)} className="mt-0.5 accent-monero-orange" />
                            <span className="font-mono text-xs">
                                List me on the public merchant directory
                                <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Optional. Default off. Other GoXMR Pay nodes can index this list.</span>
                            </span>
                        </label>
                    </div>
                </Panel>

                <div className="flex justify-end">
                    <button onClick={saveSettings} disabled={saving}
                        className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange hover:text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Settings
                    </button>
                </div>
                {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-3 font-mono text-xs text-red-700 dark:text-red-300">{error}</div>}

                {/* API KEY */}
                <Panel title="API Key">
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                        Use this in your backend's <code className="bg-gray-100 dark:bg-zinc-800 px-1">Authorization: Bearer</code> header when creating orders. <span className="text-monero-orange">Shown once on rotation only.</span>
                    </p>
                    {revealedKey && (
                        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 p-3 mb-3 space-y-2">
                            <p className="font-mono text-[10px] font-black uppercase text-green-700 dark:text-green-300">Copy now — these will not be shown again</p>
                            <CopyRow label="API Key" value={revealedKey} />
                            {revealedSecret && <CopyRow label="Webhook Secret" value={revealedSecret} />}
                        </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                        <code className="font-mono text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-2 py-1.5">
                            {merchant.api_key_prefix || '— not yet generated —'}
                        </code>
                        <button onClick={() => setConfirmRotateOpen(true)} disabled={rotating}
                            className="font-mono text-xs font-bold uppercase px-3 py-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                            {rotating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            {merchant.api_key_prefix ? 'Rotate' : 'Generate'} Key
                        </button>
                    </div>
                </Panel>

                {/* ORDERS */}
                <Panel title={`Orders · auto-refresh 30s`}>
                    {orders.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-zinc-700">
                            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">No orders {ordersOffset > 0 ? 'on this page' : 'yet'}</p>
                            {ordersOffset === 0 && (
                                <p className="font-mono text-[10px] text-gray-400 dark:text-gray-500 mt-1">Create one via <code className="bg-gray-100 dark:bg-zinc-800 px-1">POST /pay/v1/orders</code></p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full font-mono text-[10px]">
                                <thead>
                                    <tr className="border-b-2 border-black dark:border-white text-left uppercase">
                                        <th className="p-1.5">Order ID</th>
                                        <th className="p-1.5">External</th>
                                        <th className="p-1.5">Amount</th>
                                        <th className="p-1.5">Status</th>
                                        <th className="p-1.5">Confs</th>
                                        <th className="p-1.5">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.order_id} className="border-b border-gray-100 dark:border-zinc-800">
                                            <td className="p-1.5">
                                                <button onClick={() => { navigator.clipboard.writeText(o.order_id); showToast('Order ID copied', 'info', 1500); }}
                                                    className="text-left hover:text-monero-orange" title="Click to copy full order_id">
                                                    <code className="break-all">{o.order_id.slice(0, 18)}…</code>
                                                </button>
                                            </td>
                                            <td className="p-1.5">{o.external_order_id || '—'}</td>
                                            <td className="p-1.5 text-monero-orange font-bold">{o.amount_xmr} XMR</td>
                                            <td className="p-1.5"><span className={`px-1.5 py-0.5 border text-[9px] uppercase ${STATUS_COLORS[o.status] || 'bg-gray-100 border-gray-300'}`}>{o.status}</span></td>
                                            <td className="p-1.5">{o.confirmations}</td>
                                            <td className="p-1.5 text-gray-500">{new Date(o.created_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* paginate when either there's a next page (last row count was full) or we're past page 1 */}
                    {(ordersOffset > 0 || ordersFull) && (
                        <div className="flex items-center justify-between gap-2 mt-3">
                            <button
                                disabled={ordersOffset === 0}
                                onClick={() => setOrdersOffset(o => Math.max(0, o - ORDERS_PAGE_SIZE))}
                                className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black">
                                ← Prev
                            </button>
                            <span className="font-mono text-[10px] text-gray-600 dark:text-gray-400">
                                {ordersOffset + 1}–{ordersOffset + orders.length}
                            </span>
                            <button
                                disabled={!ordersFull}
                                onClick={() => setOrdersOffset(o => o + ORDERS_PAGE_SIZE)}
                                className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black">
                                Next →
                            </button>
                        </div>
                    )}
                </Panel>
            </div>

            <ConfirmDialog
                isOpen={confirmRotateOpen}
                title="ROTATE_API_KEY"
                message={merchant.api_key_prefix
                    ? `Rotating revokes the previous API key. Any integration using ${merchant.api_key_prefix}… stops working immediately. The new key is shown ONCE — copy it before closing the page. Continue?`
                    : 'This will generate your first API key and webhook secret. Both are shown ONCE — copy them before closing the page.'}
                confirmLabel={merchant.api_key_prefix ? 'Rotate Key' : 'Generate Key'}
                destructive={!!merchant.api_key_prefix}
                onCancel={() => setConfirmRotateOpen(false)}
                onConfirm={performRotate}
            />
        </PayLayout>
    );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <h2 className="font-mono font-black uppercase text-sm tracking-tighter mb-3 pb-2 border-b border-gray-200 dark:border-zinc-700">{title}</h2>
        {children}
    </section>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider block mb-1">{label}</span>
        {children}
        {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono">{hint}</p>}
    </label>
);

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div>
            <p className="font-mono text-[10px] font-bold uppercase mb-0.5">{label}</p>
            <button onClick={copy} className="w-full font-mono text-[11px] bg-white dark:bg-zinc-900 border border-black dark:border-white p-2 text-left flex items-center gap-2 hover:bg-monero-orange hover:text-white">
                <span className="flex-1 break-all">{value}</span>
                {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
        </div>
    );
};
