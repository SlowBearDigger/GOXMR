import React, { useState, useEffect } from 'react';
import { Copy, Info, Heart, Zap, ShieldCheck, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import QRCodeStyling from 'qr-code-styling';

// Two-component split to avoid the "modal opens N times" bug:
//   <DonationGoal hidden />        ← single instance in App.tsx that listens for the
//                                    global goxmr:support:open event and renders the modal.
//   <DonationGoalButton />         ← lightweight click target used by Header/LandingPage;
//                                    just dispatches the event. No modal lives here.
// The old code rendered button + modal + listener in every mount, so 3 mounts ⇒ 3 modals.

const WALLET_ADDRESS = "42EDsE43TWaNxWcN77DZ3oNPkmxC9zsfg9L8Bb6KkwKyTqNng7AsJpuRM1oh8UpkiyfkGLok5ePAMS4miPpXPw8oCKtqwrV";

// Shared hook: live status from /api/dev-fund-status, polled every 60s.
function useDevFundStatus() {
    const [current, setCurrent] = useState(0);
    const [goal, setGoal] = useState(5.00);
    const [isSyncing, setIsSyncing] = useState(false);
    const [height, setHeight] = useState(0);
    useEffect(() => {
        let alive = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/dev-fund-status');
                if (!res.ok) return;
                const data = await res.json();
                if (!alive) return;
                setCurrent(Number(data.balance) || 0);
                setGoal(Number(data.goal) || 5.00);
                setIsSyncing(!!data.isSyncing);
                setHeight(Number(data.height) || 0);
            } catch { /* ignore */ }
        };
        fetchStatus();
        const id = setInterval(fetchStatus, 60000);
        return () => { alive = false; clearInterval(id); };
    }, []);
    const percent = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    const remaining = Math.max(goal - current, 0);
    return { current, goal, isSyncing, height, percent, remaining };
}

// Visible "support the mission" button. Click → dispatches the global event so the
// single hidden mount opens the modal. Use this everywhere a CTA is needed.
export const DonationGoalButton: React.FC = () => {
    const { percent } = useDevFundStatus();
    const trigger = () => window.dispatchEvent(new CustomEvent('goxmr:support:open'));
    return (
        <div className="flex items-center">
            <button
                onClick={trigger}
                className="group relative flex items-center gap-4 bg-white dark:bg-zinc-900 text-black dark:text-white px-5 py-2 border-2 border-black dark:border-white overflow-hidden transition-all hover:border-monero-orange hover:translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-none dark:hover:shadow-none"
                title="Click to Contribute"
            >
                <div className="flex flex-col items-start leading-none gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">SUPPORT_THE_MISSION</span>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-200 dark:bg-zinc-800 overflow-hidden border border-black dark:border-zinc-700">
                            <div className="h-full bg-monero-orange transition-all duration-1000" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-monero-orange">{Math.round(percent)}%</span>
                    </div>
                </div>
                <div className="p-1.5 bg-monero-orange text-white rounded-none group-hover:scale-110 transition-transform border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Heart size={14} className="fill-current animate-pulse" />
                </div>
            </button>
        </div>
    );
};

