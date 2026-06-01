
import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ArrowRight, Wallet, ShieldCheck, Loader2, Copy, Check, Terminal, ShoppingBag, History, Search, Filter, Shield, Zap, Globe, Mail, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { AltchaWidget } from './AltchaWidget';
import { useModalChrome } from '../hooks/useModalChrome';

// --- Sub-Components ---

const PrivacyShield = ({ rating }: { rating: string }) => {
    const getColor = () => {
        switch (rating) {
            case 'A': return 'text-green-500';
            case 'B': return 'text-blue-500';
            case 'C': return 'text-yellow-500';
            case 'D': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="flex items-center gap-1 group relative">
            <Shield size={14} className={getColor()} fill="currentColor" fillOpacity={0.1} />
            <span className={`text-[10px] font-black ${getColor()}`}>{rating}</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white z-50">
                Privacy Rating: {rating}
            </div>
        </div>
    );
};

export const TrocadorSwap: React.FC = () => {
    const { activeSection, setActiveSection } = useOutletContext<{ activeSection: string, setActiveSection: (s: string) => void }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'swap' | 'shop' | 'activity'>('swap');

    // Sync context with local tab state
    useEffect(() => {
        if (activeSection === 'swap') setActiveTab('swap');
        if (activeSection === 'shop') setActiveTab('shop');
        if (activeSection === 'activity') setActiveTab('activity');
    }, [activeSection]);

    const handleTabChange = (tab: 'swap' | 'shop' | 'activity') => {
        setActiveTab(tab);
        if (setActiveSection) {
            setActiveSection(tab);
        }
    };

    // --- SWAP STATE ---
    const [fromCurrency, setFromCurrency] = useState('BTC');
    const [fromNetwork, setFromNetwork] = useState('Mainnet');
    const [amount, setAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [quote, setQuote] = useState<any>(null);
    const [isQuoting, setIsQuoting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'swapping' | 'success' | 'error'>('idle');
    const [tradeData, setTradeData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [copied, setCopied] = useState(false);
    const [altchaPayload, setAltchaPayload] = useState<string | null>(null);

    // --- SHOP STATE ---
    const [shopMode, setShopMode] = useState<'giftcards' | 'prepaid'>('giftcards');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('');
    const [giftcards, setGiftcards] = useState<any[]>([]);
    const [prepaidCards, setPrepaidCards] = useState<any[]>([]);
    const [isLoadingShop, setIsLoadingShop] = useState(false);
    const [orderEmail, setOrderEmail] = useState('');
    const [selectedCard, setSelectedCard] = useState<any>(null);
    const orderModalRef = useRef<HTMLDivElement>(null);
    const orderTitleId = useId();
    const closeOrderModal = () => {
        setSelectedCard(null);
        setTradeData(null);
        setStatus('idle');
    };
    useModalChrome({ isOpen: !!selectedCard, onClose: closeOrderModal, contentRef: orderModalRef });
    const [orderAmount, setOrderAmount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    const cardsPerPage = 6;

    // --- ACTIVITY STATE ---
    const [history, setHistory] = useState<any[]>([]);

    const supportedCoins = ['BTC', 'LTC', 'ETH', 'USDT', 'DOGE', 'BCH'];

    const COUNTRIES = [
        { code: '', name: 'Global', flag: '🌐' },
        { code: 'US', name: 'United States', flag: '🇺🇸' },
        { code: 'ES', name: 'Spain', flag: '🇪🇸' },
        { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
        { code: 'DE', name: 'Germany', flag: '🇩🇪' },
        { code: 'FR', name: 'France', flag: '🇫🇷' },
        { code: 'IT', name: 'Italy', flag: '🇮🇹' },
        { code: 'CA', name: 'Canada', flag: '🇨🇦' },
        { code: 'AU', name: 'Australia', flag: '🇦🇺' },
        { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
        { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
        { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
        { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
        { code: 'CL', name: 'Chile', flag: '🇨🇱' },
        { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
        { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
        { code: 'JP', name: 'Japan', flag: '🇯🇵' },
        { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
        { code: 'IN', name: 'India', flag: '🇮🇳' },
        { code: 'RU', name: 'Russia', flag: '🇷🇺' },
    ].sort((a, b) => a.name.localeCompare(b.name));

    // --- Init & Effects ---
    // Swap history is kept in-memory only for privacy (no localStorage persistence)
    useEffect(() => {
        // No longer load from localStorage to protect swap privacy
    }, []);

    const saveToHistory = (item: any) => {
        const newHistory = [item, ...history].slice(0, 50);
        setHistory(newHistory);
    };

    const clearHistory = () => {
        setHistory([]);
    };

    // Reset quote on changes
    useEffect(() => {
        setQuote(null);
        setStatus('idle');
    }, [amount, fromCurrency, fromNetwork]);

    // Poll for status updates for active trades
    useEffect(() => {
        const activeTrades = history.filter(h => h.status === 'waiting' || h.status === 'confirming' || h.status === 'sending');
        if (activeTrades.length === 0) return;

        const pollStatus = async () => {
            const updatedHistory = [...history];
            let changed = false;

            for (const trade of activeTrades) {
                try {
                    const res = await fetch(`/api/trocador/trade/${trade.trade_id}`);
                    let data = await res.json();
                    if (Array.isArray(data)) data = data[0];
                    if (res.ok && data.status && data.status !== trade.status) {
                        const idx = updatedHistory.findIndex(h => h.trade_id === trade.trade_id);
                        if (idx !== -1) {
                            updatedHistory[idx] = { ...updatedHistory[idx], status: data.status };
                            changed = true;
                        }
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }

            if (changed) {
                setHistory(updatedHistory);
                // History kept in-memory only for privacy — no localStorage persistence
            }
        };

        const interval = setInterval(pollStatus, 30000); // Every 30s
        pollStatus(); // Initial check

        return () => clearInterval(interval);
    }, [history]);

    // --- SHOP LOGIC ---
    const filteredShopItems = useMemo(() => {
        const items = shopMode === 'giftcards' ? giftcards : prepaidCards;
        return items.filter(item => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                (item.name || '').toLowerCase().includes(query) ||
                (item.brand || '').toLowerCase().includes(query) ||
                (item.provider || '').toLowerCase().includes(query);
            const matchesCountry = shopMode === 'prepaid' || !selectedCountry || item.country === selectedCountry;
            return matchesSearch && matchesCountry;
        });
    }, [shopMode, giftcards, prepaidCards, searchQuery, selectedCountry]);

    const currentItems = useMemo(() => {
        const indexOfLastItem = currentPage * cardsPerPage;
        const indexOfFirstItem = indexOfLastItem - cardsPerPage;
        return filteredShopItems.slice(indexOfFirstItem, indexOfLastItem);
    }, [filteredShopItems, currentPage]);

    const totalPages = Math.ceil(filteredShopItems.length / cardsPerPage);

    // Reset page when filters change
    useEffect(() => {
        if (selectedCard) {
            const possibleAmounts = parseCardAmounts(selectedCard);
            if (possibleAmounts.length > 0) {
                setOrderAmount(possibleAmounts[0]);
            } else {
                setOrderAmount(selectedCard.min_amount || 50);
            }
        }
    }, [selectedCard]);

    function parseCardAmounts(card: any) {
        if (!card) return [];
        if (card.denominations && typeof card.denominations === 'string' && card.denominations !== 'range') {
            try {
                const clean = card.denominations.replace(/'/g, '"');
                const parsed = JSON.parse(clean);
                if (Array.isArray(parsed)) return parsed.map(Number);
            } catch (e) { }
        }
        if (Array.isArray(card.denominations)) return card.denominations.map(Number);
        if (card.amounts && typeof card.amounts === 'string') {
            return card.amounts.split(',').map(Number).filter(n => !isNaN(n));
        }
        if (Array.isArray(card.amounts)) return card.amounts.map(Number);
        return [];
    }

    // Fetch Cards when tab changes
    useEffect(() => {
        if (activeTab === 'shop') {
            fetchShopItems();
        }
    }, [activeTab, shopMode, selectedCountry]);

    const fetchShopItems = async () => {
        setIsLoadingShop(true);
        try {
            if (shopMode === 'giftcards') {
                const url = selectedCountry ? `/api/trocador/giftcards?country=${selectedCountry}` : '/api/trocador/giftcards';
                const res = await fetch(url);
                const data = await res.json();
                setGiftcards(Array.isArray(data) ? data : []);
            } else {
                const res = await fetch('/api/trocador/cards');
                const data = await res.json();
                // Defensive check: API might return { cards: [...] } or direct array
                if (Array.isArray(data)) {
                    setPrepaidCards(data);
                } else if (data && typeof data === 'object' && Array.isArray(data.cards)) {
                    setPrepaidCards(data.cards);
                } else if (data && typeof data === 'object' && Array.isArray(data.prepaid_cards)) {
                    setPrepaidCards(data.prepaid_cards);
                } else {
                    console.warn("Unexpected prepaid cards format:", data);
                    setPrepaidCards([]);
                }
            }
        } catch (e) {
            console.error("Shop fetch error", e);
        } finally {
            setIsLoadingShop(false);
        }
    };

    const handleCurrencySelect = (c: string) => {
        setFromCurrency(c);
        if (c === 'USDT' || c === 'ETH') setFromNetwork('ERC20');
        else setFromNetwork('Mainnet');
    };

    const fetchQuote = async () => {
        if (!amount || isNaN(parseFloat(amount))) return;
        setIsQuoting(true);
        setErrorMsg('');

        try {
            const params = new URLSearchParams({
                ticker_from: fromCurrency.toLowerCase(),
                network_from: fromNetwork,
                amount_from: amount
            });

            const res = await fetch(`/api/trocador/rates?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.details || data.error || 'Failed to get quote');
            setQuote(data);
        } catch (e: any) {
            setErrorMsg(e.message);
        } finally {
            setIsQuoting(false);
        }
    };

    const handleSwap = async () => {
        if (!quote || !recipientAddress) return;
        setStatus('swapping');
        setErrorMsg('');

        try {
            const payload = {
                ticker_from: fromCurrency.toLowerCase(),
                network_from: fromNetwork,
                amount_from: parseFloat(amount),
                address: recipientAddress,
                provider: quote.provider,
                id: quote.trade_id
            };

            const res = await fetch('/api/trocador/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, altcha: altchaPayload })
            });

            let data = await res.json();
            if (Array.isArray(data)) data = data[0];
            if (!res.ok) throw new Error(data.details || data.error || 'Swap execution failed');

            setTradeData(data);
            setStatus('success');
            saveToHistory({
                type: 'swap',
                trade_id: data.trade_id,
                ticker_from: fromCurrency,
                amount_from: amount,
                amount_to: data.amount_to,
                date: new Date().toISOString(),
                status: 'waiting'
            });

            // Redirect to internal checkout
            setTimeout(() => {
                navigate(`/checkout/${data.trade_id}`);
            }, 1500);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
        }
    };

    const handleOrderCard = async (item: any) => {
        if (!orderEmail || !altchaPayload) {
            setErrorMsg("Email and Captcha required");
            return;
        }

        setStatus('swapping');
        try {
            const endpoint = shopMode === 'giftcards' ? '/api/trocador/order_giftcard' : '/api/trocador/order_prepaidcard';
            const payload = shopMode === 'giftcards' ? {
                product_id: item.product_id,
                ticker_from: fromCurrency.toLowerCase(),
                network_from: fromNetwork,
                amount: orderAmount || (item.denominations ? item.denominations[0] : (item.min_amount || 50)),
                email: orderEmail,
                altcha: altchaPayload
            } : {
                provider: item.provider,
                currency_code: item.currency_code,
                ticker_from: fromCurrency.toLowerCase(),
                network_from: fromNetwork,
                amount: orderAmount || (item.amounts ? item.amounts[0] : 50),
                email: orderEmail,
                altcha: altchaPayload
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            let data = await res.json();
            if (Array.isArray(data)) data = data[0];
            if (!res.ok) throw new Error(data.details || data.error || 'Order failed');

            setTradeData(data);
            setStatus('success');
            saveToHistory({
                type: 'shop',
                trade_id: data.trade_id,
                item_name: item.name || item.brand,
                amount_from: data.amount_from,
                ticker_from: fromCurrency,
                date: new Date().toISOString(),
                status: 'waiting'
            });

            // Redirect to internal checkout
            setTimeout(() => {
                navigate(`/checkout/${data.trade_id}`);
            }, 1500);
        } catch (err: any) {
            setErrorMsg(err.message);
            setStatus('error');
        }
    };

    const copyAddress = () => {
        if (tradeData?.address_provider) {
            navigator.clipboard.writeText(tradeData.address_provider);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };


    return (
        <div className="pt-24 pb-20 px-4 md:px-6 max-w-5xl mx-auto min-h-screen animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="mb-8 border-b-4 border-black dark:border-white pb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="bg-monero-orange p-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <ArrowRightLeft size={32} className="text-white" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter dark:text-white leading-none">
                                TROCADOR_GATEWAY
                            </h1>
                        </div>
                        <p className="font-mono text-xs md:text-sm dark:text-gray-400 font-bold uppercase">
                            Private Swaps & Sovereign Shopping. No KYC. No Account.
                        </p>
                    </div>

                    {/* Sub-Tabs Navigation */}
                    <div className="flex gap-2 bg-gray-100 dark:bg-zinc-900 border-2 border-black dark:border-white p-1">
                        {[
                            { id: 'swap', icon: <Zap size={14} />, label: 'Asset Swap' },
                            { id: 'shop', icon: <ShoppingBag size={14} />, label: 'Boutique' },
                            { id: 'activity', icon: <History size={14} />, label: 'Activity' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as any)}
                                className={`flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase transition-all ${activeTab === tab.id
                                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(242,104,34,1)]'
                                    : 'hover:bg-gray-200 dark:hover:bg-zinc-800 dark:text-white'
                                    }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-4 text-[10px] font-bold text-monero-orange uppercase opacity-80">
                    Sovereign Fee Policy: 0% Added. Half of Trocador's commission supports GoXMR development.
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                <div className={`lg:col-span-12 ${activeTab === 'shop' ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
                    {activeTab === 'swap' && (
                        <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
                            <div className="flex justify-between items-center mb-6">
                                <span className="font-mono font-black text-xs uppercase tracking-widest text-gray-500">From Asset</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {supportedCoins.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => handleCurrencySelect(c)}
                                            className={`px-2 py-1 text-[10px] font-bold border-2 border-black dark:border-white uppercase ${fromCurrency === c ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-white'
                                                }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mb-6">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full text-4xl font-black bg-transparent border-b-4 border-black dark:border-white py-2 outline-none dark:text-white placeholder:text-gray-300 no-spinner"
                                />
                                <span className="absolute right-0 bottom-4 font-mono font-bold text-xl text-gray-400">{fromCurrency}</span>
                                <div className="absolute right-0 top-0 text-[8px] font-black text-monero-orange uppercase tracking-widest">{fromNetwork} Network</div>
                            </div>

                            {/* Quote Cards Section */}
                            {quote && (
                                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                    <div className="bg-gray-50 dark:bg-zinc-800 p-4 border-l-4 border-monero-orange">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Estimated Receive</div>
                                        <div className="font-mono font-black text-2xl text-monero-orange">{quote.amount_to} XMR</div>
                                        {quote.quotes && quote.quotes[0]?.waste && (
                                            <div className="mt-1 inline-flex items-center gap-1 bg-green-500/10 text-green-600 px-1 py-0.5 text-[8px] font-black uppercase border border-green-500/20">
                                                <Zap size={8} fill="currentColor" /> {Math.abs(parseFloat(quote.quotes[0].waste)).toFixed(2)}% Spread
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-zinc-800 p-4 border-l-4 border-gray-400">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Selected Provider</div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-bold text-sm dark:text-white">{quote.provider}</span>
                                            {quote.quotes && quote.quotes[0]?.kyc_rating && (
                                                <PrivacyShield rating={quote.quotes[0].kyc_rating} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mb-6">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Your Monero Receiver Address</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={recipientAddress}
                                        onChange={(e) => setRecipientAddress(e.target.value)}
                                        placeholder="4..."
                                        className="w-full text-sm font-mono font-bold bg-transparent border-2 border-black dark:border-white p-3 outline-none dark:text-white placeholder:text-gray-500"
                                    />
                                    <Wallet size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>

                            <div className="mt-8">
                                <AltchaWidget onVerify={setAltchaPayload} />

                                {errorMsg && (activeTab === 'swap') && (
                                    <div className="mb-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-3 flex items-start gap-2">
                                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase break-all">{errorMsg}</p>
                                    </div>
                                )}

                                {!quote ? (
                                    <button
                                        onClick={fetchQuote}
                                        disabled={isQuoting || !amount}
                                        className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 uppercase text-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                                    >
                                        {isQuoting ? <Loader2 className="animate-spin mx-auto" /> : 'Request Quote'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSwap}
                                        disabled={status === 'swapping' || !recipientAddress || !altchaPayload}
                                        className="w-full bg-monero-orange text-white font-black py-4 uppercase text-xl border-4 border-black dark:border-white hover:bg-black dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        {status === 'swapping' ? <Loader2 className="animate-spin mx-auto" /> : 'INITIATE SECURE SWAP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'shop' && (
                        <div className="flex flex-col gap-6">
                            <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center gap-4">
                                <div className="flex gap-1 border-2 border-black dark:border-white p-1">
                                    <button
                                        onClick={() => setShopMode('giftcards')}
                                        className={`px-3 py-1 text-[10px] font-black uppercase ${shopMode === 'giftcards' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:text-white'}`}
                                    >
                                        Gift Cards
                                    </button>
                                    <button
                                        onClick={() => setShopMode('prepaid')}
                                        className={`px-3 py-1 text-[10px] font-black uppercase ${shopMode === 'prepaid' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:text-white'}`}
                                    >
                                        Prepaid Cards
                                    </button>
                                </div>

                                <div className="relative flex-grow">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search brands (Amazon, Uber, Apple...)"
                                        className="w-full pl-10 pr-4 py-2 text-xs font-bold bg-transparent border-2 border-black dark:border-white outline-none dark:text-white"
                                    />
                                </div>

                                {shopMode === 'giftcards' && (
                                    <div className="relative">
                                        <select
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                            className="appearance-none bg-transparent border-2 border-black dark:border-white pl-8 pr-8 py-2 text-xs font-black uppercase outline-none dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"
                                        >
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code} className="dark:bg-black">
                                                    {c.flag} {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {isLoadingShop ? (
                                    <div className="col-span-12 py-20 flex flex-col items-center gap-4">
                                        <Loader2 className="animate-spin text-monero-orange" size={48} />
                                        <span className="font-mono text-xs uppercase font-black dark:text-white">Decrypting Inventory...</span>
                                    </div>
                                ) : (
                                    currentItems.map((item, idx) => (
                                        <div key={idx} className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(242,104,34,1)] transition-all flex flex-col h-64">
                                            <div className="h-12 flex items-center justify-between mb-2">
                                                <div className="font-black text-sm uppercase tracking-tight dark:text-white line-clamp-2 leading-none">
                                                    {item.name || item.brand}
                                                </div>
                                                {item.country && (
                                                    <span className="bg-black dark:bg-zinc-800 text-white dark:text-gray-400 px-1 py-0.5 text-[8px] font-black uppercase">
                                                        {item.country}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-grow bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 flex items-center justify-center p-2 mb-4 overflow-hidden">
                                                {item.card_image_url ? (
                                                    <img src={item.card_image_url} alt={item.name} className="max-h-full object-contain filter grayscale hover:grayscale-0 transition-all border border-black" />
                                                ) : (
                                                    <ShoppingBag size={32} className="text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="font-mono font-black text-monero-orange text-[10px]">
                                                    {parseCardAmounts(item).length > 0
                                                        ? `${parseCardAmounts(item)[0]} ${item.currency_code || (item.country === 'ES' ? 'EUR' : 'USD')}`
                                                        : (item.min_amount ? `${item.min_amount}+ ${item.currency_code || 'USD'}` : 'Custom')}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setTradeData(null);
                                                        setSelectedCard(item);
                                                        setTimeout(() => {
                                                            const modal = document.getElementById('item-order-panel');
                                                            if (modal) modal.scrollIntoView({ behavior: 'smooth' });
                                                        }, 100);
                                                    }}
                                                    className="bg-black dark:bg-white text-white dark:text-black text-[10px] font-black px-3 py-1 uppercase"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Pagination Controls */}
                            {!isLoadingShop && totalPages > 1 && (
                                <div className="flex justify-center items-center gap-4 mt-4">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="bg-black dark:bg-white text-white dark:text-black font-black px-4 py-2 uppercase text-xs disabled:opacity-30 flex items-center gap-2 border-2 border-transparent hover:border-monero-orange"
                                    >
                                        <ArrowRight size={14} className="rotate-180" /> Prev
                                    </button>
                                    <span className="font-mono font-black text-xs uppercase dark:text-white">
                                        Page {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="bg-black dark:bg-white text-white dark:text-black font-black px-4 py-2 uppercase text-xs disabled:opacity-30 flex items-center gap-2 border-2 border-transparent hover:border-monero-orange"
                                    >
                                        Next <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            {selectedCard && createPortal(
                                <div
                                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby={orderTitleId}
                                    onClick={closeOrderModal}
                                >
                                    <div
                                        ref={orderModalRef}
                                        tabIndex={-1}
                                        id="item-order-panel"
                                        onClick={e => e.stopPropagation()}
                                        className="bg-white dark:bg-zinc-900 border-4 border-monero-orange p-6 w-full max-w-2xl shadow-[8px_8px_0px_0px_rgba(242,104,34,0.4)] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto outline-none"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 id={orderTitleId} className="font-black text-2xl uppercase dark:text-white leading-none mb-1">{status === 'success' && tradeData ? 'PAYMENT_PENDING' : 'SECURE_PURCHASE'}</h3>
                                                <p className="text-[10px] font-bold text-monero-orange uppercase">{status === 'success' && tradeData ? 'Initialize secure payment stream' : `Item: ${selectedCard.name || selectedCard.brand}`}</p>
                                            </div>
                                            <button
                                                onClick={closeOrderModal}
                                                aria-label="Close"
                                                className="bg-black dark:bg-white text-white dark:text-black px-2 py-1 uppercase font-black text-[10px] hover:bg-monero-orange transition-colors"
                                            >
                                                Close [ESC]
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="flex flex-col gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Delivery Email</label>
                                                    <div className="relative">
                                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input
                                                            type="email"
                                                            value={orderEmail}
                                                            onChange={(e) => setOrderEmail(e.target.value)}
                                                            placeholder="Instructions sent here"
                                                            className="w-full pl-10 pr-4 py-3 text-xs font-bold bg-white dark:bg-zinc-950 border-2 border-black dark:border-white outline-none dark:text-white"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Pay with</label>
                                                        <select
                                                            value={fromCurrency}
                                                            onChange={(e) => handleCurrencySelect(e.target.value)}
                                                            className="w-full bg-white dark:bg-zinc-950 border-2 border-black dark:border-white p-2 text-xs font-black uppercase outline-none dark:text-white"
                                                        >
                                                            {supportedCoins.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Network</label>
                                                        <div className="bg-gray-100 dark:bg-zinc-800 p-2 text-xs font-black uppercase text-center border-2 border-black dark:border-zinc-700 dark:text-white">
                                                            {fromNetwork}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Selected Amount</label>
                                                    {parseCardAmounts(selectedCard).length > 0 ? (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {parseCardAmounts(selectedCard).slice(0, 9).map((amt: number) => (
                                                                <button
                                                                    key={amt}
                                                                    onClick={() => setOrderAmount(amt)}
                                                                    className={`py-2 text-[10px] font-black border-2 transition-all ${orderAmount === amt ? 'bg-monero-orange text-white border-black scale-[1.02]' : 'bg-white dark:bg-zinc-950 border-black dark:border-white opacity-50 hover:opacity-100'}`}
                                                                >
                                                                    {amt} {selectedCard.currency_code || 'USD'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={orderAmount}
                                                                onChange={(e) => setOrderAmount(Number(e.target.value))}
                                                                min={selectedCard.min_amount}
                                                                max={selectedCard.max_amount}
                                                                className="w-full pl-4 pr-12 py-3 text-xs font-bold bg-white dark:bg-zinc-950 border-2 border-black dark:border-white outline-none dark:text-white"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">{selectedCard.currency_code || 'USD'}</span>
                                                        </div>
                                                    )}
                                                    {selectedCard.min_amount && !parseCardAmounts(selectedCard).length && (
                                                        <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase italic">
                                                            Range: {selectedCard.min_amount} - {selectedCard.max_amount || '∞'} {selectedCard.currency_code || 'USD'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                {status === 'success' && tradeData ? (
                                                    <div className="bg-green-50 dark:bg-zinc-950 border-2 border-green-500 p-4 animate-in fade-in duration-500">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <div className="bg-green-500 text-white p-1 border border-black">
                                                                <Terminal size={16} />
                                                            </div>
                                                            <h3 className="font-mono font-black text-sm uppercase text-green-700 dark:text-green-400">Stream_Active</h3>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="text-[8px] font-black uppercase text-gray-500 mb-1 block">Send Exactly</label>
                                                                <div className="font-mono text-sm font-bold dark:text-white flex items-center justify-between bg-white dark:bg-black p-2 border border-black dark:border-white">
                                                                    <span>{tradeData.amount_from} <span className="text-monero-orange">{fromCurrency}</span></span>
                                                                    <button onClick={() => { navigator.clipboard.writeText(tradeData.amount_from.toString()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                                                                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-[8px] font-black uppercase text-gray-500 mb-1 block">Deposit Destination</label>
                                                                <div className="relative group">
                                                                    <div className="font-mono text-[10px] break-all bg-white dark:bg-black border border-black dark:border-white p-2 pr-8">
                                                                        {tradeData.address_provider}
                                                                    </div>
                                                                    <button
                                                                        onClick={copyAddress}
                                                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                                                                    >
                                                                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 border-t border-green-500/20 pt-2">
                                                                <div>
                                                                    <label className="text-[8px] font-black uppercase text-gray-500 mb-1 block">Stream_ID</label>
                                                                    <div className="font-mono font-bold dark:text-white text-[8px] tracking-tighter">{tradeData.trade_id}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <label className="text-[8px] font-black uppercase text-gray-500 mb-1 block">Status</label>
                                                                    <div className="text-[8px] font-black uppercase text-monero-orange animate-pulse">Waiting...</div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => navigate(`/checkout/${tradeData.trade_id}`)}
                                                                className="w-full block bg-black dark:bg-zinc-800 text-white font-black py-2 uppercase text-center border border-green-500 hover:bg-green-500 transition-all text-xs"
                                                            >
                                                                Track Transaction
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="bg-monero-orange/5 dark:bg-monero-orange/10 border-2 border-monero-orange/30 p-4">
                                                            <h4 className="text-[10px] font-black uppercase text-monero-orange mb-3 border-b border-monero-orange/20 pb-1 flex items-center gap-2">
                                                                <Terminal size={12} /> Order Summary
                                                            </h4>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between font-mono text-[10px] dark:text-white uppercase"><span className="text-gray-500">Region:</span> <span>{selectedCard.country || 'Global'}</span></div>
                                                                <div className="flex justify-between font-mono text-[10px] dark:text-white uppercase"><span className="text-gray-500">Value:</span> <span>{orderAmount} {selectedCard.currency_code || 'USD'}</span></div>
                                                                <div className="flex justify-between font-mono text-[10px] dark:text-white uppercase"><span className="text-gray-500">Fees:</span> <span className="text-green-500">0% Sovereign</span></div>
                                                            </div>
                                                            <div className="mt-4 pt-3 border-t border-monero-orange/20">
                                                                <p className="text-[8px] font-bold text-gray-500 uppercase leading-tight italic">
                                                                    Note: GoXMR charges 0 fees. All Trocador referral profits go directly to the <span className="text-monero-orange">Sovereign Donation Wallet</span>.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <AltchaWidget onVerify={setAltchaPayload} />

                                                        {errorMsg && (activeTab === 'shop') && (
                                                            <div className="text-[10px] font-bold text-red-600 uppercase border-l-2 border-red-500 pl-2">{errorMsg}</div>
                                                        )}

                                                        <button
                                                            onClick={() => handleOrderCard(selectedCard)}
                                                            disabled={!orderEmail || !altchaPayload || status === 'swapping'}
                                                            className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 uppercase text-xl shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
                                                        >
                                                            {status === 'swapping' ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRM_PURCHASE'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex justify-between items-center mb-8 border-b-2 border-gray-100 dark:border-zinc-800 pb-4">
                                <div>
                                    <h3 className="font-black text-2xl uppercase dark:text-white leading-none mb-1">YOUR_HISTORY</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">ZK Mode: Stored locally only.</p>
                                </div>
                                <button
                                    onClick={clearHistory}
                                    className="flex items-center gap-2 bg-red-500/10 text-red-500 border-2 border-red-500/20 px-3 py-1 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                                >
                                    <Trash2 size={12} /> Panic: Wipe All
                                </button>
                            </div>

                            {history.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center opacity-30 grayscale">
                                    <History size={64} className="mb-4" />
                                    <p className="font-mono font-black text-xs uppercase">No active records found in memory.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.map((record, i) => (
                                        <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-2 border-gray-100 dark:border-zinc-800 hover:border-monero-orange transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 border-2 border-black dark:border-white ${record.type === 'shop' ? 'bg-blue-500' : 'bg-monero-orange'}`}>
                                                    {record.type === 'shop' ? <ShoppingBag size={16} className="text-white" /> : <Zap size={16} className="text-white" />}
                                                </div>
                                                <div>
                                                    <div className="font-black text-xs uppercase dark:text-white">
                                                        {record.type === 'shop' ? `Order: ${record.item_name}` : `Swap: ${record.amount_from} ${record.ticker_from} → Monero`}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-gray-400">ID: {record.trade_id} • {new Date(record.date).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className={`text-[10px] font-black uppercase ${record.status === 'finished' ? 'text-green-500' : record.status === 'expired' || record.status === 'failed' ? 'text-red-500' : 'text-monero-orange animate-pulse'}`}>
                                                        {record.status}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(`/checkout/${record.trade_id}`);
                                                        }}
                                                        className="text-[8px] font-black text-gray-500 hover:text-black dark:hover:text-white border-b border-transparent hover:border-current uppercase"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className={`lg:col-span-12 xl:col-span-4 flex flex-col gap-6 ${activeTab === 'shop' ? 'hidden' : ''}`}>
                    {(status === 'success' && tradeData && activeTab !== 'shop') ? (
                        <div className="bg-green-50 dark:bg-zinc-950 border-4 border-green-500 p-6 animate-in slide-in-from-right duration-500 shadow-[8px_8px_0px_0px_rgba(34,197,94,0.2)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-green-500 text-white p-2 border-2 border-black">
                                    <Terminal size={24} />
                                </div>
                                <h3 className="font-mono font-black text-xl uppercase text-green-700 dark:text-green-400">Stream_Active</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Send Exactly</label>
                                    <div className="font-mono text-xl font-bold dark:text-white flex items-center justify-between bg-white dark:bg-black p-2 border-2 border-black dark:border-white">
                                        <span>{tradeData.amount_from} <span className="text-monero-orange">{fromCurrency}</span></span>
                                        <button onClick={() => { navigator.clipboard.writeText(tradeData.amount_from.toString()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Deposit Destination</label>
                                    <div className="relative group">
                                        <div className="font-mono text-xs break-all bg-white dark:bg-black border-2 border-black dark:border-white p-3 pr-10">
                                            {tradeData.address_provider}
                                        </div>
                                        <button
                                            onClick={copyAddress}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                                        >
                                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <p className="mt-2 text-[8px] font-bold text-red-500 uppercase flex items-center gap-1 leading-none">
                                        <AlertTriangle size={10} /> Network fees MUST be added on top.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t-2 border-green-500/20 pt-4">
                                    <div>
                                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Stream_ID</label>
                                        <div className="font-mono font-bold dark:text-white text-[10px] tracking-tighter">{tradeData.trade_id}</div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Delivery_Target</label>
                                        <div className="font-mono font-bold text-monero-orange text-[10px] line-clamp-1">{tradeData.address_user || orderEmail}</div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={() => navigate(`/checkout/${tradeData.trade_id}`)}
                                        className="w-full block bg-black dark:bg-zinc-800 text-white font-black py-3 uppercase text-center border-2 border-green-500 hover:bg-green-500 transition-colors"
                                    >
                                        Track Transaction
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-8 flex flex-col items-center justify-center opacity-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                            <ShieldCheck size={64} className="mb-6 text-gray-300 dark:text-zinc-800" />
                            <h4 className="font-black text-xs uppercase mb-2 dark:text-white">Standby_Monitor</h4>
                            <p className="font-mono text-[10px] text-center uppercase text-gray-400 leading-tight">
                                Select an asset or product to initialize a secure payment stream.
                                <br /><br />
                                <span className="text-monero-orange">Encrypting channel...</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .no-spinner::-webkit-inner-spin-button, 
                .no-spinner::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
                .no-spinner {
                    -moz-appearance: textfield;
                }
                .line-clamp-1 {
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;  
                    overflow: hidden;
                }
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;  
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
};
