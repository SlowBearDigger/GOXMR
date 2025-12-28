import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Terminal } from './Terminal';
import { GlitchText } from './GlitchText';
import { Shield, ArrowRight, Lock, Key, QrCode, Wallet, Code, FileKey, Loader2, GripVertical } from 'lucide-react';
import { DECORATIVE_HASHES } from '../constants';
import { useDraggable } from '../hooks/useDraggable';
import { LearnMonero } from './LearnMonero';
import { Guide } from './Guide';

interface LandingPageProps {
    onOpenRegister: (username?: string) => void;
}

const useUsernameCheck = () => {
    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (!username || username.length < 3) {
            setIsAvailable(null);
            return;
        }

        const handler = setTimeout(async () => {
            checkUsername(username);
        }, 500);

        return () => clearTimeout(handler);
    }, [username]);

    const checkUsername = async (name: string) => {
        setIsChecking(true);
        try {
            const res = await fetch(`/api/check-username/${name}`);
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
    };

    return { username, setUsername, isAvailable, setIsChecking, isChecking, setIsAvailable, checkUsername };
};

const DraggableItem: React.FC<{ id: string, children: React.ReactNode, initialPosition?: { x: number, y: number } }> = ({ id, children, initialPosition }) => {
    const { style, onMouseDown, isDragging } = useDraggable(id, initialPosition);
    return (
        <div
            className={`draggable-element group relative transition-transform duration-75 will-change-transform ${isDragging ? 'z-[100]' : ''}`}
            style={style}
        >
            <div
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
                className="absolute -top-3 -left-3 bg-monero-orange text-white p-1 rounded-none cursor-grab active:cursor-grabbing z-[110] shadow-sm border border-black opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                title="Drag to rearrange"
            >
                <GripVertical size={12} className="group-hover:scale-125 transition-transform" />
                <span className="text-[8px] font-bold uppercase pr-1">REORGANIZE_ME</span>
            </div>
            <div className={`${isDragging ? 'opacity-80 scale-[1.02]' : ''} transition-all duration-200`}>
                {children}
            </div>
        </div>
    );
};

