import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Package, ExternalLink, ArrowLeft, Copy, Check, Trash2, Download, Eye, EyeOff, Star } from 'lucide-react';
import { loadOrders, forgetOrder, type StoredOrder } from '../utils/orderHistory';
import { showToast } from './Toast';
import { StarRating } from './StarRating';

type DigitalItem = { id: number; content_type: string; file_name: string | null; file_size: number | null; download_limit: number };
type Tracked = {
    order_id: number;
    order_code: string;
    status: string;
    payment_address: string;
    price_xmr: number;
    has_proof: boolean;
    product_name: string;
    product_type: string;
    thumbnail_url: string | null;
    seller_username: string;
    created_at: string;
    updated_at: string;
    digital_content?: DigitalItem[];
    product_id?: number;
    reviewable?: boolean;
    has_review?: boolean;
};

const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    paid: 'bg-green-100 text-green-800 border-green-300',
    processing: 'bg-blue-100 text-blue-800 border-blue-300',
    shipped: 'bg-purple-100 text-purple-800 border-purple-300',
    delivered: 'bg-green-200 text-green-900 border-green-400',
    complete: 'bg-green-200 text-green-900 border-green-400',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
    expired: 'bg-gray-100 text-gray-600 border-gray-300',
    refunded: 'bg-orange-100 text-orange-800 border-orange-300',
};

