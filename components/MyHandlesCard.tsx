import React, { useState } from 'react';
import { Copy, Check, Globe, Coins, Link as LinkIcon, ExternalLink, Shield } from 'lucide-react';

interface MyHandlesCardProps {
    username: string;
    hasXmrWallet?: boolean;
}

interface HandleRow {
    icon: React.ReactNode;
    label: string;
    sub: string;
    value: string;
    href?: string;
    requiresXmr?: boolean;
}

export const MyHandlesCard: React.FC<MyHandlesCardProps> = ({ username, hasXmrWallet }) => {
    const [copied, setCopied] = useState<string | null>(null);
    if (!username) return null;
    const lname = username.toLowerCase();

    const rows: HandleRow[] = [
        {
            icon: <Globe size={14} />,
            label: 'Personal subdomain',
            sub: 'HTTPS — share this on socials, business cards, anywhere',
            value: `https://${lname}.goxmr.click`,
            href: `https://${lname}.goxmr.click`,
        },
        {
            icon: <Coins size={14} />,
            label: 'OpenAlias (for wallets)',
            sub: hasXmrWallet
                ? 'Pastes into Cake, Feather, monerujo, MyMonero — DNSSEC-signed'
                : 'Add an XMR wallet in 03_TREASURY to activate this handle',
            value: `${lname}@goxmr.click`,
            requiresXmr: true,
        },
        {
            icon: <LinkIcon size={14} />,
            label: 'Classic profile URL',
            sub: 'Path-based, useful for inline links and shorter QR codes',
            value: `https://goxmr.click/${lname}`,
            href: `https://goxmr.click/${lname}`,
        },
    ];

    const doCopy = async (v: string) => {
        try {
            await navigator.clipboard.writeText(v);
            setCopied(v);
            setTimeout(() => setCopied((c) => (c === v ? null : c)), 2000);
        } catch {
            // older Firefox / restricted contexts — silently degrade
        }
    };

    return (
        <div id="handles" className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-mono font-black text-sm uppercase tracking-tight dark:text-white flex items-center gap-2">
                    <Shield size={14} className="text-monero-orange" />
                    Your Handles
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Sovereign · DNSSEC
                </span>
            </div>
            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-4">
                One identity, three shapes — pick whichever fits the surface.
            </p>

            <div className="space-y-3">
                {rows.map((r) => {
                    const isCopied = copied === r.value;
                    const dimmed = r.requiresXmr && !hasXmrWallet;
                    return (
                        <div
                            key={r.label}
                            className={`border-2 ${dimmed ? 'border-dashed border-gray-300 dark:border-zinc-700' : 'border-black dark:border-white'} bg-gray-50 dark:bg-zinc-950 p-3`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`shrink-0 p-1.5 border ${dimmed ? 'border-gray-300 dark:border-zinc-700 text-gray-400' : 'border-monero-orange/40 text-monero-orange bg-monero-orange/10'}`}>
                                    {r.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`font-mono text-[10px] uppercase tracking-widest font-black ${dimmed ? 'text-gray-400' : 'dark:text-white'}`}>
                                            {r.label}
                                        </span>
                                    </div>
                                    <p className={`font-mono text-[10px] ${dimmed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'} mb-2`}>
                                        {r.sub}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code className={`font-mono text-[11px] truncate flex-1 ${dimmed ? 'text-gray-400 dark:text-gray-500' : 'dark:text-white'}`}>
                                            {r.value}
                                        </code>
                                        {!dimmed && (
                                            <>
                                                <button
                                                    onClick={() => doCopy(r.value)}
                                                    className="shrink-0 p-1.5 border border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors"
                                                    title="Copy"
                                                    aria-label={`Copy ${r.label}`}
                                                >
                                                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                                {r.href && (
                                                    <a
                                                        href={r.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="shrink-0 p-1.5 border border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors"
                                                        title="Open"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </a>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
