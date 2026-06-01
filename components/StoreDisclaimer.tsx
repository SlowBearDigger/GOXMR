import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useModalChrome } from '../hooks/useModalChrome';

/** Permanent banner shown on every store page */
export const StoreDisclaimerBanner: React.FC = () => (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 p-3 mb-6">
        <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div className="font-mono text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
                <span className="font-black uppercase">Independent Seller</span> — GOXMR is a platform only. We do NOT verify sellers, guarantee products, or process payments.
                Transactions are direct between buyer and seller. <span className="font-bold">Do your own research.</span> Check references, ask questions, verify reputation before purchasing.
                <span className="font-black"> WE ARE NOT RESPONSIBLE FOR SCAMS OR DISPUTES.</span>
            </div>
        </div>
    </div>
);

/** Checkout confirmation modal — must accept before placing order */
export const StoreDisclaimerModal: React.FC<{ onAccept: () => void; onCancel: () => void }> = ({ onAccept, onCancel }) => {
    const [accepted, setAccepted] = useState(false);
    const modalContentRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useModalChrome({ isOpen: true, onClose: onCancel, contentRef: modalContentRef });

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={onCancel}
        >
            <div
                ref={modalContentRef}
                tabIndex={-1}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] animate-scale-in outline-none max-h-[90vh] overflow-y-auto"
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert size={24} className="text-yellow-600" />
                        <h3 id={titleId} className="font-mono font-black text-lg uppercase tracking-tighter dark:text-white">Before You Proceed</h3>
                    </div>

                    <div className="space-y-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                        <p>This is a <span className="font-bold">peer-to-peer transaction</span>. Payment goes directly to the seller's Monero wallet.</p>
                        <p>GOXMR does <span className="font-bold">NOT</span>:</p>
                        <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                            <li>Hold or escrow funds</li>
                            <li>Verify seller identity or products</li>
                            <li>Guarantee delivery or refunds</li>
                            <li>Mediate disputes</li>
                        </ul>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Monero transactions are <span className="font-bold">irreversible</span>. Verify the seller before sending payment.</p>
                    </div>

                    <label className="flex items-center gap-2 mt-6 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={accepted}
                            onChange={e => setAccepted(e.target.checked)}
                            className="w-4 h-4 accent-monero-orange"
                        />
                        <span className="font-mono text-xs dark:text-white">I understand the risks and take full responsibility</span>
                    </label>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 border-2 border-black dark:border-white font-mono text-xs font-bold uppercase py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors dark:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onAccept}
                            disabled={!accepted}
                            className={`flex-1 font-mono text-xs font-bold uppercase py-2 border-2 transition-colors ${accepted
                                ? 'bg-monero-orange text-white border-monero-orange hover:bg-orange-600'
                                : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700'
                                }`}
                        >
                            Continue to Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
