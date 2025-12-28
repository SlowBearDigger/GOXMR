import React, { useState, useEffect } from 'react';
import { Copy, Check, Info, RefreshCw, Heart, Zap, Globe } from 'lucide-react';
import { Modal } from './Modal';
import QRCodeStyling from 'qr-code-styling';

export const DonationGoal: React.FC = () => {
    const [current, setCurrent] = useState(3.44);
    const [goal, setGoal] = useState(5.00);
    const [isSyncing, setIsSyncing] = useState(false);
    const [height, setHeight] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const qrRef = React.useRef<HTMLDivElement>(null);

    const percent = Math.min((current / goal) * 100, 100);
    const WALLET_ADDRESS = "42EDsE43TWaNxWcN77DZ3oNPkmxC9zsfg9L8Bb6KkwKyTqNng7AsJpuRM1oh8UpkiyfkGLok5ePAMS4miPpXPw8oCKtqwrV";

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/dev-fund-status');
                if (res.ok) {
                    const data = await res.json();
                    setCurrent(data.balance);
                    setGoal(data.goal || 5.00);
                    setIsSyncing(data.isSyncing);
                    setHeight(data.height);
                }
            } catch (e) {
                console.error("Failed to fetch dev fund status", e);
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
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

    return (
        <>
            <div className="flex items-center">
                <button
                    onClick={() => setIsOpen(true)}
                    className="group relative flex items-center gap-4 bg-white dark:bg-zinc-900 text-black dark:text-white px-5 py-2 border-2 border-black dark:border-white overflow-hidden transition-all hover:border-monero-orange hover:translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-none dark:hover:shadow-none"
                    title="Click to Contribute"
                >
                    <div className="flex flex-col items-start leading-none gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">SUPPORT_THE_MISSION</span>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-gray-200 dark:bg-zinc-800 overflow-hidden border border-black dark:border-zinc-700">
                                <div
                                    className="h-full bg-monero-orange transition-all duration-1000"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-monero-orange">{Math.round(percent)}%</span>
                        </div>
                    </div>
                    <div className="p-1.5 bg-monero-orange text-white rounded-none group-hover:scale-110 transition-transform border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Heart size={14} className="fill-current animate-pulse" />
                    </div>
                </button>
            </div>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="TX_PROTOCOL: DONATION_HANDSHAKE">
                <div className="flex flex-col gap-6 relative">
                    <div className="absolute -top-10 -right-6 opacity-5 pointer-events-none">
                        <Zap size={120} className="text-monero-orange" />
                    </div>

                    <div className="bg-black text-[#00FF41] p-3 font-mono text-[10px] border-l-4 border-[#00FF41] animate-pulse">
                        <p className="flex items-center gap-2"><div className="w-2 h-2 bg-[#00FF41] rounded-full"></div> BROADCASTING_SUPPORT_REQUEST...</p>
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
                                <h3 className="font-mono font-black text-sm mb-2 dark:text-white uppercase tracking-tighter italic">Support The Architect</h3>
                                <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed font-mono">
                                    Contributing keeps GoXMR sovereign and tracker-free.
                                    <br /><br />
                                    <span className="text-monero-orange font-bold">Allocations:</span> Community projects, giveaways, node hosting, beers, and pizza.
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-zinc-800/30 p-2 border border-gray-100 dark:border-zinc-700">
                                <span className="block text-[8px] font-black text-gray-400 uppercase">Goal_Status</span>
                                <span className="text-xs font-mono font-bold dark:text-white">{current.toFixed(4)} / {goal} XMR</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800/30 p-2 border border-gray-100 dark:border-zinc-700">
                                <span className="block text-[8px] font-black text-gray-400 uppercase">Block_Height</span>
                                <span className="text-xs font-mono font-bold dark:text-white">{height || 'FETCHING...'}</span>
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
