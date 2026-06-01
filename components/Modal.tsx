import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalChrome } from '../hooks/useModalChrome';
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useModalChrome({ isOpen, onClose, contentRef });

    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            ></div>

            <div
                ref={contentRef}
                tabIndex={-1}
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] flex flex-col animate-scale-in max-h-[90vh] outline-none"
            >
                {/* Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

                {/* Top Bar Detail */}
                <div className="h-1 bg-monero-orange w-full shrink-0"></div>

                <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-gray-50 dark:bg-zinc-800 relative shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-monero-orange animate-pulse"></div>
                        <h2 id={titleId} className="font-mono font-black uppercase text-xl tracking-tight dark:text-white italic">{title}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="hover:bg-red-500 hover:text-white dark:text-white border-2 border-transparent hover:border-black dark:hover:border-white p-2.5 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-monero-orange">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 font-mono dark:text-white overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-monero-orange">
                    {children}
                </div>

                {/* Bottom Status Bar */}
                <div className="border-t border-gray-100 dark:border-zinc-800 p-2 bg-gray-50 dark:bg-zinc-900/50 flex justify-between items-center px-4 shrink-0">
                    <div className="flex gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-green-500/50 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-green-500/20 rounded-full"></div>
                    </div>
                    <span className="text-[8px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">Sovereignty_Modal_v2.0</span>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
