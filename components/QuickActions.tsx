import React from 'react';
import { Coins, Mail, Share2, ShoppingBag } from 'lucide-react';

interface QuickActionsProps {
    onTip?: () => void;
    onContact?: () => void;
    onShare?: () => void;
    onStore?: () => void;
    hasXmr?: boolean;
    hasPgp?: boolean;
    hasStore?: boolean;
    accentColor?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onTip, onContact, onShare, onStore, hasXmr, hasPgp, hasStore, accentColor }) => {
    const AC = accentColor || '#F26822';
    const actions = [
        { key: 'tip',     label: 'Tip XMR', icon: <Coins size={14} />,      onClick: onTip,     enabled: !!hasXmr   && !!onTip,     primary: true },
        { key: 'contact', label: 'Contact', icon: <Mail size={14} />,       onClick: onContact, enabled: !!hasPgp   && !!onContact, primary: false },
        { key: 'share',   label: 'Share',   icon: <Share2 size={14} />,     onClick: onShare,   enabled: !!onShare,                  primary: false },
        { key: 'store',   label: 'Store',   icon: <ShoppingBag size={14} />, onClick: onStore,   enabled: !!hasStore && !!onStore,   primary: false },
    ];
    const visible = actions.filter(a => a.enabled);
    if (!visible.length) return null;

    return (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 mb-2">
            {visible.map((a) => (
                <button
                    key={a.key}
                    onClick={a.onClick}
                    className={`font-mono text-xs uppercase tracking-widest font-black px-4 py-3 border-2 border-black transition-all inline-flex items-center gap-2 shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-none ${a.primary ? 'text-white' : 'bg-white text-black hover-bg-accent hover:text-white hover-border-accent'}`}
                    style={a.primary ? { backgroundColor: AC, color: '#fff', boxShadow: `3px 3px 0 0 ${AC === '#F26822' ? '#000' : 'rgba(0,0,0,1)'}` } : undefined}
                >
                    {a.icon}
                    <span>{a.label}</span>
                </button>
            ))}
        </div>
    );
};
