import React, { useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { Download, Share2 } from 'lucide-react';
interface QrPreviewProps {
    qrRef: React.RefObject<HTMLDivElement>;
    isGenerated: boolean;
    isLoading: boolean;
    onDownload: (extension: 'png' | 'svg' | 'pdf') => void;
    countdown: number;
    isDisposable: boolean;
    qrInstance: QRCodeStyling | null;
}
export const QrPreview: React.FC<QrPreviewProps> = ({ qrRef, isGenerated, isLoading, onDownload, countdown, isDisposable, qrInstance }) => {
    const [shareText, setShareText] = useState('Share Link');
    const handleShare = async () => {
        setShareText('Copied!');
        setTimeout(() => setShareText('Share Link'), 2000);
    };
    return (
        <div className="w-full lg:sticky lg:top-8 flex flex-col gap-4">
            { }
            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] p-6 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
                { }
                <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
                {!isGenerated && !isLoading && (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 dark:text-zinc-600 z-10">
                        <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 w-48 h-48 flex items-center justify-center mb-4">
                            <span className="font-mono text-xs font-bold uppercase">RENDER AREA</span>
                        </div>
                        <p className="font-mono text-xs">Waiting for input stream...</p>
                    </div>
                )}
                {isLoading && (
                    <div className="z-10 flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-black dark:border-white border-t-monero-orange rounded-full animate-spin mb-4"></div>
                        <span className="font-mono text-xs font-bold animate-pulse dark:text-white">COMPILING SHADERS...</span>
                    </div>
                )}
                <div
                    ref={qrRef}
                    className={`transition-all duration-500 transform ${isGenerated && !isLoading ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} z-10 bg-white p-2`}
                />
                {isGenerated && !isLoading && isDisposable && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 font-mono text-[10px] font-bold animate-pulse border border-black dark:border-white">
                        EXPIRES: {countdown}s
                    </div>
                )}
            </div>
            { }
            {isGenerated && !isLoading && (
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-bottom-2">
                    <button onClick={() => onDownload('png')} className="bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-xs py-3 border-2 border-black dark:border-white hover:bg-monero-orange dark:hover:bg-monero-orange hover:text-white dark:hover:text-white transition-colors flex items-center justify-center gap-2">
                        <Download size={14} /> PNG
                    </button>
                    <button onClick={() => onDownload('svg')} className="bg-white dark:bg-zinc-800 text-black dark:text-white font-mono font-bold text-xs py-3 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                        <Download size={14} /> SVG
                    </button>
                </div>
            )}
        </div>
    );
};