import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, ArrowUpRight, Shield, Scale, Globe, EyeOff, Activity } from 'lucide-react';

// Tor hidden service mirror. Keeps the site reachable if DNS is censored or
// the user wants origin-server anonymity. Address is stable across reboots
// (Tor v3 keys live in /var/lib/tor/goxmr/).
const ONION_URL = 'http://5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion';

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

            {/* Legal / opsec strip — small, persistent, never animated */}
            <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span>GOXMR · MIT licensed · Not a money services business</span>
                <div className="flex items-center gap-3 flex-wrap">
                    <a
                        href={ONION_URL}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-monero-orange transition-colors"
                        title="Tor v3 mirror — reachable from Tor Browser"
                    >
                        <Globe size={10} /> .onion mirror
                    </a>
                    <Link to="/privacy" className="inline-flex items-center gap-1 hover:text-monero-orange transition-colors">
                        <EyeOff size={10} /> Privacy
                    </Link>
                    <Link to="/status" className="inline-flex items-center gap-1 hover:text-monero-orange transition-colors">
                        <Activity size={10} /> Status
                    </Link>
                    <Link to="/terms" className="inline-flex items-center gap-1 hover:text-monero-orange transition-colors">
                        <Scale size={10} /> Terms
                    </Link>
                    <a href="mailto:abuse@goxmr.click" className="inline-flex items-center gap-1 hover:text-monero-orange transition-colors">
                        <Shield size={10} /> Abuse
                    </a>
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
