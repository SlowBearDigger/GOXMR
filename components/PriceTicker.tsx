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
        <div className="font-mono text-xs border border-black px-2 py-1 rounded-sm bg-gray-50 flex items-center gap-2 min-w-[120px] justify-center">
            <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
            {price ? (
                <span className="font-bold">XMR: ${price}</span>
            ) : (
                <span className="text-gray-500">LOADING...</span>
            )}
        </div>
    );
};
