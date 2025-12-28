import React from 'react';
import { Terminal, ArrowUpRight, Shield } from 'lucide-react';

const FOOTER_LINKS = [
    { name: 'SlowBearDigger', url: 'https://slowbeardigger.dev/' },
    { name: 'Telegram', url: 'https://t.me/SlowBearDigger' },
    { name: 'Monerica', url: 'https://monerica.com/freelancers/software-developers/slowbeardigger' },
    { name: 'Simplex', url: 'https://smp11.simplex.im/a#or5wpSRvYq4UrM1ASZ0qgDIiGON8lcEQXitc1gREJys' },
    { name: 'XMRChat', url: 'https://goxmr.click/xmrchat.com/slowbeardigger' },
    { name: 'GitHub', url: 'https://github.com/SlowBearDigger/' },
    { name: 'XMR Bazaar', url: 'https://xmrbazaar.com/user/SlowBearDigger/' },
    { name: 'X (Twitter)', url: 'https://x.com/SlowBearDigger' },
];

export const Footer: React.FC = () => {
    return (
        <footer className="w-full mt-auto border-t-2 border-black dark:border-white bg-white dark:bg-black overflow-hidden select-none">
            {/* Only Marquee: Forward Direction */}
            <div className="border-b-2 border-black dark:border-white py-4 bg-monero-orange text-white overflow-hidden group">
                <div className="flex animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
                    {[...FOOTER_LINKS, ...FOOTER_LINKS, ...FOOTER_LINKS].map((link, i) => (
                        <a
                            key={`fwd-${i}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mx-8 font-mono font-black uppercase text-xs hover:text-black transition-colors"
                        >
                            <Terminal size={12} />
                            {link.name}
                            <ArrowUpRight size={10} className="opacity-50" />
                        </a>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-marquee {
                    animation: marquee 40s linear infinite;
                }
            `}</style>
        </footer>
    );
};
