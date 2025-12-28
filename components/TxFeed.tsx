import React, { useState, useEffect } from 'react';

const MOCK_TXS = [
    "tx:7b8d...f2a1",
    "tx:3c4e...a9d2",
    "tx:1f6a...e5c8",
    "tx:9d2b...c0f4",
    "tx:a5e1...d3b7",
    "tx:2c9f...b8a6",
    "tx:8d4b...1e92",
    "tx:5f0a...7c3d"
];

const SIGNALS = [
    "SIGNAL: OPTIMAL",
    "PEERS: 24",
    "SYNC: 100%",
    "MEMPOOL: OK",
    "MASK: ACTIVE"
];

export const TxFeed: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const isTx = Math.random() > 0.4;
            const newItem = isTx
                ? MOCK_TXS[Math.floor(Math.random() * MOCK_TXS.length)]
                : SIGNALS[Math.floor(Math.random() * SIGNALS.length)];

            setLogs(prev => [newItem, ...prev].slice(0, 3));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hidden xl:flex flex-col font-mono text-[9px] text-monero-orange/50 dark:text-monero-orange/40 gap-0.5 min-w-[120px] uppercase border-l border-monero-orange/20 pl-4 h-8 justify-center">
            {logs.map((log, i) => (
                <div key={`${log}-${i}`} className="animate-in fade-in slide-in-from-left-2 duration-500 overflow-hidden whitespace-nowrap italic tracking-tighter">
                    {log}
                </div>
            ))}
            {logs.length === 0 && <div className="animate-pulse">BOOTING_CORE_SYSTEM...</div>}
        </div>
    );
};
