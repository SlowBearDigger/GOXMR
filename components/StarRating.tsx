import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
    value: number;       // 0–5, can be fractional
    size?: number;
    interactive?: boolean;
    onChange?: (v: number) => void;
    className?: string;
}

// #4.3: minimal star renderer. Non-interactive shows fractional stars via clipping;
// interactive renders 5 click targets.
export const StarRating: React.FC<StarRatingProps> = ({ value, size = 14, interactive, onChange, className = '' }) => {
    if (interactive) {
        return (
            <div className={`inline-flex items-center gap-0.5 ${className}`} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map(i => (
                    <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={value === i}
                        onClick={() => onChange?.(i)}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-monero-orange"
                        aria-label={`${i} star${i > 1 ? 's' : ''}`}
                    >
                        <Star
                            size={size}
                            className={i <= value ? 'text-monero-orange' : 'text-gray-300 dark:text-zinc-600'}
                            fill={i <= value ? 'currentColor' : 'none'}
                        />
                    </button>
                ))}
            </div>
        );
    }
    const pct = Math.max(0, Math.min(1, value / 5)) * 100;
    return (
        <div className={`relative inline-flex ${className}`} aria-label={`${value.toFixed(1)} out of 5`}>
            <div className="flex">
                {[0, 1, 2, 3, 4].map(i => (
                    <Star key={i} size={size} className="text-gray-300 dark:text-zinc-600" />
                ))}
            </div>
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
                <div className="flex">
                    {[0, 1, 2, 3, 4].map(i => (
                        <Star key={i} size={size} className="text-monero-orange" fill="currentColor" />
                    ))}
                </div>
            </div>
        </div>
    );
};
