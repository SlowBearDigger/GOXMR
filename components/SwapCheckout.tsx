import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Loader2, Copy, Check, Terminal, ShieldCheck,
    ArrowRight, AlertTriangle, Clock, RefreshCw,
    ChevronLeft, ExternalLink, Zap, PackageCheck, Send
} from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { apiFetch } from '../utils/api';

interface TradeData {
    trade_id: string;
    status: string;
    ticker_from: string;
    ticker_to: string;
    amount_from: number;
    amount_to: number;
    address_provider: string;
    address_user: string;
    provider: string;
    expiresAt?: string;
    date: string;
    payment?: boolean;
    details?: {
        hashout?: string;
        item_name?: string;
    };
    email?: string;
}

export const SwapCheckout: React.FC = () => {
    const { tradeId } = useParams<{ tradeId: string }>();
    const [trade, setTrade] = useState<TradeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<'address' | 'amount' | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling>(new QRCodeStyling({
        width: 240,
        height: 240,
        dotsOptions: { color: "#f26822", type: "rounded" },
        backgroundOptions: { color: "transparent" },
        imageOptions: {
            crossOrigin: "anonymous",
            margin: 5,
            imageSize: 0.4
        }
    }));

    const fetchStatus = async () => {
        if (!tradeId) return;
        try {
            const res = await apiFetch(`/api/trocador/trade/${tradeId}`);
            const data = await res.json();
            if (res.ok) {
                // Trocador API sometimes returns an array containing the trade object
                const normalizedData = Array.isArray(data) ? data[0] : data;
                if (!normalizedData) throw new Error('Trade not found');
                setTrade(normalizedData);
                setError(null);
            } else {
                if (res.status === 429) {
                    console.warn("Rate limit hit, keeping current data");
                    // We don't set error here to keep the UI showing the last known state
                    return;
                }
                throw new Error(data.error || 'Failed to fetch trade status');
            }
        } catch (err: any) {
            console.error("Status check failed", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 15000); // Every 15s
        return () => clearInterval(interval);
    }, [tradeId]);

    useEffect(() => {
        if (trade?.address_provider && qrRef.current) {
            qrCode.current.update({ data: trade.address_provider });
            if (!qrRef.current.hasChildNodes()) {
                qrCode.current.append(qrRef.current);
            }
        }
    }, [trade?.address_provider]);

    const handleCopy = (text: string, type: 'address' | 'amount') => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'waiting': return 'text-monero-orange';
            case 'confirming': return 'text-blue-500';
            case 'sending': return 'text-cyan-500';
            case 'finished': return 'text-green-500';
            case 'failed':
            case 'expired':
            case 'halted': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getStatusStep = (status: string) => {
        const steps = ['waiting', 'confirming', 'sending', 'finished'];
        const index = steps.indexOf(status);
        if (index === -1) {
            if (status === 'paid partially') return 1;
            return 0;
        }
        return index;
    };

    if (loading && !trade) {
        return (
            <div className="pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-screen">
                <Loader2 size={48} className="animate-spin text-monero-orange mb-4" />
                <p className="font-mono font-black text-xs uppercase dark:text-white">Decrypting Transaction Channel...</p>
            </div>
        );
    }

    if (error && !trade) {
        return (
            <div className="pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-screen text-center">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-black uppercase mb-2 dark:text-white">ACCESS_DENIED</h2>
                <p className="text-gray-500 uppercase font-bold text-xs mb-6 max-w-md">{error}</p>
                <Link to="/dashboard" className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 font-black uppercase shadow-[4px_4px_0px_0px_rgba(242,104,34,1)]">
                    Return to Safe Zone
                </Link>
            </div>
        );
    }

    const currentStep = getStatusStep(trade?.status || 'waiting');

    return (
        <div className="pt-24 pb-20 px-4 md:px-6 max-w-4xl mx-auto min-h-screen animate-in fade-in duration-500">
            {/* Nav Header */}
            <div className="mb-8 flex items-center justify-between border-b-4 border-black dark:border-white pb-6">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" onClick={() => window.history.back()} className="bg-black dark:bg-zinc-800 text-white p-2 border-2 border-transparent hover:border-monero-orange transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter dark:text-white leading-none">
                            SECURE_CHECKOUT
                        </h1>
                        <p className="font-mono text-[10px] dark:text-gray-500 font-bold uppercase mt-1">
                            Trade ID: {tradeId} • Sovereign Verification Active
                        </p>
                    </div>
                </div>
                <div className={`hidden md:flex flex-col items-end`}>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 border-2 border-black dark:border-white ${getStatusColor(trade?.status || '')}`}>
                        STATUS: {trade?.status}
                    </span>
                    {trade?.expiresAt && (
                        <div className="flex items-center gap-1 text-[8px] font-bold text-gray-500 mt-1 uppercase">
                            <Clock size={10} /> Expires {new Date(trade.expiresAt).toLocaleTimeString()}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Payment Instructions */}
                <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
                    <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">

                        {/* Stepper Component */}
                        <div className="mb-10 relative flex justify-between">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 dark:bg-zinc-800 -translate-y-1/2 z-0" />
                            <div
                                className="absolute top-1/2 left-0 h-1 bg-monero-orange -translate-y-1/2 z-0 transition-all duration-1000"
                                style={{ width: `${(currentStep / 3) * 100}%` }}
                            />

                            {[
                                { icon: <Send size={14} />, label: 'Deposit' },
                                { icon: <RefreshCw size={14} />, label: 'Confirm' },
                                { icon: <PackageCheck size={14} />, label: 'Exchange' },
                                { icon: <ShieldCheck size={14} />, label: 'Finished' }
                            ].map((step, idx) => (
                                <div key={idx} className="relative z-10 flex flex-col items-center">
                                    <div className={`w-8 h-8 flex items-center justify-center border-4 border-black dark:border-white transition-all duration-300 ${idx <= currentStep ? 'bg-monero-orange text-white' : 'bg-white dark:bg-zinc-900 text-gray-300'
                                        }`}>
                                        {idx < currentStep ? <Check size={16} strokeWidth={4} /> : step.icon}
                                    </div>
                                    <span className={`text-[8px] font-black uppercase mt-2 tracking-widest ${idx <= currentStep ? 'text-monero-orange' : 'text-gray-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {trade?.status === 'finished' ? (
                            <div className="text-center py-12 animate-in zoom-in-95">
                                <div className="inline-block bg-green-500 text-white p-6 border-4 border-black mb-6 shadow-[6px_6px_0px_0px_rgba(34,197,94,0.3)]">
                                    <ShieldCheck size={64} />
                                </div>
                                <h2 className="text-4xl font-black uppercase dark:text-white mb-3 tracking-tighter">TRANSACTION_COMPLETE</h2>
                                <p className="text-gray-500 text-xs uppercase font-bold max-w-sm mx-auto mb-10">
                                    Your secure payment stream has been fulfilled. Funds are now in the custody of your target receiver.
                                </p>

                                <div className="max-w-md mx-auto space-y-4">
                                    {trade.details?.hashout && (
                                        <div className="bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-white p-4">
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">On-Chain Proof (TXID)</label>
                                            <div className="font-mono text-[9px] break-all dark:text-white mb-4 leading-tight">{trade.details.hashout}</div>
                                            <a href={`https://xmrchain.net/search?value=${trade.details.hashout}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 font-black uppercase text-[10px] border-2 border-transparent hover:border-monero-orange transition-all">
                                                Verify on Explorer <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    )}

                                    <Link to="/dashboard" className="inline-block font-mono font-black text-xs uppercase text-monero-orange hover:text-black dark:hover:text-white transition-colors border-b-2 border-monero-orange/30 hover:border-current pb-1">
                                        Return to Command Center
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                                    {/* QR Code Container */}
                                    <div className="bg-white p-3 border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(242,104,34,1)]">
                                        <div ref={qrRef} className="w-[240px] h-[240px]" />
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Send Exactly</label>
                                            <div className="flex items-center gap-2">
                                                <div className="font-mono text-3xl font-black text-monero-orange animate-pulse">
                                                    {trade?.amount_from}
                                                </div>
                                                <div className="font-mono text-xl font-bold dark:text-white uppercase px-2 py-1 bg-black dark:bg-zinc-800 border-2 border-monero-orange">
                                                    {trade?.ticker_from}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    onClick={() => handleCopy(trade?.amount_from.toString() || '', 'amount')}
                                                    className="flex items-center gap-1 bg-black dark:bg-white text-white dark:text-black px-3 py-1 text-[10px] font-black uppercase hover:bg-monero-orange transition-all"
                                                >
                                                    {copied === 'amount' ? <Check size={12} /> : <Copy size={12} />} Copy Amount
                                                </button>
                                            </div>
                                            <p className="mt-2 text-[8px] font-bold text-red-500 uppercase flex items-center gap-1 leading-none">
                                                <AlertTriangle size={10} /> MUST add network fees on top manually.
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t-2 border-dashed border-gray-100 dark:border-zinc-800">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Deposit Destination</label>
                                            <div className="relative group">
                                                <div className="font-mono text-xs break-all bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-white p-3 pr-10 dark:text-white">
                                                    {trade?.address_provider}
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(trade?.address_provider || '', 'address')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-monero-orange transition-colors"
                                                >
                                                    {copied === 'address' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Information & Safety */}
                <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
                    <div className="bg-black dark:bg-white text-white dark:text-black p-6 shadow-[8px_8px_0px_0px_rgba(242,104,34,1)]">
                        <div className="flex items-center gap-2 mb-4 border-b border-white/20 dark:border-black/20 pb-2">
                            <Terminal size={18} />
                            <h3 className="font-black text-sm uppercase">Secure_Stream_Details</h3>
                        </div>

                        <div className="space-y-4 font-mono">
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="opacity-50">{trade?.payment ? 'Product:' : 'Exchange Mode:'}</span>
                                <span className="font-black text-monero-orange">
                                    {trade?.payment ? (trade?.details?.item_name || trade?.ticker_to) : `${trade?.ticker_from} → ${trade?.ticker_to}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="opacity-50">Estimated Return:</span>
                                <span className="font-black text-monero-orange">{trade?.amount_to} {trade?.ticker_to}</span>
                            </div>
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="opacity-50">Provider Service:</span>
                                <span className="font-black">{trade?.provider}</span>
                            </div>
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="opacity-50">Timestamp:</span>
                                <span className="font-black">{new Date(trade?.date || '').toLocaleString()}</span>
                            </div>

                            <div className="pt-4 border-t border-white/20 dark:border-black/20">
                                <label className="text-[8px] font-black uppercase opacity-50 mb-1 block">
                                    {trade?.payment ? 'Delivery Target (Email)' : 'Receiver Address Target'}
                                </label>
                                <div className="text-[9px] break-all opacity-80 leading-tight">
                                    {trade?.address_user || trade?.email}
                                </div>
                            </div>

                            {trade?.status !== 'finished' && (
                                <div className="mt-6 p-3 bg-monero-orange/10 border border-monero-orange/30 text-monero-orange text-[9px] leading-relaxed">
                                    <p className="font-black uppercase mb-1 flex items-center gap-1">
                                        <ShieldCheck size={10} /> Sovereign Support Channel
                                    </p>
                                    If you encounter issues, provide your Trade ID to support. Do not close this page until the deposit is confirmed.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-white p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap size={14} className="text-monero-orange" />
                            <h4 className="text-[10px] font-black uppercase dark:text-white">Status_Feed</h4>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-monero-orange animate-ping" />
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">Live monitoring active</span>
                                </div>
                                <span className="text-[8px] font-mono text-gray-400">Updates every 15s</span>
                            </div>

                            <div className="mt-4 flex flex-col gap-1">
                                {trade?.status === 'waiting' && (
                                    <div className="text-[10px] bg-black text-white p-2 font-mono uppercase leading-tight italic">
                                        {'>'} Waiting for incoming deposit...
                                    </div>
                                )}
                                {trade?.status === 'confirming' && (
                                    <div className="text-[10px] bg-blue-500 text-white p-2 font-mono uppercase leading-tight">
                                        {'>'} Deposit detected. Confirming on-chain...
                                    </div>
                                )}
                                {trade?.status === 'sending' && (
                                    <div className="text-[10px] bg-cyan-500 text-white p-2 font-mono uppercase leading-tight">
                                        {'>'} Exchange complete. Sending funds to target...
                                    </div>
                                )}
                            </div>
                        </div>

                        <a
                            href={`https://trocador.app/en/checkout/${tradeId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full mt-4 flex items-center justify-center gap-1 text-[8px] font-black uppercase text-gray-400 hover:text-black dark:hover:text-white transition-all underline decoration-dotted"
                        >
                            Emergency External Tracker <ExternalLink size={8} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
