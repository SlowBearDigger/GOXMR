import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, MessageSquare, ShoppingBag, Mail, Coins, Image as ImageIcon, ExternalLink, ArrowRight, AlertTriangle } from 'lucide-react';

interface NotifSummary {
    store_orders: number;
    unread_messages: number;
    deadman_active: number;
    pgp_dms_unread: number;
}

interface OverviewProps {
    username: string;
    profileViews: number;
    notifications: NotifSummary | null;
    moneroBalance?: number;
    moneroSyncing?: boolean;
    moneroConnected?: boolean;
}

interface QuickJump { id: string; label: string; description: string; icon: React.ReactNode }
const QUICK_JUMPS: QuickJump[] = [
    { id: 'identity',      label: 'Identity',       description: 'Display name, bio, avatar, banner', icon: <Eye size={14} /> },
    { id: 'profile-links', label: 'Links',          description: 'Add or reorder your links',         icon: <ExternalLink size={14} /> },
    { id: 'gallery',       label: 'Gallery',        description: 'Showcase images on your profile',   icon: <ImageIcon size={14} /> },
    { id: 'treasury',      label: 'Wallets',        description: 'Crypto addresses + OpenAlias',      icon: <Coins size={14} /> },
    { id: 'store',         label: 'Store',          description: 'Products and orders',               icon: <ShoppingBag size={14} /> },
    { id: 'pgp-dms',       label: 'Direct messages', description: 'End-to-end PGP chat',              icon: <MessageSquare size={14} /> },
];

export const DashboardOverview: React.FC<OverviewProps> = ({ username, profileViews, notifications, moneroBalance, moneroSyncing, moneroConnected }) => {
    const navigate = useNavigate();
    const lname = username?.toLowerCase() || '';

    const cards = [
        { key: 'views',   label: 'Profile views',    value: (profileViews || 0).toLocaleString(),                      hint: 'All-time anonymous count' },
        { key: 'orders',  label: 'Pending orders',   value: String(notifications?.store_orders ?? 0),                   hint: notifications?.store_orders ? 'Tap Store to triage' : 'No queue' },
        { key: 'msgs',    label: 'Unread contacts',  value: String(notifications?.unread_messages ?? 0),                hint: 'Encrypted contact form' },
        { key: 'pgp',     label: 'Unread PGP DMs',   value: String(notifications?.pgp_dms_unread ?? 0),                 hint: 'Peer-to-peer chat' },
    ];

    const scrollToId = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="space-y-5">
            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Welcome back</p>
                        <h2 className="font-mono font-black uppercase text-2xl tracking-tighter dark:text-white">@{username}</h2>
                    </div>
                    {username && (
                        <a
                            href={`https://${lname}.goxmr.click`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] uppercase tracking-widest font-bold px-3 py-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors inline-flex items-center gap-1.5 shrink-0"
                        >
                            View live profile <ExternalLink size={11} />
                        </a>
                    )}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {cards.map(c => (
                        <div key={c.key} className="border border-black/15 dark:border-white/15 bg-gray-50 dark:bg-zinc-950 p-3">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500 dark:text-gray-400">{c.label}</p>
                            <p className="font-mono font-black text-2xl dark:text-white mt-1 leading-none">{c.value}</p>
                            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">{c.hint}</p>
                        </div>
                    ))}
                </div>
                {typeof moneroBalance === 'number' && (
                    <div className="mt-3 border border-black/15 dark:border-white/15 p-3 flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-zinc-950">
                        <div>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500 dark:text-gray-400">Dev fund balance</p>
                            <p className="font-mono font-black text-xl dark:text-white mt-1">{moneroBalance.toFixed(4)} XMR</p>
                        </div>
                        <span className={`font-mono text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1 ${moneroConnected ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {moneroConnected ? '● Daemon connected' : moneroSyncing ? '● Syncing' : <><AlertTriangle size={10} /> No daemon</>}
                        </span>
                    </div>
                )}
            </div>

            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono font-black uppercase text-xs tracking-wider dark:text-white">Jump to</h3>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">scroll shortcuts</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {QUICK_JUMPS.map(q => (
                        <button
                            key={q.id}
                            onClick={() => scrollToId(q.id)}
                            className="text-left border-2 border-black/15 dark:border-white/15 p-3 hover:border-monero-orange hover:bg-monero-orange/5 transition-colors group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-wider dark:text-white">
                                    <span className="text-monero-orange">{q.icon}</span>
                                    {q.label}
                                </span>
                                <ArrowRight size={11} className="text-gray-400 group-hover:text-monero-orange group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{q.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
