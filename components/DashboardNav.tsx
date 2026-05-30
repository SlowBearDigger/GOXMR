import React from 'react';
import { Terminal, Save, Loader2, Check, ExternalLink } from 'lucide-react';

interface NotificationCounts {
    store_orders: number;
    unread_messages: number;
    deadman_active: number;
    pgp_dms_unread?: number;
}

const NOTIFICATION_MAP: Record<string, keyof NotificationCounts> = {
    store: 'store_orders',
    messages: 'unread_messages',
    'pgp-dms': 'pgp_dms_unread',
};

interface DashboardNavProps {
    activeSection: string;
    isDeploying: boolean;
    onDeploy: () => void;
    isSuccess: boolean;
    notifications?: NotificationCounts;
    username?: string;
}

// Visual grouping: dividers split the long nav into 4 mental zones so the user
// always knows what kind of thing they're about to land on.
interface NavGroup { title: string; items: { id: string; label: string }[] }
const NAV_GROUPS: NavGroup[] = [
    {
        title: 'Home',
        items: [
            { id: 'overview', label: 'Overview' },
            { id: 'handles', label: 'Your handles' },
        ],
    },
    {
        title: 'Brand',
        items: [
            { id: 'identity', label: 'Identity' },
            { id: 'profile-links', label: 'Links' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'design', label: 'Design' },
        ],
    },
    {
        title: 'Commerce',
        items: [
            { id: 'treasury', label: 'Wallets' },
            { id: 'store', label: 'Store' },
            { id: 'assets', label: 'Drops & Signals' },
            { id: 'qr-foundry', label: 'QR foundry' },
        ],
    },
    {
        title: 'Comms',
        items: [
            { id: 'messages', label: 'Contact inbox' },
            { id: 'pgp-dms', label: 'PGP direct msgs' },
        ],
    },
    {
        title: 'Account',
        items: [
            { id: 'settings', label: 'Security & ops' },
        ],
    },
];

export const DashboardNav: React.FC<DashboardNavProps> = ({ activeSection, isDeploying, onDeploy, isSuccess: deployed, notifications, username }) => {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (!element) return;
        const offset = 100;
        const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    };

    return (
        <div className="hidden lg:block sticky top-32 w-full self-start">
            <div className="border border-black dark:border-white bg-white dark:bg-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-colors">
                <div className="flex items-center gap-2 mb-4 border-b-2 border-dashed border-gray-200 dark:border-zinc-800 pb-2">
                    <Terminal size={14} className="dark:text-white" />
                    <h3 className="font-mono font-bold text-[11px] uppercase dark:text-white tracking-wider">Dashboard</h3>
                </div>

                <div className="space-y-3">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.title}>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 px-2 mb-1">
                                {group.title}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map(item => {
                                    const isActive = activeSection === item.id;
                                    const notifKey = NOTIFICATION_MAP[item.id];
                                    const badgeCount = notifKey && notifications ? notifications[notifKey] || 0 : 0;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => scrollToSection(item.id)}
                                            className={`w-full text-left font-mono text-[11px] py-1.5 px-2 flex justify-between items-center group transition-colors ${isActive
                                                ? 'bg-black dark:bg-white text-white dark:text-black'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className={isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}>{'>'}</span>
                                                {item.label}
                                            </span>
                                            {badgeCount > 0 && (
                                                <span className="bg-monero-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badgeCount}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 pt-3 border-t-2 border-dashed border-gray-200 dark:border-zinc-800 space-y-2">
                    {username && (
                        <a
                            href={`https://${username.toLowerCase()}.goxmr.click`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full font-mono text-[10px] uppercase tracking-widest font-bold px-3 py-2 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                            Preview <ExternalLink size={11} />
                        </a>
                    )}
                    <button
                        onClick={onDeploy}
                        disabled={isDeploying}
                        className={`w-full border-2 border-black dark:border-white p-2.5 font-mono text-[11px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] active:translate-y-[2px] active:shadow-none ${isDeploying
                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-gray-300 dark:border-zinc-700 shadow-none translate-y-[2px]'
                            : deployed
                                ? 'bg-green-500 text-white border-green-700 dark:border-green-400'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors'
                            }`}
                    >
                        {isDeploying ? <><Loader2 size={12} className="animate-spin" /> Deploying...</>
                            : deployed ? <><Check size={12} /> Synced</>
                            : <><Save size={12} /> Deploy changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
