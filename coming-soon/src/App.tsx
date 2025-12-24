import React, { useState, useEffect } from 'react';
import { GlitchText } from './components/GlitchText';
import { Terminal, Shield, Eye, Lock, Copy } from 'lucide-react';

function App() {
    const [dots, setDots] = useState('');

    useEffect(() => {
        // Dot animation
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        // Easter Egg: Console Message
        console.log(
            "%c GOXMR %c \nWhy rent your identity when you can own it? \n\nNo middlemen.\nNo censors.\nJust you and the network.",
            "color:#F26822; font-size:40px; font-weight:bold; background:black; padding:10px;",
            "color:black; font-size:14px; font-family:monospace;"
        );

        return () => clearInterval(interval);
    }, []);

    // Hints that cycle (Easter Egg)
    const [hintIndex, setHintIndex] = useState(0);
    const hints = [
        "SYSTEM INITIALIZING",
        "DECENTRALIZING BIO",
        "SEVERING CHAINS",
        "PRUNING THE TREE", // Subtle dig at Linktree
        "ESTABLISHING SOVEREIGNTY"
    ];

    useEffect(() => {
        const hintInterval = setInterval(() => {
            setHintIndex(prev => (prev + 1) % hints.length);
        }, 3000);
        return () => clearInterval(hintInterval);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText("867Cg83epmLfsUTjo5KodzBCUEKWqnvpZEVv7yaFgdkZ4XVckcbEjYsPmDv4Pc5nG29f4GaJA1ggvg2jewFTmEapGFAWueP");
        alert("Monero Address Copied!");
    };

    return (
        <div className="min-h-screen bg-gray-50 text-black font-mono overflow-x-hidden flex flex-col items-center relative selection:bg-[#F26822] selection:text-white pb-20">

            {/* Background FX (Light Mode) */}
            <div className="fixed inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] [background-size:24px_24px]"></div>
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#F26822_1px,transparent_1px),linear-gradient(to_bottom,#F26822_1px,transparent_1px)] [background-size:60px_60px]"></div>

            {/* Scanline (Subtle) */}
            <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.05)_50%)] [background-size:100%_4px] opacity-100"></div>

            {/* Main Content */}
            <div className="z-10 text-center space-y-16 p-8 max-w-6xl w-full mt-20">

                {/* HEADER SECTION */}
                <div className="space-y-6">
                    <div className="flex justify-center mb-8">
                        <div className="w-40 h-40 relative flex items-center justify-center hover:scale-105 transition-transform duration-500 cursor-help" title="Money without masters. Links without leashes.">
                            <img
                                src="https://www.getmonero.org/press-kit/symbols/monero-symbol-800.png"
                                alt="Monero Logo"
                                className="w-full h-full object-contain drop-shadow-2xl animate-pulse-slow"
                            />
                        </div>
                    </div>

                    <div>
                        <GlitchText
                            text="GOXMR"
                            as="h1"
                            className="text-7xl md:text-9xl font-black tracking-tighter text-black select-none pointer-events-none"
                        />
                        <div className="h-4 flex justify-center items-center gap-2 text-[#F26822] font-bold tracking-[0.5em] text-sm uppercase transition-all duration-500 mt-4">
                            <span key={hintIndex} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {hints[hintIndex]}
                            </span>
                            <span>{dots}</span>
                        </div>
                    </div>
                </div>

                {/* MYSTERY CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                    {/* Card 1 */}
                    <div className="group border-4 border-black bg-white p-6 relative hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#ccc] hover:shadow-[12px_12px_0px_0px_#F26822]">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-2 border-black flex items-center justify-center rounded-full group-hover:bg-black group-hover:text-white transition-colors">
                                <Terminal size={24} />
                            </div>
                            <h3 className="text-xl font-black uppercase">Sovereignty</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed">
                                Not rented.<br />Not borrowed.<br />Wholly owned.
                            </p>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="group border-4 border-black bg-white p-6 relative hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#ccc] hover:shadow-[12px_12px_0px_0px_#F26822]">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-2 border-black flex items-center justify-center rounded-full group-hover:bg-black group-hover:text-white transition-colors">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-xl font-black uppercase">Silence</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed">
                                Observe<br />without being<br />observed.
                            </p>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="group border-4 border-black bg-white p-6 relative hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#ccc] hover:shadow-[12px_12px_0px_0px_#F26822]">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-2 border-black flex items-center justify-center rounded-full group-hover:bg-black group-hover:text-white transition-colors">
                                <Eye size={24} />
                            </div>
                            <h3 className="text-xl font-black uppercase">Exit Strategy</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed">
                                Take it all.<br />Leave nothing.<br />Vanish.
                            </p>
                        </div>
                    </div>
                </div>

                {/* DONATION SECTION */}
                <div className="w-full max-w-2xl mx-auto mt-20">
                    <div className="border-4 border-black bg-white p-8 relative shadow-[12px_12px_0px_0px_#F26822]">
                        <div className="absolute top-0 right-0 bg-[#F26822] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                            Output 0 // Donation
                        </div>

                        <h3 className="text-2xl font-black uppercase mb-2">Fuel the Signal</h3>
                        <p className="text-gray-500 text-sm mb-6">Support open source sovereignty. Contributions enable development.</p>

                        <div className="bg-gray-100 border-2 border-black p-4 break-all font-mono text-xs text-center hover:bg-[#F26822] hover:text-white hover:border-black cursor-pointer transition-colors group relative" onClick={copyToClipboard}>
                            <p className="opacity-80">867Cg83epmLfsUTjo5KodzBCUEKWqnvpZEVv7yaFgdkZ4XVckcbEjYsPmDv4Pc5nG29f4GaJA1ggvg2jewFTmEapGFAWueP</p>
                            <div className="hidden group-hover:flex absolute inset-0 bg-black text-white items-center justify-center font-bold uppercase tracking-widest gap-2">
                                <span>Click to Copy Address</span>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4 mt-6">
                            <button onClick={copyToClipboard} className="flex items-center gap-2 border-2 border-black px-6 py-3 font-bold uppercase hover:bg-black hover:text-white transition-all text-sm">
                                <Copy size={16} /> Copy Address
                            </button>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="text-center opacity-40 text-[10px] uppercase tracking-widest text-gray-500 mt-20">
                    v0.9.0 // The Tree is Withering
                </div>

            </div>
        </div>
    );
}

export default App;
