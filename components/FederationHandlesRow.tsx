import React from 'react';
import { Coins, Zap, AtSign, Globe } from 'lucide-react';

interface Props {
    username: string;
    hasNostr?: boolean;
    hasMastodon?: boolean;
    hasXmr?: boolean;
    mastodonHandle?: string | null;
}

export const FederationHandlesRow: React.FC<Props> = ({ username, hasNostr, hasMastodon, hasXmr, mastodonHandle }) => {
    const l = username.toLowerCase();
    const chips = [
        { key: 'oa',  on: !!hasXmr,    label: `${l}@goxmr.click`, sub: 'OpenAlias',  icon: <Coins size={10} />,    href: undefined },
        { key: 'nip', on: !!hasNostr,  label: `${l}@goxmr.click`, sub: 'NIP-05',     icon: <Zap size={10} />,      href: undefined },
        { key: 'mas', on: !!hasMastodon, label: mastodonHandle ? `@${mastodonHandle}` : `@${l}@goxmr.click`, sub: 'Mastodon', icon: <AtSign size={10} />, href: mastodonHandle ? `https://${mastodonHandle.split('@')[1]}/@${mastodonHandle.split('@')[0]}` : undefined },
        { key: 'tor', on: true, label: '5vtyieb7…onion', sub: 'Tor v3 mirror', icon: <Globe size={10} />, href: 'http://5vtyieb7przizt7rhl4ydeglinrjn5g2srx45i4dcbwve3pojcfmjzid.onion' },
    ];
    const visible = chips.filter(c => c.on);
    if (!visible.length) return null;

    return (
        <div className="max-w-3xl mx-auto mt-12 px-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-black/40 dark:text-white/40 text-center mb-3">Federated across</p>
            <div className="flex flex-wrap justify-center gap-2">
                {visible.map(c => {
                    const content = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-black/20 dark:border-white/20 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm hover:border-monero-orange transition-colors">
                            <span className="text-monero-orange">{c.icon}</span>
                            <span className="font-mono text-[10px] dark:text-white truncate max-w-[180px]">{c.label}</span>
                            <span className="font-mono text-[8px] uppercase tracking-widest text-gray-500 dark:text-gray-400">{c.sub}</span>
                        </span>
                    );
                    return c.href
                        ? <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer">{content}</a>
                        : <span key={c.key}>{content}</span>;
                })}
            </div>
        </div>
    );
};
