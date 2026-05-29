import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Scale, AlertTriangle } from 'lucide-react';
import { TERMS_SECTIONS } from '../utils/termsCopy';

export const TermsPage: React.FC = () => {
    const nav = useNavigate();
    return (
        <div className="min-h-screen pt-24 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <button onClick={() => nav(-1)} className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-6">
                    <ArrowLeft size={12} /> Back
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <Scale size={22} className="text-monero-orange" />
                    <h1 className="font-mono font-black uppercase text-2xl tracking-tighter dark:text-white">Terms of Use</h1>
                </div>
                <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-8">
                    Plain-language version. The published HTML is canonical.
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 p-4 mb-8 flex gap-3">
                    <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <p className="font-mono text-xs text-yellow-900 dark:text-yellow-200 leading-relaxed">
                        <span className="font-black">Read this once. Then move on.</span> If you do not agree to any part, do not register, do not buy, do not sell, do not publish — leave the site. By using the platform you accept everything below.
                    </p>
                </div>

                <div className="space-y-6">
                    {TERMS_SECTIONS.map(s => (
                        <section key={s.id} id={s.id}>
                            <h2 className="font-mono font-black text-sm uppercase tracking-tight dark:text-white mb-2 flex items-center gap-2">
                                <ShieldAlert size={14} className="text-monero-orange" /> {s.title}
                            </h2>
                            <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                {s.body}
                            </p>
                        </section>
                    ))}
                </div>

                <div className="mt-12 pt-6 border-t-2 border-black dark:border-white">
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Reports: abuse@goxmr.click · Source: github (MIT) · Not a money services business.
                    </p>
                </div>
            </div>
        </div>
    );
};
