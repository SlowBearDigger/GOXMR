import React, { useState, useEffect } from 'react';
import { Terminal } from './Terminal';
import { GlitchText } from './GlitchText';
import { Shield, ArrowRight, Lock, Key, QrCode, Wallet, Code, FileKey, Loader2 } from 'lucide-react';
import { DECORATIVE_HASHES } from '../constants';

interface LandingPageProps {
    onOpenRegister: (username?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenRegister }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (!username || username.length < 3) {
            setIsAvailable(null);
            return;
        }

        const handler = setTimeout(async () => {
            setIsChecking(true);
            try {
                const res = await fetch(`/api/check-username/${username}`);
                if (!res.ok) {
                    setIsAvailable(false);
                    return;
                }
                const data = await res.json();
                setIsAvailable(data.available);
            } catch (err) {
                console.error("Availability check failed", err);
                setIsAvailable(false);
            } finally {
                setIsChecking(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [username]);

    const handleClaim = async () => {
        if (!username) return;
        if (username.length < 3) {
            setIsAvailable(false);
            return;
        }

        if (isAvailable === true) {
            onOpenRegister(username);
            return;
        }

        setIsChecking(true);
        try {
            const res = await fetch(`/api/check-username/${username}`);
            if (!res.ok) {
                setIsAvailable(false);
                return;
            }
            const data = await res.json();
            setIsAvailable(data.available);
            if (data.available) {
                onOpenRegister(username);
            }
        } catch (err) {
            console.error("Manual check failed", err);
            setIsAvailable(false);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="relative">
            <div
                className="fixed pointer-events-none z-50 mix-blend-difference text-white font-mono text-xs hidden md:block"
                style={{
                    left: mousePosition.x + 20,
                    top: mousePosition.y + 20,
                }}
            >
                <span className="bg-white text-black px-1">X: {mousePosition.x}</span>
                <span className="bg-monero-orange text-black px-1 ml-1">Y: {mousePosition.y}</span>
            </div>

            <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-12 md:pt-20">
                <div className="lg:col-span-7 flex flex-col gap-8">
                    <div className="inline-flex items-center gap-2 border border-black px-3 py-1 self-start bg-yellow-300 transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Shield size={16} />
                        <span className="font-mono text-xs font-bold uppercase">Sovereign Identity</span>
                    </div>

                    <div className="relative">
                        <GlitchText
                            text="GOXMR"
                            as="h1"
                            className="text-8xl md:text-[10rem] font-bold leading-none tracking-tighter text-black dark:text-white"
                        />
                        <h2 className="text-4xl md:text-6xl font-bold text-transparent text-stroke-black dark:text-stroke-white mt-[-10px] md:mt-[-20px] opacity-50">
                            SOVEREIGN
                        </h2>
                        <div className="absolute top-0 right-10 md:right-20 w-24 h-24 border-2 border-monero-orange rounded-full opacity-20 animate-spin-slow pointer-events-none flex items-center justify-center">
                            <div className="w-2 h-2 bg-monero-orange rounded-full"></div>
                        </div>
                    </div>

                    <p className="text-xl md:text-2xl font-mono max-w-xl border-l-4 border-monero-orange pl-6 py-2 bg-gray-50 dark:bg-zinc-900 dark:text-gray-300">
                        The privacy-first <span className="font-bold bg-black dark:bg-white text-white dark:text-black px-1">link-in-bio</span>. Accept Monero, Bitcoin, and more. 0% fees, 0% tracking.
                    </p>

                    <div className="flex flex-col w-full max-w-md">
                        <div className={`flex border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] w-full transition-colors ${isAvailable === true ? 'border-green-600 bg-green-50 dark:bg-green-900/10' :
                            isAvailable === false ? 'border-red-600 bg-red-50 dark:bg-red-900/10' : 'border-black dark:border-white bg-white dark:bg-zinc-900'
                            }`}>
                            <div className="bg-gray-100 dark:bg-zinc-800 px-4 py-3 border-r-2 border-black dark:border-white font-mono text-gray-500 dark:text-gray-400 hidden sm:flex items-center">
                                goxmr.click/
                            </div>
                            <div className="relative flex-1 flex items-center">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="yourname"
                                    className="w-full px-4 py-3 outline-none font-mono font-bold bg-transparent placeholder:text-gray-300 dark:placeholder:text-zinc-600 dark:text-white"
                                />
                                <div className="absolute right-3">
                                    {isChecking ? (
                                        <Loader2 size={16} className="animate-spin text-gray-400" />
                                    ) : null}
                                </div>
                            </div>
                            <button
                                onClick={handleClaim}
                                disabled={isAvailable === false}
                                className={`px-6 py-3 font-bold border-l-2 border-black dark:border-white transition-colors flex items-center gap-2 ${isAvailable === false ? 'bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-monero-orange text-white hover:bg-black dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {isChecking ? 'CHECKING...' : isAvailable === false ? 'TAKEN' : 'CLAIM'} <ArrowRight size={18} />
                            </button>
                        </div>
                        <div className="h-6 mt-1 px-1">
                            {isAvailable === false && <span className="text-[10px] text-red-600 font-bold uppercase">Identity already claimed by another operative</span>}
                            {isAvailable === true && <span className="text-[10px] text-green-600 font-bold uppercase">This identity is available for claim</span>}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-6 lg:mt-24 relative">
                    <div className="absolute -top-12 -right-12 text-9xl font-bold text-gray-100 dark:text-zinc-900 select-none z-[-1] overflow-hidden">
                        XMR
                    </div>
                    <div className="transform lg:translate-x-8 transition-transform hover:scale-[1.02] duration-300">
                        <Terminal />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl ml-auto mr-0 transform lg:-translate-x-4">
                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <Lock size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Privacy</span>
                            </div>
                            <div className="font-mono text-lg font-bold dark:text-white group-hover:dark:text-black">100%</div>
                            <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1 mt-1">
                                <div className="bg-monero-orange h-full w-[100%] group-hover:bg-white group-hover:dark:bg-black"></div>
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <Key size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Security</span>
                            </div>
                            <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                                YubiKey<br />FIDO2<br />Passkeys
                            </div>
                            <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                                + HARDWARE
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <QrCode size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Branding</span>
                            </div>
                            <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                                Custom<br />QR Styles
                            </div>
                            <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                                + UNIQUE
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <Wallet size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Donations</span>
                            </div>
                            <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                                XMR BTC<br />LTC ETH<br />USDT
                            </div>
                            <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                                + MULTI-CHAIN
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <Code size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Transparent</span>
                            </div>
                            <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                                100% Free<br />& Open Source
                            </div>
                            <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                                + MIT LICENSE
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors group">
                            <div className="flex justify-between items-start">
                                <FileKey size={16} className="text-monero-orange" />
                                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">Access</span>
                            </div>
                            <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                                Biometric &<br />Passkey Auth
                            </div>
                            <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                                + PASSWORDLESS
                            </div>
                        </div>
                    </div>

                    <div className="font-mono text-[10px] text-gray-400 text-right leading-tight mt-4 select-none pointer-events-none">
                        {DECORATIVE_HASHES.map((hash, i) => (
                            <div key={i}>{hash}</div>
                        ))}
                    </div>
                </div>
            </div>
            <style>{`
                .text-stroke-black {
                    -webkit-text-stroke: 1px black;
                }
                .dark .text-stroke-white {
                    -webkit-text-stroke: 1px white;
                }
                .animate-spin-slow {
                    animation: spin 10s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
