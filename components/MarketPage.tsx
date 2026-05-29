import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Package, Store, ArrowLeft, ShieldCheck } from 'lucide-react';
import { StarRating } from './StarRating';

type MarketStore = {
    username: string;
    store_name: string | null;
    store_bio: string | null;
    store_banner: string | null;
    is_verified: number;
    product_count: number;
    avg_rating: number | null;
    sales: number;
};

type SortMode = 'recent' | 'sales' | 'rating';

export const MarketPage: React.FC = () => {
    const [stores, setStores] = useState<MarketStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<SortMode>('recent');
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/store/market?sort=${sort}`)
            .then(r => r.ok ? r.json() : { stores: [] })
            .then(d => { if (!cancelled) setStores(d.stores || []); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [sort]);

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => navigate('/')} className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-4">
                    <ArrowLeft size={12} /> Back home
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <Store size={24} className="text-monero-orange" />
                    <h1 className="font-mono font-black uppercase text-2xl tracking-tighter dark:text-white">Marketplace</h1>
                </div>
                <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                    Stores that opted in to public discovery. Sellers control whether they appear here — direct links still work for the rest.
                </p>

                <div className="flex gap-2 mb-6">
                    {(['recent', 'rating', 'sales'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setSort(s)}
                            className={`font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 transition-colors ${sort === s ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white'}`}
                        >
                            {s === 'recent' ? 'Newest' : s === 'rating' ? 'Top Rated' : 'Most Sales'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 py-8 text-gray-500">
                        <Loader2 className="animate-spin" size={16} />
                        <span className="font-mono text-xs">Loading marketplace…</span>
                    </div>
                ) : stores.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-8 text-center">
                        <Package size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">No stores in the marketplace yet.</p>
                        <p className="font-mono text-[10px] text-gray-400 mt-1">If you run a store, opt in from Store Settings → Marketplace.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stores.map(s => (
                            <Link
                                key={s.username}
                                to={`/${s.username}/store`}
                                className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="font-mono font-bold text-sm dark:text-white truncate">{s.store_name || `@${s.username}`}</span>
                                            {s.is_verified ? <ShieldCheck size={12} className="text-green-500 shrink-0" /> : null}
                                        </div>
                                        <div className="font-mono text-[10px] text-gray-500">@{s.username}</div>
                                    </div>
                                    {s.avg_rating != null && s.avg_rating > 0 && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <StarRating value={s.avg_rating} size={11} />
                                            <span className="font-mono text-[10px] text-gray-500">{s.avg_rating.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                                {s.store_bio && <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{s.store_bio}</p>}
                                <div className="font-mono text-[10px] text-gray-500 flex gap-3 pt-2 border-t border-gray-200 dark:border-zinc-700">
                                    <span>{s.product_count} {s.product_count === 1 ? 'product' : 'products'}</span>
                                    <span>·</span>
                                    <span>{s.sales} sales</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
