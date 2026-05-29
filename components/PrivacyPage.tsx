import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, EyeOff, Lock } from 'lucide-react';
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from '../utils/privacyCopy';

export const PrivacyPage: React.FC = () => {
    const nav = useNavigate();
    return (
        <div className="min-h-screen pt-24 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => nav(-1)}
                    className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-6"
                >
                    <ArrowLeft size={12} /> Back
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <EyeOff size={22} className="text-monero-orange" />
                    <h1 className="font-mono font-black uppercase text-2xl tracking-tighter dark:text-white">
                        Privacy & Data
                    </h1>
                </div>
                <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-8">
                    Effective: {PRIVACY_VERSION} · Plain language · GDPR/ePrivacy aligned
                </p>

                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 p-4 mb-8 flex gap-3">
                    <ShieldCheck size={18} className="text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
                    <p className="font-mono text-xs text-green-900 dark:text-green-200 leading-relaxed">
                        <span className="font-black">No tracking. No analytics. No third-party scripts.</span>
                        {' '}The data we hold about you is what you typed in.
                    </p>
                </div>

                <nav className="bg-gray-50 dark:bg-zinc-900/40 border border-black/10 dark:border-white/10 p-3 mb-8">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500 mb-2">Jump to</p>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {PRIVACY_SECTIONS.map(s => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} className="font-mono text-[11px] text-gray-700 dark:text-gray-300 hover:text-monero-orange transition-colors">
                                    {s.heading}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="space-y-8">
                    {PRIVACY_SECTIONS.map(s => (
                        <section key={s.id} id={s.id} className="scroll-mt-24">
                            <h2 className="font-mono font-black text-sm uppercase tracking-tight dark:text-white mb-2 flex items-center gap-2">
                                <Lock size={14} className="text-monero-orange" /> {s.heading}
                            </h2>
                            <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                {s.body}
                            </p>
                            {s.bullets && (
                                <ul className="mt-3 space-y-1.5 list-none">
                                    {s.bullets.map((b, i) => (
                                        <li
                                            key={i}
                                            className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-monero-orange"
                                        >
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>

                <div className="mt-12 pt-6 border-t-2 border-black dark:border-white">
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Reports: abuse@goxmr.click · Source: github (MIT) · Auditable in source control · Not a money services business.
                    </p>
                </div>
            </div>
        </div>
    );
};