interface DonationGoalProps { hidden?: boolean }
export const DonationGoal: React.FC<DonationGoalProps> = ({ hidden }) => {
    const { current, goal, isSyncing, height, percent, remaining } = useDevFundStatus();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const qrRef = React.useRef<HTMLDivElement>(null);

    // Listen for global open events (header support link / terminal "support" command in the future)
    useEffect(() => {
        const h = () => setIsOpen(true);
        window.addEventListener('goxmr:support:open', h);
        return () => window.removeEventListener('goxmr:support:open', h);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(WALLET_ADDRESS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        if (!isOpen || !qrRef.current) return;

        const qrCode = new QRCodeStyling({
            width: 200,
            height: 200,
            type: 'svg',
            data: `monero:${WALLET_ADDRESS}`,
            dotsOptions: {
                color: '#F26822',
                type: 'square'
            },
            backgroundOptions: {
                color: 'transparent',
            },
            cornersSquareOptions: {
                type: 'square',
                color: '#F26822'
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 5
            }
        });

        qrRef.current.innerHTML = '';
        qrCode.append(qrRef.current);
    }, [isOpen]);

    // Backwards-compat: if a caller mounts <DonationGoal /> without `hidden`, still
    // render the visible CTA button. New code should use <DonationGoalButton/> instead.
    return (
        <>
            {!hidden && <DonationGoalButton />}

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="TX_PROTOCOL: DONATION_HANDSHAKE">
                <div className="flex flex-col gap-6 relative">
                    <div className="absolute -top-10 -right-6 opacity-5 pointer-events-none">
                        <Zap size={120} className="text-monero-orange" />
                    </div>

                    {/* Public funds-usage receipt. Hardcoded for now; when we have a feed
                        endpoint this should pull the latest spend post dynamically. The link
                        explains why the live balance may be lower than the raised total. */}
                    <a
                        href="https://x.com/SlowBearDigger/status/2060373217810776454?s=20"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-amber-50 dark:bg-amber-900/15 border-2 border-amber-500 p-3 hover:bg-amber-100 dark:hover:bg-amber-900/25 transition-colors group"
                    >
                        <div className="flex items-start gap-2">
                            <Info size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">
                                    Funds usage log
                                </p>
                                <p className="text-[11px] font-mono text-amber-900 dark:text-amber-100 leading-snug mt-1">
                                    Current balance is low because recent contributions were already deployed.
                                    Read the public spend report on X.
                                </p>
                                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider group-hover:underline">
                                    Open report <ExternalLink size={10} />
                                </span>
                            </div>
                        </div>
                    </a>

                    {/* Header block — project identity + verified badge + live progress */}
                    <div className="bg-black text-[#00FF41] p-4 font-mono text-[10px] border-l-4 border-[#00FF41]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white mb-1">
                            GOXMR — Sovereign Privacy-First Link-in-Bio &amp; community projects
                        </p>
                        <p className="flex items-center gap-2 mt-2">
                            <ShieldCheck size={12} className="text-[#00FF41]" />
                            <span className="uppercase tracking-wider">Contact Verified</span>
                        </p>
                        <div className="mt-3 flex items-baseline gap-3">
                            <span className="text-2xl font-black text-monero-orange">{percent.toFixed(1)}%</span>
                            <span className="uppercase tracking-widest text-[10px] opacity-70">funded</span>
                        </div>
                        <div className="mt-2 h-2 w-full bg-zinc-900 border border-[#00FF41]/40">
                            <div className="h-full bg-monero-orange transition-all duration-1000" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-2 text-[10px]">
                            <span className="text-monero-orange font-bold">{current.toFixed(4)} XMR</span>
                            <span className="opacity-70"> / {goal.toFixed(4)} XMR goal</span>
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white border-4 border-black dark:border-monero-orange shadow-[8px_8px_0px_0px_rgba(242,104,34,1)] relative group">
                                <div ref={qrRef} className="w-[200px] h-[200px] flex items-center justify-center bg-white" />
                                <div className="absolute inset-0 border-2 border-monero-orange opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase text-gray-500">Scan_To_Transmit_XMR</span>
                        </div>

                        <div className="flex-1 space-y-4">
                            <div className="bg-gray-50 dark:bg-zinc-800/50 border-2 border-black dark:border-white p-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-8 h-8 bg-monero-orange opacity-10 clip-path-polygon-[100%_0,0_0,100%_100%]"></div>
                                <h3 className="font-mono font-black text-sm mb-2 dark:text-white uppercase tracking-tighter italic">What's missing</h3>
                                <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed font-mono">
                                    {remaining > 0 ? (
                                        <>
                                            <span className="text-monero-orange font-bold">{remaining.toFixed(4)} XMR</span>
                                            {' '}left to hit the current goal. Covers infra, giveaways, and ongoing development.
                                        </>
                                    ) : (
                                        <>Goal reached. Anything extra rolls into the next milestone.</>
                                    )}
                                    <br /><br />
                                    <span className="text-monero-orange font-bold">Anything extra is appreciated.</span> Funds community projects and the occasional beer or pizza for the late nights.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 flex justify-between">
                                    <span>Monero_Address</span>
                                    {copied && <span className="text-green-500 animate-bounce">LINK_COPIED</span>}
                                </label>
                                <button
                                    onClick={handleCopy}
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-black dark:border-white p-3 text-[9px] font-mono break-all text-left hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all relative group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                                >
                                    {WALLET_ADDRESS}
                                    <Copy size={14} className="absolute top-2 right-2 opacity-30 group-hover:opacity-100" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t-2 border-dashed border-gray-200 dark:border-zinc-800 pt-4 space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 dark:bg-zinc-800/30 p-2 border border-gray-100 dark:border-zinc-700">
                                <span className="block text-[8px] font-black text-gray-400 uppercase">Received</span>
                                <span className="text-xs font-mono font-bold dark:text-white">{current.toFixed(4)} XMR</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800/30 p-2 border border-gray-100 dark:border-zinc-700">
                                <span className="block text-[8px] font-black text-gray-400 uppercase">Goal</span>
                                <span className="text-xs font-mono font-bold dark:text-white">{goal.toFixed(4)} XMR</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800/30 p-2 border border-gray-100 dark:border-zinc-700">
                                <span className="block text-[8px] font-black text-gray-400 uppercase">Block</span>
                                <span className="text-xs font-mono font-bold dark:text-white">{height ? height.toLocaleString() : (isSyncing ? 'SYNCING…' : '—')}</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 p-3">
                            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-blue-700 dark:text-blue-300 font-mono leading-tight uppercase">
                                <strong>Privacy_Note:</strong> Progress is tracked via Private View Key scanning.
                                We only see incoming amounts, never sender identities or IP data.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 uppercase font-black text-xs hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:shadow-none active:translate-y-1"
                    >
                        Return_To_Mission
                    </button>
                </div>
            </Modal>
        </>
    );
};
