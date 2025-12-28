import React, { useState, useEffect } from 'react';

export const PriceTicker: React.FC = () => {
    const [price, setPrice] = useState<number | null>(null);
    const [error, setError] = useState(false);

    const fetchPrice = async () => {
        try {
            const res = await fetch('/api/price/xmr');
            const data = await res.json();
            if (data.monero && data.monero.usd) {
                setPrice(data.monero.usd);
                setError(false);
            }
        } catch (e) {
            console.error('Failed to fetch XMR price');
            setError(true);
        }
    };

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative group overflow-hidden border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all hover:translate-y-1 hover:shadow-none min-w-[140px]">
            {/* Ticker Header / Status Bar */}
            <div className={`flex items-center justify-between px-2 py-0.5 border-b border-black dark:border-white ${error ? 'bg-red-600 text-white' : 'bg-black dark:bg-white text-white dark:text-black'}`}>
                <span className="font-mono text-[8px] font-bold tracking-widest uppercase flex items-center gap-1">
                    <span className={`w-1 h-1 rounded-full ${error ? 'bg-white' : 'bg-monero-orange animate-pulse'}`}></span>
                    {error ? 'SYST_ERR' : 'LIVE_FEED'}
                </span>
                <span className="font-mono text-[8px] opacity-70">XMR/USD</span>
            </div>

            {/* Price Display */}
            <div className="flex flex-col items-center justify-center py-1.5 px-3 relative">
                {/* Decorative Brackets */}
                <div className="absolute top-1 left-1 w-1 h-1 border-t border-l border-black/20 dark:border-white/20"></div>
                <div className="absolute bottom-1 right-1 w-1 h-1 border-b border-r border-black/20 dark:border-white/20"></div>

                {price ? (
                    <div className="flex flex-col items-center">
                        <span className="font-mono text-xs font-black tracking-tighter text-monero-orange">
                            $ {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                ) : (
                    <span className="font-mono text-[9px] text-gray-400 dark:text-zinc-500 animate-pulse">CONNECTING...</span>
                )}
            </div>

            {/* Subtle Scanline Effect Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
        </div>
    );
};