export const OrderTracker: React.FC = () => {
    const { orderCode } = useParams<{ orderCode: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Tracked | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    // #4.2: per-item revealed encrypted blob, mapped by content id.
    const [revealed, setRevealed] = useState<Record<number, { content: string; file_name: string | null }>>({});
    const [revealing, setRevealing] = useState<number | null>(null);

    // #4.3: review form state
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const submitReview = async () => {
        if (!order || reviewRating < 1) return;
        setReviewSubmitting(true);
        try {
            const token = localStorage.getItem('goxmr_token');
            const r = await fetch('/api/store/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
                body: JSON.stringify({ order_code: order.order_code, rating: reviewRating, review_text: reviewText.trim() || undefined })
            });
            const data = await r.json();
            if (!r.ok) { showToast(data.error || 'Failed to post review', 'error'); return; }
            setReviewSubmitted(true);
            showToast('Review submitted', 'success');
        } catch { showToast('Network error', 'error'); }
        finally { setReviewSubmitting(false); }
    };

    const handleReveal = async (item: DigitalItem) => {
        if (!order) return;
        if (revealed[item.id]) { // toggle hide
            setRevealed(r => { const next = { ...r }; delete next[item.id]; return next; });
            return;
        }
        setRevealing(item.id);
        try {
            const r = await fetch(`/api/store/download/${order.order_id}/${item.id}`, { method: 'POST' });
            const data = await r.json();
            if (!r.ok) { showToast(data.error || 'Could not fetch item', 'error'); return; }
            setRevealed(rv => ({ ...rv, [item.id]: { content: data.encrypted_content, file_name: data.file_name } }));
        } catch { showToast('Network error', 'error'); }
        finally { setRevealing(null); }
    };

    useEffect(() => {
        if (!orderCode) return;
        let cancelled = false;
        const fetchOnce = async () => {
            try {
                const r = await fetch(`/api/store/orders/track/${encodeURIComponent(orderCode)}`);
                if (!r.ok) {
                    if (!cancelled) { setError(r.status === 404 ? 'Order not found' : 'Failed to load'); setLoading(false); }
                    return;
                }
                const data = await r.json();
                if (!cancelled) { setOrder(data); setLoading(false); }
            } catch {
                if (!cancelled) { setError('Network error'); setLoading(false); }
            }
        };
        fetchOnce();
        // Poll every 15s for status changes, mirroring the checkout page
        const id = setInterval(fetchOnce, 15000);
        return () => { cancelled = true; clearInterval(id); };
    }, [orderCode]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="max-w-2xl mx-auto">
                <button onClick={() => navigate('/')} className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-4">
                    <ArrowLeft size={12} /> Back home
                </button>

                <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Package size={20} className="text-monero-orange" />
                        <h1 className="font-mono font-black uppercase text-xl tracking-tighter dark:text-white">Order Tracker</h1>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-2 py-8 text-gray-500">
                            <Loader2 className="animate-spin" size={16} />
                            <span className="font-mono text-xs">Looking up <span className="font-bold dark:text-white">{orderCode}</span>…</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="py-8">
                            <p className="font-mono text-xs text-red-500 mb-2">{error}</p>
                            <p className="font-mono text-[10px] text-gray-400">
                                Order codes look like <code className="bg-gray-100 dark:bg-zinc-800 px-1">ORD-XXXXXXXXXXXX</code>. Double-check the code in your URL or your saved orders list.
                            </p>
                        </div>
                    )}

                    {order && (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 dark:border-zinc-700">
                                <div className="flex items-center gap-3 min-w-0">
                                    {order.thumbnail_url ? (
                                        <img src={order.thumbnail_url} alt="" className="w-12 h-12 object-cover border border-black dark:border-white" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 border border-black dark:border-white flex items-center justify-center">
                                            <Package size={16} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="font-mono font-bold text-sm dark:text-white truncate">{order.product_name}</div>
                                        <div className="font-mono text-[10px] text-gray-500 uppercase truncate">
                                            {order.product_type} | from <Link to={`/${order.seller_username}`} className="text-monero-orange hover:underline">@{order.seller_username}</Link>
                                        </div>
                                    </div>
                                </div>
                                <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 border ${STATUS_COLOR[order.status] || 'bg-gray-100 border-gray-300'}`}>
                                    {order.status}
                                </span>
                            </div>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
                                <dt className="text-gray-500 uppercase">Order code</dt>
                                <dd className="dark:text-white font-bold break-all flex items-center gap-1">
                                    {order.order_code}
                                    <button onClick={() => handleCopy(order.order_code)} className="text-gray-400 hover:text-monero-orange" aria-label="Copy order code">
                                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                    </button>
                                </dd>
                                <dt className="text-gray-500 uppercase">Amount</dt>
                                <dd className="dark:text-white font-bold">{order.price_xmr} XMR</dd>
                                <dt className="text-gray-500 uppercase">Payment proof</dt>
                                <dd className="dark:text-white">{order.has_proof ? 'Submitted' : 'Pending'}</dd>
                                <dt className="text-gray-500 uppercase">Created</dt>
                                <dd className="dark:text-white">{new Date(order.created_at).toLocaleString()}</dd>
                                <dt className="text-gray-500 uppercase">Updated</dt>
                                <dd className="dark:text-white">{new Date(order.updated_at).toLocaleString()}</dd>
                            </dl>

                            {/* #4.2: digital downloads — only visible after the order is paid */}
                            {order.digital_content && order.digital_content.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-zinc-700 pt-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Download size={14} className="text-monero-orange" />
                                        <span className="font-mono text-xs font-bold uppercase dark:text-white">Your Downloads</span>
                                    </div>
                                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                        Reveal an item to fetch it. Items are stored as the seller saved them — could be an external link, a license code, or PGP-encrypted text. If it looks scrambled, ask the seller for the decryption password (out-of-band).
                                    </p>
                                    <div className="space-y-2">
                                        {order.digital_content.map(item => {
                                            const r = revealed[item.id];
                                            return (
                                                <div key={item.id} className="border border-black dark:border-white bg-gray-50 dark:bg-zinc-800 p-2">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="font-mono text-[10px] dark:text-white truncate">
                                                            <span className="uppercase text-gray-500">{item.content_type}</span>
                                                            {item.file_name ? <> · <span className="font-bold">{item.file_name}</span></> : null}
                                                            {item.download_limit > 0 ? <> · max {item.download_limit} fetches</> : null}
                                                        </div>
                                                        <button
                                                            onClick={() => handleReveal(item)}
                                                            disabled={revealing === item.id}
                                                            className="font-mono text-[10px] font-bold uppercase px-2 py-1 border border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors flex items-center gap-1 dark:text-white shrink-0"
                                                        >
                                                            {revealing === item.id ? <Loader2 size={10} className="animate-spin" /> : (r ? <EyeOff size={10} /> : <Eye size={10} />)}
                                                            {r ? 'Hide' : 'Reveal'}
                                                        </button>
                                                    </div>
                                                    {r && (
                                                        <div className="bg-white dark:bg-zinc-900 border border-black/20 dark:border-white/20 p-2 font-mono text-[10px] break-all whitespace-pre-wrap dark:text-gray-200 max-h-60 overflow-auto">
                                                            {r.content}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {order.payment_address && order.status === 'pending' && (
                                <div className="border-t border-gray-200 dark:border-zinc-700 pt-3">
                                    <div className="font-mono text-[10px] text-gray-500 uppercase mb-1">Payment Address</div>
                                    <div
                                        onClick={() => handleCopy(order.payment_address)}
                                        role="button"
                                        tabIndex={0}
                                        className="bg-gray-50 dark:bg-zinc-800 border border-black dark:border-white p-2 font-mono text-[10px] break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors dark:text-white"
                                    >
                                        {order.payment_address}
                                    </div>
                                </div>
                            )}

                            {/* #4.3: review form — once paid, before review exists */}
                            {order.reviewable && !reviewSubmitted && (
                                <div className="border-t border-gray-200 dark:border-zinc-700 pt-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Star size={14} className="text-monero-orange" />
                                        <span className="font-mono text-xs font-bold uppercase dark:text-white">Leave a Review</span>
                                    </div>
                                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                                        Your order code is proof of purchase — no account required. One review per order, can't be edited after submit.
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <StarRating value={reviewRating} size={18} interactive onChange={setReviewRating} />
                                        <span className="font-mono text-[10px] text-gray-500">{reviewRating > 0 ? `${reviewRating}/5` : 'Tap to rate'}</span>
                                    </div>
                                    <textarea
                                        value={reviewText}
                                        onChange={e => setReviewText(e.target.value)}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Optional comment (max 2000 chars)…"
                                        className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[11px] dark:text-white resize-none mb-2"
                                    />
                                    <button
                                        onClick={submitReview}
                                        disabled={reviewSubmitting || reviewRating < 1}
                                        className="font-mono text-[10px] font-bold uppercase px-3 py-2 bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {reviewSubmitting ? 'Submitting…' : 'Submit Review'}
                                    </button>
                                </div>
                            )}
                            {(order.has_review || reviewSubmitted) && (
                                <div className="border-t border-gray-200 dark:border-zinc-700 pt-3 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                    <Check size={10} className="inline text-green-500" /> Review submitted for this order.
                                </div>
                            )}

                            <p className="font-mono text-[10px] text-gray-400 pt-2 border-t border-gray-200 dark:border-zinc-700">
                                This page auto-refreshes every 15s. Bookmark or share the URL — it's the only key to this order.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// "My Orders" — list of every order_code this browser has created.
// Each row queries the tracker endpoint for live status. No login, no server-side list.
export const OrdersList: React.FC = () => {
    const [orders, setOrders] = useState<StoredOrder[]>(() => loadOrders());
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Fetch status for each in parallel — small N (max 200, usually <20)
            const results = await Promise.allSettled(orders.map(o =>
                fetch(`/api/store/orders/track/${encodeURIComponent(o.order_code)}`).then(r => r.ok ? r.json() : null)
            ));
            if (cancelled) return;
            const map: Record<string, string> = {};
            results.forEach((r, i) => {
                if (r.status === 'fulfilled' && r.value) map[orders[i].order_code] = r.value.status;
            });
            setStatuses(map);
        })();
        return () => { cancelled = true; };
    }, [orders]);

    const handleForget = (code: string) => {
        if (!confirm('Remove this order from your local list? The order still exists on the seller’s side.')) return;
        forgetOrder(code);
        setOrders(loadOrders());
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="max-w-2xl mx-auto">
                <button onClick={() => navigate('/')} className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-4">
                    <ArrowLeft size={12} /> Back home
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <Package size={20} className="text-monero-orange" />
                    <h1 className="font-mono font-black uppercase text-xl tracking-tighter dark:text-white">My Orders</h1>
                </div>

                <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                    These orders are stored only in this browser. Clearing your browser data or switching devices loses the list — bookmark the individual <code className="bg-gray-100 dark:bg-zinc-800 px-1">/track/&lt;code&gt;</code> URLs if you want a permanent reference.
                </p>

                {orders.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-8 text-center">
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">No orders saved yet.</p>
                        <p className="font-mono text-[10px] text-gray-400 mt-1">Anything you buy from this device will show up here.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {orders.map(o => {
                            const status = statuses[o.order_code] || 'loading';
                            return (
                                <div key={o.order_code} className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link to={`/track/${o.order_code}`} className="font-mono font-bold text-xs dark:text-white hover:text-monero-orange">
                                                {o.order_code}
                                            </Link>
                                            <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 border ${STATUS_COLOR[status] || 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                                                {status}
                                            </span>
                                        </div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-0.5 truncate">
                                            <span className="dark:text-gray-300">{o.product_name}</span>
                                            {' · '}from @{o.seller}
                                            {' · '}{o.price_xmr} XMR
                                            {' · '}{new Date(o.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <Link to={`/track/${o.order_code}`} className="text-gray-400 hover:text-monero-orange" aria-label="Open">
                                        <ExternalLink size={14} />
                                    </Link>
                                    <button onClick={() => handleForget(o.order_code)} className="text-gray-400 hover:text-red-500" aria-label="Forget order">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
