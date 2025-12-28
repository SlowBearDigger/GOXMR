import React, { useEffect, useRef, useState } from 'react';
import { Zap, Shield, Check, Copy, RefreshCw, Loader2, QrCode } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';

interface PremiumUpgradeCardProps {
    isPremium: boolean;
    premiumSubaddress: string;
    premiumActivatedAt?: string | null;
    onRefresh?: () => void;
}

export const PremiumUpgradeCard: React.FC<PremiumUpgradeCardProps> = ({
    isPremium,
    premiumSubaddress,
    premiumActivatedAt,
    onRefresh
}) => {
    const [copied, setCopied] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);
    const [qrCode] = useState(() => new QRCodeStyling({
        width: 160,
        height: 160,
        type: 'svg',
        data: premiumSubaddress || 'monero:',
        margin: 5,
        qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'Q' },
        imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 0 },
        dotsOptions: { type: 'extra-rounded', color: '#f26822' },
        backgroundOptions: { color: 'transparent' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#000' },
        cornersDotOptions: { type: 'dot', color: '#000' }
    }));

    useEffect(() => {
        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qrCode.append(qrRef.current);
        }
    }, [qrCode]);

    useEffect(() => {
        if (premiumSubaddress) {
            qrCode.update({ data: `monero:${premiumSubaddress}` });
        }
    }, [premiumSubaddress, qrCode]);

    const handleCopy = () => {
        navigator.clipboard.writeText(premiumSubaddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`border-4 transition-all duration-300 ${isPremium ? 'border-monero-orange bg-monero-orange/5 shadow-[8px_8px_0px_0px_rgba(242,104,34,1)]' : 'border-dashed border-gray-300 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50'}`}>
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] ${isPremium ? 'bg-monero-orange border-black dark:border-white' : 'bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700'}`}>
                            <Zap size={24} className={isPremium ? 'text-white' : 'text-gray-400'} />
                        </div>
                        <div>
                            <h3 className="font-mono font-black text-xl uppercase dark:text-white tracking-tighter">
                                {isPremium ? 'Sovereign Identity Active' : 'Upgrade to Premium'}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {isPremium
                                    ? `EMITTED_ON: ${new Date(premiumActivatedAt!).toLocaleDateString()}`
                                    : 'Initialize lifetime cryptographic privileges'}
                            </p>
                        </div>
                    </div>
                    {isPremium && (
                        <div className="bg-monero-orange text-white text-[8px] font-black px-2 py-1 uppercase animate-pulse border-2 border-black dark:border-white">
                            LIFETIME_FOUNDER
                        </div>
                    )}
                </div>

                {!isPremium ? (
                    <div className="flex flex-col lg:flex-row gap-8 items-center md:items-start">
                        {/* Left: QR & Status */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-3 bg-white border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div ref={qrRef} className="w-40 h-40 flex items-center justify-center bg-white" />
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-black text-white text-[8px] font-bold uppercase tracking-widest">
                                <Loader2 size={10} className="animate-spin text-monero-orange" />
                                Waiting for Network Confirmation
                            </div>
                        </div>

                        {/* Right: Info & Address */}
                        <div className="flex-1 space-y-4">
                            <p className="text-[11px] font-mono font-bold text-gray-500 dark:text-gray-400 leading-tight uppercase">
                                To activate lifetime premium status, send any amount of XMR to your unique subaddress.
                                <br /><span className="text-monero-orange">Activation is automatic after 1 confirmation (~2 min).</span>
                            </p>

                            <div className="relative group mt-4">
                                <div className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-1 tracking-widest">Your Private Subaddress</div>
                                <div className="bg-white dark:bg-zinc-950 border-2 border-black dark:border-white p-3 pr-12 font-mono text-[9px] font-bold dark:text-white break-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    {premiumSubaddress || 'GENERATING_ADDRESS...'}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="absolute right-2 bottom-2 p-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-4 border-t-2 border-dashed border-gray-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                    <Check size={10} className="text-monero-orange" /> Managed Signals
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                    <Check size={10} className="text-monero-orange" /> Managed Drops
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                    <Check size={10} className="text-monero-orange" /> Exclusive Themes
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                    <Check size={10} className="text-monero-orange" /> Priority Handles
                                </div>
                            </div>

                            <button
                                onClick={onRefresh}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-2 border-2 border-black dark:border-white font-mono text-[10px] font-black uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors dark:text-white"
                            >
                                <RefreshCw size={12} /> Sync Status
                            </button>
                            <button
                                onClick={async () => {
                                    const btn = document.getElementById('force-scan-btn');
                                    if (btn) {
                                        btn.innerHTML = 'SCANNING BLOCKCHAIN...';
                                        btn.setAttribute('disabled', 'true');
                                    }
                                    try {
                                        const token = localStorage.getItem('goxmr_token');
                                        await fetch('/api/me/premium/check', {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (onRefresh) onRefresh();
                                    } catch (e) { console.error(e); }
                                    if (btn) {
                                        btn.innerHTML = 'FORCE PAYMENT SCAN';
                                        btn.removeAttribute('disabled');
                                    }
                                }}
                                id="force-scan-btn"
                                className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-black dark:bg-white text-white dark:text-black font-mono text-[10px] font-black uppercase hover:bg-monero-orange dark:hover:bg-monero-orange hover:text-white transition-colors"
                            >
                                <Zap size={12} /> FORCE PAYMENT SCAN
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-monero-orange/10 border-2 border-monero-orange p-6 flex items-center justify-center gap-4 text-monero-orange">
                            <Shield size={32} className="animate-pulse" />
                            <div>
                                <h4 className="font-mono font-black text-xl uppercase tracking-widest text-monero-orange">Sovereignty Confirmed</h4>
                                <p className="text-[10px] font-bold uppercase tracking-tight">All advanced cryptographic features are now online.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="border-2 border-black dark:border-white p-4">
                                <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Link_Manager</div>
                                <div className="font-mono font-bold text-xs dark:text-white">ENABLED</div>
                            </div>
                            <div className="border-2 border-black dark:border-white p-4">
                                <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Encrypted_Vaults</div>
                                <div className="font-mono font-bold text-xs dark:text-white">UNLOCKED</div>
                            </div>
                            <div className="border-2 border-black dark:border-white p-4">
                                <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Theme_Studio</div>
                                <div className="font-mono font-bold text-xs dark:text-white">ADMIN</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
