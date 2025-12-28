import React, { useState, useEffect } from 'react';
import { QRTool } from './QRTool/QRTool';
import { SignalsTool } from './Tools/SignalsTool';
import { DropsTool } from './Tools/DropsTool';
import { GlitchText } from './GlitchText';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { Wrench, QrCode, Link2, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';

type ToolView = 'hub' | 'qr' | 'signals' | 'drops';

export const Tools: React.FC = () => {
    const [view, setView] = useState<ToolView>('hub');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [premiumSubaddress, setPremiumSubaddress] = useState('');
    const [premiumActivatedAt, setPremiumActivatedAt] = useState<string | null>(null);

    const fetchPremiumStatus = async () => {
        const token = localStorage.getItem('goxmr_token');
        if (!token) return;
        try {
            const res = await fetch('/api/me/premium', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIsPremium(data.isPremium);
                setPremiumSubaddress(data.subaddress);
                if (data.activatedAt) setPremiumActivatedAt(data.activatedAt);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem('goxmr_token'));
        fetchPremiumStatus();
    }, []);

    const ToolCard = ({ id, icon: Icon, title, description, badge }: { id: ToolView, icon: any, title: string, description: string, badge?: string }) => (
        <button
            onClick={() => setView(id)}
            className="group relative border-4 border-black dark:border-white p-6 bg-white dark:bg-zinc-900 text-left hover:bg-black dark:hover:bg-white transition-all duration-150 ease-in-out shadow-[8px_8px_0px_0px_rgba(242,104,34,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:translate-x-[8px] active:translate-y-[8px] active:shadow-none flex flex-col h-full cursor-pointer"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="bg-monero-orange p-3 border-2 border-black dark:border-white group-hover:bg-white dark:group-hover:bg-black group-hover:text-monero-orange transition-colors duration-150">
                    <Icon size={24} className="text-white group-hover:text-monero-orange transition-colors duration-150" />
                </div>
                {badge && <span className="bg-black dark:bg-white text-white dark:text-black text-[8px] font-black uppercase px-2 py-1 tracking-widest">{badge}</span>}
            </div>
            <h3 className="font-mono font-black text-xl mb-2 dark:text-white group-hover:text-white dark:group-hover:text-black uppercase tracking-tighter transition-colors duration-150">
                {title}
            </h3>
            <p className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-gray-600 leading-tight uppercase transition-colors duration-150">
                {description}
            </p>
            <div className="mt-auto pt-6 flex items-center gap-2 text-monero-orange font-black text-[10px] uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                Initialize Protocol <ArrowLeft className="rotate-180" size={14} />
            </div>
        </button>
    );

    if (view === 'hub') {
        return (
            <div className="pt-24 pb-20 px-4 md:px-6 max-w-7xl mx-auto min-h-screen animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-4 border-black dark:border-white pb-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-monero-orange p-2 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <Wrench size={24} className="text-white" />
                            </div>
                            <span className="font-mono font-black text-xs uppercase tracking-widest dark:text-white opacity-50">Sovereign_Toolbox_v2.0</span>
                        </div>
                        <GlitchText
                            text="SOVEREIGN UTILITIES"
                            as="h1"
                            className="text-4xl md:text-6xl font-black tracking-tighter uppercase dark:text-white leading-none"
                        />
                        <p className="font-mono text-sm md:text-md mt-4 dark:text-gray-400 max-w-2xl font-bold leading-tight uppercase">
                            Advanced cryptographic arsenal for the digital resistance. Zero-knowledge, open-source, and entirely decentralized.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                    <ToolCard
                        id="qr"
                        icon={QrCode}
                        title="QR FOUNDRY"
                        description="Professional-grade Monero & Crypto invoices. Custom themes, error correction, and high-fidelity generation."
                        badge="v1.4"
                    />
                    <ToolCard
                        id="signals"
                        icon={Link2}
                        title="SIGNALS"
                        description="Secure URL shortener with password gating and sovereign redirection. Perfect for anonymous drops."
                        badge="NEW"
                    />
                    <ToolCard
                        id="drops"
                        icon={Lock}
                        title="DEAD DROPS"
                        description="Zero-knowledge encrypted notes. Content is encrypted client-side with AES or PGP. Burn-after-read protocol."
                        badge="NEW"
                    />
                </div>

                {isLoggedIn && (
                    <div className="mb-12">
                        <PremiumUpgradeCard
                            isPremium={isPremium}
                            premiumSubaddress={premiumSubaddress}
                            premiumActivatedAt={premiumActivatedAt}
                            onRefresh={fetchPremiumStatus}
                        />
                    </div>
                )}

                <div className="mt-12 p-6 border-4 border-dashed border-gray-300 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={48} className="text-monero-orange" />
                        <div>
                            <h4 className="font-mono font-black text-lg dark:text-white uppercase tracking-tighter">Security Protocol</h4>
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase max-w-sm">
                                All tools operate with zero data extraction. Non-premium users are protected by Altcha Proof-of-Work to prevent systemic abuse.
                            </p>
                        </div>
                    </div>
                    {!isLoggedIn && (
                        <div className="md:ml-auto flex flex-col gap-2 items-end">
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 p-2 text-[9px] font-bold dark:text-yellow-400 uppercase max-w-[200px]">
                                Anonymous users are restricted to 24-hour buffer persistence.
                            </div>
                            <span className="text-[8px] font-mono font-black text-gray-400 uppercase tracking-widest">Connect credentials to unlock management</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-20 px-4 md:px-6 max-w-7xl mx-auto min-h-screen animate-in slide-in-from-right duration-300">
            <div className="mb-12">
                <button
                    onClick={() => setView('hub')}
                    className="flex items-center gap-2 font-mono font-black text-xs uppercase tracking-widest text-monero-orange hover:gap-4 transition-all"
                >
                    <ArrowLeft size={16} /> Back to Arsenal
                </button>
            </div>

            <div className="mb-12 flex items-center gap-6">
                <div className="bg-monero-orange p-4 border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {view === 'qr' && <QrCode size={40} className="text-white" />}
                    {view === 'signals' && <Link2 size={40} className="text-white" />}
                    {view === 'drops' && <Lock size={40} className="text-white" />}
                </div>
                <div>
                    <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter dark:text-white leading-none">
                        {view === 'qr' ? 'QR FOUNDRY' : view === 'signals' ? 'SIGNALS' : 'DEAD DROPS'}
                    </h2>
                    <p className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 opacity-60">
                        {view === 'qr' ? 'GEN_PATH: sov_utility_01' : view === 'signals' ? 'GEN_PATH: sov_utility_02' : 'GEN_PATH: sov_utility_03'}
                    </p>
                </div>
            </div>

            <div className="mt-8">
                {view === 'qr' && <QRTool />}
                {view === 'signals' && <SignalsTool isLoggedIn={isLoggedIn} isPremium={isPremium} />}
                {view === 'drops' && <DropsTool isLoggedIn={isLoggedIn} isPremium={isPremium} />}
            </div>
        </div>
    );
};
