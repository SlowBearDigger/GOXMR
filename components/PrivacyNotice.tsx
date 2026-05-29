import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X, EyeOff } from 'lucide-react';
import { PRIVACY_VERSION } from '../utils/privacyCopy';

const LS_KEY = 'goxmr_privacy_ack';

export const PrivacyNotice: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const ack = localStorage.getItem(LS_KEY);
            if (ack !== PRIVACY_VERSION) setVisible(true);
        } catch {
            setVisible(true);
        }
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(LS_KEY, PRIVACY_VERSION); } catch {}
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="region"
            aria-label="Privacy transparency notice"
            className="fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pointer-events-none"
        >
            <div className="pointer-events-auto mx-auto max-w-4xl bg-white dark:bg-zinc-950 border-2 border-black dark:border-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,1)] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="hidden sm:block shrink-0 p-2 bg-monero-orange/10 border border-monero-orange/40">
                            <ShieldCheck size={18} className="text-monero-orange" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-monero-orange flex items-center gap-1.5">
                                <EyeOff size={11} className="sm:hidden" /> Transparency notice
                            </p>
                            <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed mt-1.5">
                                <span className="font-bold text-black dark:text-white">No analytics, no trackers, no third-party scripts, no advertising cookies, no raw IP logs.</span>{' '}
                                What we store is what you put in your profile.{' '}
                                Auth JWT in localStorage is functional only. Full disclosure on the{' '}
                                <Link to="/privacy" className="underline decoration-monero-orange decoration-2 underline-offset-2 hover:text-monero-orange">
                                    Privacy &amp; Data page
                                </Link>.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            to="/privacy"
                            className="font-mono text-[10px] uppercase tracking-wider font-bold px-3 py-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors"
                        >
                            Read details
                        </Link>
                        <button
                            onClick={dismiss}
                            className="font-mono text-[10px] uppercase tracking-wider font-bold px-3 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors inline-flex items-center gap-1.5"
                        >
                            <X size={12} /> Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
