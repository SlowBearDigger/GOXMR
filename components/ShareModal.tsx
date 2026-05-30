import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, X, Globe, Link as LinkIcon, AtSign, Download } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { showToast } from './Toast';

interface ShareModalProps {
    username: string;
    onClose: () => void;
}

const HANDLES = (u: string) => {
    const l = u.toLowerCase();
    return [
        { id: 'subdomain', label: 'Personal subdomain', value: `https://${l}.goxmr.click`, icon: <Globe size={12} />, hint: 'Share this everywhere' },
        { id: 'openalias', label: 'OpenAlias (wallets)', value: `${l}@goxmr.click`, icon: <AtSign size={12} />, hint: 'Cake, Feather, monerujo' },
        { id: 'classic', label: 'Classic path URL', value: `https://goxmr.click/${l}`, icon: <LinkIcon size={12} />, hint: 'Short, inline-friendly' },
    ];
};

export const ShareModal: React.FC<ShareModalProps> = ({ username, onClose }) => {
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState('subdomain');
    const qrRef = useRef<HTMLDivElement>(null);
    const qrInstance = useRef<QRCodeStyling | null>(null);

    const handles = HANDLES(username);
    const selected = handles.find(h => h.id === selectedId) || handles[0];

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    useEffect(() => {
        if (!qrRef.current) return;
        const qr = new QRCodeStyling({
            width: 220, height: 220, type: 'svg',
            data: selected.value,
            dotsOptions: { color: '#000', type: 'square' },
            backgroundOptions: { color: 'transparent' },
            cornersSquareOptions: { type: 'square', color: '#F26822' },
            cornersDotOptions: { type: 'square', color: '#F26822' },
        });
        qrRef.current.innerHTML = '';
        qr.append(qrRef.current);
        qrInstance.current = qr;
    }, [selected.value]);

    const copy = (v: string, id: string) => {
        navigator.clipboard.writeText(v);
        setCopied(id);
        setTimeout(() => setCopied(c => c === id ? null : c), 1800);
        showToast('Copied', 'info', 1200);
    };

    const downloadQr = () => {
        qrInstance.current?.download({ name: `goxmr-${username.toLowerCase()}-${selectedId}`, extension: 'png' });
    };

    const overlay = (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto" onClick={onClose} role="dialog" aria-modal="true">
            <div className="w-full max-w-xl bg-white dark:bg-zinc-950 border-2 border-black dark:border-white shadow-[10px_10px_0_0_rgba(242,104,34,1)]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4">
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white">Share @{username}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-monero-orange hover:text-white" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="flex flex-col items-center">
                            <div className="p-3 bg-white border-2 border-black">
                                <div ref={qrRef} className="w-[220px] h-[220px]" />
                            </div>
                            <button onClick={downloadQr} className="mt-2 font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-monero-orange">
                                <Download size={11} /> Save QR
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {handles.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => setSelectedId(h.id)}
                                    className={`w-full text-left border-2 p-2 transition-colors ${selectedId === h.id ? 'border-monero-orange bg-monero-orange/5' : 'border-black/20 dark:border-white/20 hover:border-monero-orange/60'}`}
                                >
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-monero-orange">{h.icon}</span>
                                        <span className="font-mono text-[10px] uppercase tracking-widest font-black dark:text-white">{h.label}</span>
                                    </div>
                                    <code className="font-mono text-[11px] dark:text-white break-all">{h.value}</code>
                                    <p className="font-mono text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">{h.hint}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
                        <button
                            onClick={() => copy(selected.value, selected.id)}
                            className="flex-1 font-mono text-xs font-black uppercase tracking-wider px-3 py-3 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange transition-colors inline-flex items-center justify-center gap-2"
                        >
                            {copied === selected.id ? <Check size={14} /> : <Copy size={14} />}
                            {copied === selected.id ? 'Copied' : 'Copy ' + selected.label}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
    return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
};
