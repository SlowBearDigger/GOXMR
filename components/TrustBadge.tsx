import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp, Key, Lock, Zap, Clock, ShoppingCart, Star } from 'lucide-react';

interface TrustData {
    score: number;
    badges: string[];
    details: {
        hasPgp: boolean;
        hasWebauthn: boolean;
        hasRecovery: boolean;
        isPremium: boolean;
        accountAgeDays: number;
        completedSales: number;
        avgRating: number;
    };
}

const BADGE_CONFIG: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
    PGP_VERIFIED: { label: 'PGP Verified', icon: Lock, color: 'text-green-600' },
    HARDWARE_KEY: { label: 'Hardware Key', icon: Key, color: 'text-blue-600' },
    RECOVERY_SET: { label: 'Recovery Set', icon: Shield, color: 'text-purple-600' },
    PREMIUM: { label: 'Premium', icon: Zap, color: 'text-monero-orange' },
    VETERAN: { label: 'Veteran', icon: Clock, color: 'text-yellow-600' },
    MERCHANT: { label: 'Merchant', icon: ShoppingCart, color: 'text-emerald-600' },
};

export const TrustBadge: React.FC<{ username: string; accentColor?: string }> = ({ username, accentColor }) => {
    const [data, setData] = useState<TrustData | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        fetch(`/api/user/${username}/trust`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setData(d))
            .catch(() => {});
    }, [username]);

    if (!data || data.score === 0) return null;

    const AC = accentColor || '#F26822';
    const scoreColor = data.score >= 60 ? 'text-green-600' : data.score >= 30 ? 'text-yellow-600' : 'text-gray-500';

    return (
        <div className="inline-block">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 border-2 border-black px-2 py-1 bg-white hover:bg-gray-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title={`Trust Score: ${data.score}/100`}
            >
                <Shield size={14} style={{ color: AC }} />
                <span className={`font-mono font-black text-xs ${scoreColor}`}>{data.score}</span>
                {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            {expanded && (
                <div className="absolute mt-1 z-50 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 w-56 animate-scale-in">
                    <div className="font-mono text-[10px] font-bold uppercase text-gray-500 mb-2">Trust Score</div>

                    {/* Score bar */}
                    <div className="h-2 w-full bg-gray-100 border border-gray-200 mb-3">
                        <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${data.score}%`, backgroundColor: AC }}
                        />
                    </div>

                    {/* Badges */}
                    <div className="space-y-1.5">
                        {data.badges.map(badge => {
                            const config = BADGE_CONFIG[badge];
                            if (!config) return null;
                            const Icon = config.icon;
                            return (
                                <div key={badge} className="flex items-center gap-2">
                                    <Icon size={12} className={config.color} />
                                    <span className="font-mono text-[10px] font-bold">{config.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Details */}
                    <div className="mt-2 pt-2 border-t border-gray-200 font-mono text-[9px] text-gray-400 space-y-0.5">
                        <div>Account age: {data.details.accountAgeDays} days</div>
                        {data.details.completedSales > 0 && <div>Sales: {data.details.completedSales} completed</div>}
                        {data.details.avgRating > 0 && (
                            <div className="flex items-center gap-1">
                                Rating: {data.details.avgRating}/5 <Star size={8} className="text-yellow-500" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
