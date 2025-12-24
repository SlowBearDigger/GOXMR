import React, { useState, useEffect } from 'react';
import { Copy, Check, Info, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';

export const DonationGoal: React.FC = () => {
    const [current, setCurrent] = useState(3.44);
    const [goal, setGoal] = useState(5.00);
    const [isSyncing, setIsSyncing] = useState(false);
    const [height, setHeight] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

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

    return (
        <>
            <div
                onClick={() => setIsOpen(true)}
                className="font-mono text-xs border border-black px-2 py-1 rounded-sm bg-gray-50 flex flex-col items-center justify-center relative min-w-[140px] overflow-hidden group cursor-pointer hover:border-monero-orange transition-colors"
                title="Click to Contribute"
            >
                <div
                    className="absolute left-0 top-0 bottom-0 bg-monero-orange/20 transition-all duration-1000"
                    style={{ width: `${percent}%` }}
                ></div>
                <div className="relative z-10 font-bold flex gap-2">
                    <span>DEV_FUND</span>
                    <span>{Math.round(percent)}%</span>
                </div>
                <div className="absolute inset-0 bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 font-bold">
                    {isSyncing ? "SYNCING..." : `${current.toFixed(4)} / ${goal} XMR`}
                </div>
            </div>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="DEV_FUND_CONTRIBUTION">
                <div className="flex flex-col gap-4">
                    <div className="bg-gray-50 border-l-4 border-monero-orange p-3 text-xs">
                        <p className="font-bold uppercase mb-1">Support The Architect</p>
                        <p className="text-gray-600">Funds are used for domain renewals, server hosting, and caffeine. Helps keep GoXMR sovereign and tracker-free.</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Monero Address (Primary)</label>
                        <div
                            className="w-full bg-gray-100 border-2 border-dashed border-gray-300 p-3 text-[10px] font-mono break-all cursor-pointer hover:bg-white hover:border-black transition-colors relative group"
                            onClick={handleCopy}
                        >
                            {WALLET_ADDRESS}
                            <div className="absolute top-2 right-2 text-gray-400 group-hover:text-black">
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </div>
                        </div>
                        {copied && <span className="text-[10px] text-green-600 font-bold uppercase animate-pulse">Address Copied to Clipboard</span>}
                    </div>

                    <div className="mt-2 text-[9px] text-gray-400 font-mono border-t border-gray-200 pt-2">
                        <div className="flex items-center gap-1 mb-1 font-bold uppercase text-gray-500">
                            <Info size={10} /> Tracking Logic {isSyncing ? '(SYNCING...)' : '(ONLINE)'}
                        </div>
                        <p className="leading-tight mb-2">
                            Progress is tracked using a <strong>Private View Key</strong> scanner.
                            The system queries the blockchain for incoming TXs to verify the goal status without exposing sender data.
                        </p>
                        <div className="flex justify-between border-t border-gray-100 pt-1">
                            <span>Height Scanned: {height}</span>
                            <span>Node: {isSyncing ? <RefreshCw className="inline animate-spin" size={10} /> : 'Synced'}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full bg-black text-white py-3 uppercase font-bold hover:bg-monero-orange transition-colors"
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </>
    );
};
