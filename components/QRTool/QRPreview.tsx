import React from 'react';
import QRCodeStyling from 'qr-code-styling';
import { Download, ShieldAlert } from 'lucide-react';

interface QrPreviewProps {
    qrRef: React.RefObject<HTMLDivElement>;
    isGenerated: boolean;
    isLoading: boolean;
    onDownload: (extension: 'png' | 'svg' | 'pdf') => void;
    countdown: number;
    isDisposable: boolean;
    qrInstance: QRCodeStyling | null;
}

export const QrPreview: React.FC<QrPreviewProps> = ({ qrRef, isGenerated, isLoading, onDownload }) => {
    return (
        <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] min-h-[500px] transition-all">
            {!isGenerated && !isLoading && (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 font-mono">
                    <div className="border-4 border-dotted border-gray-300 dark:border-zinc-700 w-48 h-48 flex items-center justify-center mb-6">
                        <span className="text-xs font-bold uppercase tracking-tighter">Awaiting Matrix...</span>
                    </div>
                    <p className="text-xs uppercase font-bold tracking-widest">Input data to forge QR</p>
                </div>
            )}

            {isLoading && (
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-monero-orange"></div>
                    <span className="font-mono text-xs font-bold uppercase animate-pulse dark:text-white">Encoding...</span>
                </div>
            )}

            <div
                ref={qrRef}
                className={`transition-all duration-500 border-4 border-black dark:border-white p-2 bg-white ${isGenerated && !isLoading ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                style={{ display: isGenerated && !isLoading ? 'block' : 'none' }}
            />

            {isGenerated && !isLoading && (
                <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="border-2 border-red-600 bg-red-50 dark:bg-red-900/10 p-4 mb-6 relative">
                        <div className="absolute -top-3 left-4 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                            <ShieldAlert size={10} /> SECURITY PROTOCOL
                        </div>
                        <p className="font-mono text-[10px] text-red-600 dark:text-red-400 font-bold leading-tight text-center">
                            VERIFY THE ADDRESS MANUALLY. THE NETWORK IS UNFORGIVING. TEST WITH SMALL AMOUNTS FIRST.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onDownload('png')}
                            className="flex items-center justify-center gap-2 p-3 bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-xs border-2 border-black dark:border-white hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-y-1 active:shadow-none uppercase"
                        >
                            <Download size={14} /> PNG
                        </button>
                        <button
                            onClick={() => onDownload('svg')}
                            className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-zinc-800 text-black dark:text-white font-mono font-bold text-xs border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-y-1 active:shadow-none uppercase"
                        >
                            <Download size={14} /> SVG
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
