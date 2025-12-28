import React from 'react';
import { QRTool } from './QRTool/QRTool';
import { GlitchText } from './GlitchText';
import { Wrench } from 'lucide-react';

export const Tools: React.FC = () => {
    return (
        <div className="pt-24 pb-20 px-4 md:px-6 max-w-7xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-4 border-black dark:border-white pb-8">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-monero-orange p-2 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Wrench size={24} className="text-white" />
                        </div>
                        <span className="font-mono font-black text-xs uppercase tracking-widest dark:text-white opacity-50">Sovereign_Toolbox_v1.0</span>
                    </div>
                    <GlitchText
                        text="CRYPTOGRAPHIC TOOLS"
                        as="h1"
                        className="text-4xl md:text-6xl font-black tracking-tighter uppercase dark:text-white leading-none"
                    />
                    <p className="font-mono text-sm md:text-md mt-4 dark:text-gray-400 max-w-2xl font-bold leading-tight">
                        Advanced, privacy-preserving utilities for the Monero ecosystem. No tracking. No central authority. Pure cryptography.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                <section id="qr-foundry">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-0.5 flex-1 bg-black/10 dark:bg-white/10"></div>
                        <h2 className="font-mono font-black text-xl uppercase tracking-widest dark:text-white px-4">01. QR_FOUNDRY</h2>
                        <div className="h-0.5 flex-1 bg-black/10 dark:bg-white/10"></div>
                    </div>
                    <QRTool />
                </section>

                {/* Placeholder for future tools */}
                <section className="opacity-30 pointer-events-none grayscale mt-12 mb-20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-0.5 flex-1 bg-black/10 dark:bg-white/10"></div>
                        <h2 className="font-mono font-black text-xl uppercase tracking-widest dark:text-white px-4">02. ADDRESS_VALIDATOR (COMING_SOON)</h2>
                        <div className="h-0.5 flex-1 bg-black/10 dark:bg-white/10"></div>
                    </div>
                    <div className="h-48 border-4 border-dotted border-gray-400 dark:border-zinc-700 flex items-center justify-center">
                        <span className="font-mono font-bold uppercase tracking-tighter">Encrypted Segment Ready for Deployment...</span>
                    </div>
                </section>
            </div>
        </div>
    );
};
