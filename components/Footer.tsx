import React from 'react';

export const Footer: React.FC = () => {
    return (
        <>
            <a
                href="https://x.com/SlowBearDigger"
                target="_blank"
                rel="noreferrer"
                className="fixed bottom-12 right-4 z-50 font-mono text-[10px] font-bold text-gray-400 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-auto bg-white/80 p-2 border border-black"
            >
                Made by @SlowBearDigger
            </a>

            <div className="fixed bottom-0 left-0 w-full bg-monero-orange text-black font-mono text-xs py-1 overflow-hidden border-t-2 border-black z-40">
                <div className="whitespace-nowrap animate-marquee flex gap-8">
                    {Array(10).fill("GOXMR IS LIVE /// CLAIM YOUR SOVEREIGN HANDLE /// ZERO TRACKING ///").map((text, i) => (
                        <span key={i} className="font-bold">{text}</span>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    display: flex;
                    animation: marquee 20s linear infinite;
                }
            `}</style>
        </>
    );
};
