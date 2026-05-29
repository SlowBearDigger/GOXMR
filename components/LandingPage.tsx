import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
// Terminal removed: the bottom-right toggle was visually overlapping the footer
// (Privacy / Terms / Abuse links) on short pages. The interactive shell never
// drove enough engagement to justify the real estate. If we bring it back we’ll
// surface it from inside /tools so it doesn’t compete with persistent legal links.
import { DonationGoalButton } from './DonationGoal';
import { GlitchText } from './GlitchText';
import { Shield, ArrowRight, Lock, Code, Store, ShoppingBag, Coins, ShieldCheck, Sparkles, Heart } from 'lucide-react';
import { LearnMonero } from './LearnMonero';
import { Guide } from './Guide';
import { Tools } from './Tools';
import { Contribute } from './Contribute';
import { TrocadorSwap } from './TrocadorSwap';
import { StarRating } from './StarRating';

interface LandingPageProps {
    onOpenRegister: (username?: string) => void;
}

type MarketStore = {
    username: string;
    store_name: string | null;
    store_bio: string | null;
    product_count: number;
    avg_rating: number | null;
    sales: number;
    is_verified: number;
};

const useUsernameCheck = () => {
    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (!username || username.length < 3) { setIsAvailable(null); return; }
        const handler = setTimeout(async () => { checkUsername(username); }, 500);
        return () => clearTimeout(handler);
    }, [username]);

    const checkUsername = async (name: string) => {
        setIsChecking(true);
        try {
            const res = await fetch(`/api/check-username/${name}`);
            if (!res.ok) { setIsAvailable(false); return; }
            const data = await res.json();
            setIsAvailable(data.available);
        } catch { setIsAvailable(false); }
        finally { setIsChecking(false); }
    };

    return { username, setUsername, isAvailable, isChecking, setIsAvailable, checkUsername };
};

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenRegister }) => {
    const { activeSection } = useOutletContext<{ activeSection: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' }>() || { activeSection: 'home' };
    const navigate = useNavigate();
    const { username, setUsername, isAvailable, isChecking, setIsAvailable, checkUsername } = useUsernameCheck();
    const [featured, setFeatured] = useState<MarketStore[]>([]);

    useEffect(() => {
        fetch('/api/store/market?sort=rating&limit=4')
            .then(r => r.ok ? r.json() : { stores: [] })
            .then(d => setFeatured((d.stores || []).slice(0, 4)))
            .catch(() => {});
    }, []);

    // Theme toggle wiring — relays to the global toggle event the header listens for
    const requestTheme = () => window.dispatchEvent(new CustomEvent('goxmr:theme:toggle'));

    const handleClaim = () => {
        if (!username) return;
        if (username.length < 3) { setIsAvailable(false); return; }
        if (isAvailable === true) { onOpenRegister(username); return; }
        checkUsername(username);
        if (isAvailable) onOpenRegister(username);
    };

    if (activeSection === 'learn') return <LearnMonero />;
    if (activeSection === 'guide') return <Guide />;
    if (activeSection === 'tools') return <Tools />;
    if (activeSection === 'contribute') return <Contribute />;
    if (activeSection === 'swap') return <TrocadorSwap />;

    const BRUTAL_SHADOW = 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]';
    const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-monero-orange focus-visible:ring-offset-2';

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* HERO */}
            <section className="container mx-auto px-4 sm:px-6 pt-16 sm:pt-20 md:pt-28 pb-12 sm:pb-16">
                <div className="max-w-3xl">
                    <div className={`inline-flex items-center gap-2 border-2 border-black dark:border-white px-3 py-1 bg-yellow-300 ${BRUTAL_SHADOW} mb-6`}>
                        <Shield size={14} />
                        <span className="font-mono text-[11px] font-bold uppercase">Sovereign Identity</span>
                    </div>

                    <GlitchText
                        text="GOXMR"
                        as="h1"
                        className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold leading-none tracking-tighter text-black dark:text-white mb-4"
                    />

                    <p className="font-mono text-base sm:text-lg md:text-xl max-w-2xl border-l-4 border-monero-orange pl-4 sm:pl-6 py-2 bg-gray-50 dark:bg-zinc-900 dark:text-gray-300 mb-8">
                        The privacy-first <span className="font-bold bg-black dark:bg-white text-white dark:text-black px-1">link-in-bio</span> with a built-in Monero store. 0% fees, 0% tracking.
                    </p>

                    {/* Primary CTA — claim form */}
                    <div className="mb-6">
                        <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
                            Claim your handle
                        </label>
                        <div className={`flex border-2 ${BRUTAL_SHADOW} max-w-xl transition-colors ${
                            isAvailable === true ? 'border-green-600 bg-green-50 dark:bg-green-900/10' :
                            isAvailable === false ? 'border-red-600 bg-red-50 dark:bg-red-900/10' :
                            'border-black dark:border-white bg-white dark:bg-zinc-900'
                        }`}>
                            <div className="bg-gray-100 dark:bg-zinc-800 px-3 sm:px-4 py-3 border-r-2 border-black dark:border-white font-mono text-gray-500 dark:text-gray-400 hidden sm:flex items-center text-sm">
                                goxmr.click/
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value.toLowerCase())}
                                placeholder="yourname"
                                aria-label="Username"
                                className={`w-full px-3 sm:px-4 py-3 outline-none font-mono font-bold bg-transparent dark:text-white text-base ${FOCUS_RING}`}
                                onKeyDown={e => { if (e.key === 'Enter') handleClaim(); }}
                            />
                            <button
                                onClick={handleClaim}
                                disabled={isAvailable === false}
                                className={`px-4 sm:px-6 py-3 font-mono font-bold uppercase border-l-2 border-black dark:border-white flex items-center gap-1 sm:gap-2 transition-all whitespace-nowrap text-sm ${
                                    isAvailable === false ? 'bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' :
                                    'bg-monero-orange text-white hover:bg-black dark:hover:bg-white dark:hover:text-black'
                                } ${FOCUS_RING}`}
                            >
                                {isChecking ? '…' : isAvailable === false ? 'Taken' : 'Claim'}
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Secondary CTAs */}
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to="/market"
                            className={`inline-flex items-center gap-2 font-mono text-xs font-bold uppercase px-4 py-2.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none transition-all ${FOCUS_RING}`}
                        >
                            <Store size={14} /> Browse Marketplace
                        </Link>
                        <Link
                            to="/demo"
                            className={`inline-flex items-center gap-2 font-mono text-xs font-bold uppercase px-4 py-2.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none transition-all ${FOCUS_RING}`}
                        >
                            <Sparkles size={14} /> See a Demo Profile
                        </Link>
                        <button
                            onClick={() => navigate('/dashboard#swap')}
                            className={`inline-flex items-center gap-2 font-mono text-xs font-bold uppercase px-4 py-2.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none transition-all ${FOCUS_RING}`}
                        >
                            <Coins size={14} /> Get XMR
                        </button>
                    </div>
                </div>
            </section>

            {/* THREE PROPS — replaces the 6-card matrix */}
            <section className="container mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { icon: Lock, title: 'Non-custodial', body: 'Payments go directly to your Monero wallet. We never touch funds.' },
                        { icon: ShieldCheck, title: 'PGP everywhere', body: 'Buyer info, emails, orders — encrypted client-side with your key.' },
                        { icon: Code, title: 'MIT-licensed', body: 'Audit the code, run your own instance, fork it. Zero lock-in.' },
                    ].map(({ icon: Icon, title, body }) => (
                        <div key={title} className={`border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5 ${BRUTAL_SHADOW}`}>
                            <Icon size={20} className="text-monero-orange mb-3" />
                            <div className="font-mono font-black uppercase text-sm tracking-tight dark:text-white mb-1">{title}</div>
                            <p className="font-mono text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* FEATURED MARKETPLACE */}
            {featured.length > 0 && (
                <section className="container mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
                    <div className="flex items-end justify-between gap-3 mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <ShoppingBag size={16} className="text-monero-orange" />
                                <h2 className="font-mono font-black uppercase text-lg sm:text-xl tracking-tighter dark:text-white">Featured Stores</h2>
                            </div>
                            <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">Sellers who opted in to the public marketplace.</p>
                        </div>
                        <Link to="/market" className={`font-mono text-[10px] font-bold uppercase underline text-monero-orange hover:no-underline shrink-0 ${FOCUS_RING}`}>
                            See all →
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {featured.map(s => (
                            <Link
                                key={s.username}
                                to={`/${s.username}/store`}
                                className={`border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-3 ${BRUTAL_SHADOW} hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all`}
                            >
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="font-mono font-bold text-xs dark:text-white truncate">{s.store_name || `@${s.username}`}</span>
                                    {s.is_verified ? <ShieldCheck size={10} className="text-green-500 shrink-0" /> : null}
                                </div>
                                <div className="font-mono text-[10px] text-gray-500 mb-2 truncate">@{s.username}</div>
                                {s.avg_rating != null && s.avg_rating > 0 && (
                                    <div className="flex items-center gap-1 mb-1">
                                        <StarRating value={s.avg_rating} size={10} />
                                        <span className="font-mono text-[10px] text-gray-500">{s.avg_rating.toFixed(1)}</span>
                                    </div>
                                )}
                                <div className="font-mono text-[10px] text-gray-500">
                                    {s.product_count} {s.product_count === 1 ? 'item' : 'items'} · {s.sales} sales
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* HOW IT WORKS — three steps */}
            <section className="container mx-auto px-4 sm:px-6 pb-16">
                <h2 className="font-mono font-black uppercase text-lg sm:text-xl tracking-tighter dark:text-white mb-4">How it works</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { n: '01', title: 'Claim a handle', body: 'Pick a username. It becomes goxmr.click/yourname instantly.' },
                        { n: '02', title: 'Add links & wallets', body: 'Drop in your socials, paste a Monero address, optionally open a store.' },
                        { n: '03', title: 'Share one URL', body: 'Buyers reach your profile, store, or single product with the same link.' },
                    ].map(s => (
                        <div key={s.n} className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5">
                            <div className="font-mono text-xs font-bold text-monero-orange mb-2">{s.n}</div>
                            <div className="font-mono font-black uppercase text-sm dark:text-white mb-1">{s.title}</div>
                            <p className="font-mono text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{s.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SUPPORT badge stays at the bottom-left. Z-index lowered so it tucks
                under the footer/privacy banner if they overlap on short viewports. */}
            <div className="fixed bottom-4 left-4 z-20">
                <DonationGoalButton />
            </div>
        </div>
    );
};