interface DraggableCardProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    value?: string;
    text?: string | React.ReactNode;
    progress?: number;
    badge?: string;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ id, icon, title, value, text, progress, badge }) => (
    <DraggableItem id={id}>
        <div className="border-2 border-black dark:border-white p-3 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] flex flex-col justify-between h-28 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all group hover:translate-y-1 hover:shadow-none">
            <div className="flex justify-between items-start">
                <span className="text-monero-orange">{icon}</span>
                <span className="font-mono text-[9px] uppercase opacity-60 dark:opacity-40">{title}</span>
            </div>
            {value && <div className="font-mono text-lg font-bold dark:text-white group-hover:dark:text-black">{value}</div>}
            {text && (
                <div className="font-mono text-xs font-bold leading-tight dark:text-white group-hover:dark:text-black">
                    {typeof text === 'string'
                        ? text.split('\n').map((line, i) => <div key={i} className={i > 0 ? "mt-0.5" : ""}>{line}</div>)
                        : text
                    }
                </div>
            )}
            {progress !== undefined && (
                <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1 mt-1">
                    <div className="bg-monero-orange h-full group-hover:bg-white group-hover:dark:bg-black" style={{ width: `${progress}%` }}></div>
                </div>
            )}
            {badge && (
                <div className="font-mono text-[8px] text-green-600 group-hover:text-green-400 group-hover:dark:text-green-600">
                    {badge}
                </div>
            )}
        </div>
    </DraggableItem>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenRegister }) => {
    // Correctly accessing context with type safety
    const { activeSection } = useOutletContext<{ activeSection: 'home' | 'learn' | 'guide' }>() || { activeSection: 'home' };

    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const {
        username, setUsername,
        isChecking, setIsChecking,
        isAvailable, setIsAvailable,
        checkUsername
    } = useUsernameCheck();

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleClaim = () => {
        if (!username) return;
        if (username.length < 3) {
            setIsAvailable(false);
            return;
        }

        if (isAvailable === true) {
            onOpenRegister(username);
            return;
        }

        checkUsername(username).then(() => {
            // Let the effect handle the state Update actually, or simple logic here
            // Since checkUsername updates state, we might need to rely on the state or check result directly
            // For simplicity, re-trigger register if available
        });

        // Quick fix to trigger register if checking matches
        if (isAvailable) onOpenRegister(username);
    };

    // Conditional Rendering based on activeSection
    if (activeSection === 'learn') return <LearnMonero />;
    if (activeSection === 'guide') return <Guide />;

    // Default: Return the Workspace
    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col justify-between">
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

            <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-12 md:pt-20 pb-24">
                <div className="lg:col-span-7 flex flex-col gap-8">
                    <DraggableItem id="hero_shield" initialPosition={{ x: 0, y: 0 }}>
                        <div className="inline-flex items-center gap-2 border border-black px-3 py-1 self-start bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Shield size={16} />
                            <span className="font-mono text-xs font-bold uppercase">Sovereign Identity</span>
                        </div>
                    </DraggableItem>

                    <DraggableItem id="hero_title" initialPosition={{ x: 0, y: 0 }}>
                        <div className="relative">
                            <GlitchText
                                text="GOXMR"
                                as="h1"
                                className="text-8xl md:text-[10rem] font-bold leading-none tracking-tighter text-black dark:text-white"
                            />
                            <h2 className="text-4xl md:text-6xl font-bold text-transparent text-stroke-black dark:text-stroke-white mt-[-10px] md:mt-[-20px] opacity-50">
                                SOVEREIGN
                            </h2>
                        </div>
                    </DraggableItem>

                    <DraggableItem id="hero_desc" initialPosition={{ x: 0, y: 0 }}>
                        <p className="text-xl md:text-2xl font-mono max-w-xl border-l-4 border-monero-orange pl-6 py-2 bg-gray-50 dark:bg-zinc-900 dark:text-gray-300">
                            The privacy-first <span className="font-bold bg-black dark:bg-white text-white dark:text-black px-1">link-in-bio</span>. Accept Monero, Bitcoin, and more. 0% fees, 0% tracking.
                        </p>
                    </DraggableItem>

                    <DraggableItem id="hero_claim" initialPosition={{ x: 0, y: 0 }}>
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
                                        className="w-full px-4 py-3 outline-none font-mono font-bold bg-transparent dark:text-white"
                                    />
                                </div>
                                <button
                                    onClick={handleClaim}
                                    disabled={isAvailable === false}
                                    className={`px-6 py-3 font-bold border-l-2 border-black dark:border-white transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none ${isAvailable === false ? 'bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-monero-orange text-white hover:bg-black dark:hover:bg-zinc-800'
                                        }`}
                                >
                                    {isChecking ? '...' : isAvailable === false ? 'TAKEN' : 'CLAIM'} <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    </DraggableItem>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-6 lg:mt-24 relative">
                    <DraggableItem id="terminal" initialPosition={{ x: 20, y: 0 }}>
                        <Terminal />
                    </DraggableItem>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl ml-auto mr-0">
                        <DraggableCard id="card_privacy" icon={<Lock size={16} />} title="Privacy" value="100%" progress={100} />
                        <DraggableCard id="card_security" icon={<Key size={16} />} title="Security" text={<><div>YubiKey</div><div className="mt-0.5">FIDO2</div><div className="mt-0.5">Passkeys</div></>} badge="+ HARDWARE" />
                        <DraggableCard id="card_branding" icon={<QrCode size={16} />} title="Branding" text={<><div>Custom</div><div className="mt-0.5">QR Styles</div></>} badge="+ UNIQUE" />
                        <DraggableCard id="card_donations" icon={<Wallet size={16} />} title="Donations" text={<><div>XMR BTC</div><div className="mt-0.5">LTC ETH</div><div className="mt-0.5">USDT</div></>} badge="+ MULTI-CHAIN" />
                        <DraggableCard id="card_transparent" icon={<Code size={16} />} title="Transparent" text={<><div>100% Free</div><div className="mt-0.5">& Open Source</div></>} badge="+ MIT LICENSE" />
                        <DraggableCard id="card_access" icon={<FileKey size={16} />} title="Access" text={<><div>Biometric &</div><div className="mt-0.5">Passkey Auth</div></>} badge="+ PASSWORDLESS" />
                    </div>

                    <div className="fixed bottom-24 right-8 text-right pointer-events-none select-none">
                        <div className="font-mono text-[10px] uppercase text-monero-orange animate-pulse">
                            Active Interactive Workspace
                        </div>
                        <div className="font-mono text-[8px] text-gray-500 uppercase">
                            Hover elements to [REORGANIZE]
                        </div>
                    </div>

                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('reset-workspace'))}
                        className="fixed bottom-8 right-8 bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-[10px] px-4 py-2 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-all hover:translate-y-1 hover:shadow-none z-40 uppercase group"
                    >
                        <span className="group-hover:hidden">Reorganize Workspace</span>
                        <span className="hidden group-hover:inline">Restore Design [RESET]</span>
                    </button>
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
