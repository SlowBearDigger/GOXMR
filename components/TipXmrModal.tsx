import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, X, Coins } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { showToast } from './Toast';

interface TipXmrModalProps {
    username: string;
    address: string;
    accentColor?: string;
    onClose: () => void;
}

export const TipXmrModal: React.FC<TipXmrModalProps> = ({ username, address, accentColor, onClose }) => {
    const qrRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const AC = accentColor || '#F26822';

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        if (!qrRef.current || !address) return;
        const qr = new QRCodeStyling({
            width: 280, height: 280, type: 'svg',
            data: `monero:${address}`,
            dotsOptions: { color: AC, type: 'square' },
            backgroundOptions: { color: 'transparent' },
            cornersSquareOptions: { type: 'square', color: AC },
            cornersDotOptions: { type: 'square', color: AC },
        });
        qrRef.current.innerHTML = '';
        qr.append(qrRef.current);
    }, [address, AC]);

    const copy = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        showToast('Address copied', 'info', 1200);
    };

    const openalias = `${username.toLowerCase()}@goxmr.click`;

    return (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true">
            <div className="w-full max-w-md bg-white dark:bg-zinc-950 border-2 border-black dark:border-white" style={{ boxShadow: `10px 10px 0 0 ${AC}` }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4">
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white inline-flex items-center gap-2">
                        <Coins size={14} style={{ color: AC }} /> Tip @{username} in XMR
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-monero-orange hover:text-white" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="font-mono text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                        Send Monero directly. Non-custodial — funds go straight to the recipient's wallet. GOXMR never touches them.
                    </p>
                    <div className="flex justify-center">
                        <div className="p-3 bg-white border-4 border-black inline-block">
                            <div ref={qrRef} className="w-[280px] h-[280px]" />
                        </div>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">OpenAlias (paste in Cake / Feather / monerujo)</p>
                        <button
                            onClick={() => { navigator.clipboard.writeText(openalias); showToast('OpenAlias copied', 'info', 1200); }}
                            className="w-full p-2 border-2 border-black dark:border-white font-mono text-xs text-left hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors dark:text-white dark:bg-zinc-900 break-all"
                        >
                            {openalias}
                        </button>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Raw address</p>
                        <button
                            onClick={copy}
                            className="w-full p-2 border-2 border-black dark:border-white font-mono text-[10px] text-left hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors dark:text-white dark:bg-zinc-900 break-all flex items-start gap-2"
                        >
                            <span className="flex-1">{address}</span>
                            {copied ? <Check size={12} className="shrink-0 mt-0.5" /> : <Copy size={12} className="shrink-0 mt-0.5 opacity-60" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
