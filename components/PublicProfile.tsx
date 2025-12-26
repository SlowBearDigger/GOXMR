import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Twitter, Github, Globe, ExternalLink, Check, Zap, ArrowLeft, Youtube, Instagram, Twitch, MessageSquare, Send, Mail, Link as LinkIcon, Shield, Cpu, AlertTriangle } from 'lucide-react';
import { GlitchText } from './GlitchText';
import QRCodeStyling from 'qr-code-styling';

interface UserProfile {
    banner_image?: string;
    profile_image?: string;
    bio?: string;
    links?: Array<{ type: string; title: string; url: string; icon?: string }>;
    wallets?: Array<{ currency: string; label: string; address: string }>;
    design?: {
        accentColor?: string;
        backgroundColor?: string;
        pageColor?: string;
        borderColor?: string;
        activeProtocol?: string;
        tags?: string[];
        qrDesign?: any;
        buttonColor?: string;
    };
}

const ICON_MAP: Record<string, any> = {
    twitter: Twitter,
    github: Github,
    globe: Globe,
    youtube: Youtube,
    instagram: Instagram,
    twitch: Twitch,
    discord: MessageSquare,
    telegram: Send,
    mail: Mail,
    link: LinkIcon,
    zap: Zap,
    shield: Shield,
    cpu: Cpu
};

const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
    const Icon = ICON_MAP[name] || Globe;
    return <Icon className={className} />;
};

export const PublicProfile: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [links, setLinks] = useState<any[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);
    const [copied, setCopied] = useState<string | null>(null);

    const [qrDesign, setQrDesign] = useState<any>({
        color: '#F26822',
        shape: 'square',
        cornerType: 'square',
        backgroundColor: '#FFFFFF',
        useGradient: false,
        gradientColor: '#000000',
        gradientType: 'linear',
        logoUrl: null,
    });

    const [accentColor, setAccentColor] = useState('#F26822');
    const [backgroundColor, setBackgroundColor] = useState('');
    const [pageColor, setPageColor] = useState('');
    const [borderColor, setBorderColor] = useState('');
    const [textColor, setTextColor] = useState('');
    const [buttonColor, setButtonColor] = useState('');
    const [activeProtocol, setActiveProtocol] = useState('DEFAULT');
    const [tags, setTags] = useState<string[]>([]);
    const [isCakeModalOpen, setIsCakeModalOpen] = useState(false);

    const xmrWallet = wallets.find(w => w.currency === 'XMR');

    const qrRef = useRef<HTMLDivElement>(null);
    const qrInstance = useRef<QRCodeStyling | null>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/user/${username}`);
                if (!res.ok) throw new Error('Identity not found');
                const data = await res.json();

                setProfile(data);
                setLinks(data.links || []);
                setWallets(data.wallets || []);

                if (data.design) {
                    setAccentColor(data.design.accentColor || '#F26822');
                    setBackgroundColor(data.design.backgroundColor || '');
                    setPageColor(data.design.pageColor || '');
                    setBorderColor(data.design.borderColor || '');
                    setTextColor(data.design.textColor || '');
                    setButtonColor(data.design.buttonColor || '');
                    setActiveProtocol(data.design.activeProtocol || 'DEFAULT');
                    setTags(data.design.tags || []);
                    if (data.design.qrDesign) setQrDesign({ ...qrDesign, ...data.design.qrDesign });
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (username) fetchUserData();
    }, [username]);

    useEffect(() => {
        if (isLoading || !profile) return;

        const defaultWallet = wallets.find(w => w.currency === 'XMR' && w.address) || wallets.find(w => w.address);
        const qrData = defaultWallet ? defaultWallet.address : `https://goxmr.click/${username}`;

        const qr = new QRCodeStyling({
            width: 300,
            height: 300,
            type: 'svg',
            data: qrData,
            image: qrDesign.logoUrl || '',
            dotsOptions: {
                color: qrDesign.color,
                type: qrDesign.shape as any,
                gradient: qrDesign.useGradient ? {
                    type: qrDesign.gradientType,
                    rotation: 0,
                    colorStops: [{ offset: 0, color: qrDesign.color }, { offset: 1, color: qrDesign.gradientColor }]
                } : undefined
            },
            backgroundOptions: { color: qrDesign.backgroundColor },
            cornersSquareOptions: { type: qrDesign.cornerType as any, color: qrDesign.color },
            cornersDotOptions: { type: qrDesign.cornerType as any, color: qrDesign.color },
            imageOptions: { crossOrigin: 'anonymous', margin: 10 }
        });

        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qr.append(qrRef.current);
        }
        qrInstance.current = qr;
    }, [isLoading, profile, qrDesign, wallets, username]);

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const AC = accentColor;
    const BG = backgroundColor;
    const PC = pageColor;
    const BC = borderColor;
    const TC = textColor || borderColor; // Fallback to BC for backwards compatibility
    const protocol = activeProtocol;

    const isAmber = protocol === 'AMBER';
    const isVoid = protocol === 'VOID';
    const isShadow = protocol === 'SHADOW';
    const isNeon = protocol === 'NEON';

    useEffect(() => {
        if (isLoading || error) return;
        const currentBG = PC || BG || (isAmber ? '#0d0d0d' : isVoid ? '#000000' : isShadow ? '#010203' : isNeon ? '#0a0015' : '#ffffff');
        document.body.style.backgroundColor = currentBG;
        return () => {
            document.body.style.backgroundColor = '';
        };
    }, [isLoading, error, PC, BG, isAmber, isVoid, isShadow, isNeon]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono">
                <div className="w-16 h-16 border-4 border-monero-orange border-t-transparent animate-spin mb-4"></div>
                <div className="text-monero-orange animate-pulse">DECRYPTING IDENTITY...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono p-4 text-center">
                <div className="text-red-500 text-4xl mb-4 font-black">404_VOID</div>
                <div className="text-gray-400 mb-8 max-w-md">Target identity does not exist in the decentralized ledger. Access denied.</div>
                <RouterLink to="/" className="border-2 border-red-500 text-red-500 px-6 py-2 hover:bg-red-500 hover:text-black transition-all font-bold uppercase">Return to Base</RouterLink>
            </div>
        );
    }

    return (
        <div
            className={`min-h-screen text-black font-sans selection:text-white transition-colors duration-500 relative w-full overflow-x-hidden ${isAmber ? 'theme-amber' : ''} ${isVoid ? 'theme-void' : ''} ${isShadow ? 'theme-shadow' : ''} ${isNeon ? 'theme-neon' : ''}`}
            style={{
                '--accent': AC,
                backgroundColor: PC || BG || (isAmber ? '#0d0d0d' : isVoid ? '#000000' : isShadow ? '#010203' : isNeon ? '#0a0015' : '#ffffff')
            } as React.CSSProperties}
        >
            <style>{`
                ::selection { background-color: var(--accent); }
                .border-accent { border-color: var(--accent) !important; }
                .text-accent { color: var(--accent) !important; }
                .bg-accent { background-color: var(--accent) !important; }
                .hover-bg-accent:hover { background-color: var(--accent) !important; }
                .hover-text-accent:hover { color: var(--accent) !important; }
                .hover-border-accent:hover { border-color: var(--accent) !important; }
                .shadow-accent { box-shadow: 4px 4px 0px 0px var(--accent) !important; }
                
                .theme-amber { color: #FFB000 !important; }
                .theme-amber .bg-white/90 { background-color: rgba(20, 20, 20, 0.9); color: #FFB000 !important; border-color: #FFB000 !important; }
                .theme-amber .text-black, .theme-amber .text-gray-900 { color: #FFB000 !important; }
                .theme-amber .text-gray-700, .theme-amber .text-gray-500 { color: #FFB000 !important; opacity: 0.8; }
                .theme-amber .bg-gray-50, .theme-amber .bg-gray-100 { background-color: rgba(255, 176, 0, 0.05) !important; border-color: #FFB000 !important; }
                .theme-amber .border-black { border-color: #FFB000 !important; }
                .theme-amber .shadow-black { box-shadow: 4px 4px 0px 0px #FFB000 !important; }

                .theme-void { filter: grayscale(1) contrast(1.2); }
                .theme-void .bg-accent { background-color: black !important; color: white !important; }
                
                .theme-shadow .bg-white/90 { background-color: rgba(0, 5, 0, 0.95); color: #00FF41 !important; border-color: #00FF41 !important; }
                .theme-shadow .text-black, .theme-shadow .text-gray-900 { color: #00FF41 !important; }
                .theme-shadow .text-gray-700, .theme-shadow .text-gray-500 { color: #00FF41 !important; opacity: 0.7; }
                .theme-shadow .border-black { border-color: #00FF41 !important; }
                .theme-shadow .shadow-black { box-shadow: 4px 4px 0px 0px #00FF41 !important; }

                .theme-neon .bg-white/90 { background-color: rgba(15, 0, 30, 0.9); color: #00ffff !important; border-color: #ff00ff !important; }
                .theme-neon .text-black { color: #00ffff !important; }
                .theme-neon .shadow-black { box-shadow: 4px 4px 0px 0px #ff00ff !important; }

                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                .scanline-effect {
                    position: fixed;
                    inset: 0;
                    background: linear-gradient(to bottom, transparent, rgba(255, 176, 0, 0.05), transparent);
                    height: 100%;
                    width: 100%;
                    animation: scanline 10s linear infinite;
                    pointer-events: none;
                    z-index: 50;
                }

                #qr-code-container svg {
                    width: 100% !important;
                    height: auto !important;
                    max-width: 250px;
                }
            `}</style>

            {isAmber && <div className="scanline-effect"></div>}

            <div className="relative z-10 flex flex-col items-center" style={{ '--button-bg': buttonColor || AC } as React.CSSProperties}>
                <style>{`
                    .custom-button {
                        background-color: var(--button-bg) !important;
                        transition: all 0.3s ease;
                    }
                    .custom-button:hover {
                        background-color: black !important;
                        color: white !important;
                    }
                `}</style>
                <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 xl:h-[450px] overflow-hidden bg-black border-b-4 border-accent">
                    {profile?.banner_image ? (
                        <img
                            src={profile.banner_image}
                            alt="Banner"
                            className="w-full h-full object-cover object-center"
                        />
                    ) : (
                        <div className="absolute inset-0 opacity-40 mix-blend-screen"
                            style={{ backgroundImage: `repeating-linear-gradient(45deg, ${AC} 0px, ${AC} 1px, transparent 1px, transparent 10px)` }}>
                        </div>
                    )}
                </div>

                <div className="w-full max-w-3xl px-4 sm:px-6 relative z-20 mb-24 -mt-24 sm:-mt-32 animate-in slide-in-from-bottom-10 fade-in duration-700">
                    <div className="bg-white/90 backdrop-blur-md border-2 border-black p-5 sm:p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group card-texture"
                        style={{ borderColor: BC, backgroundColor: BG, boxShadow: `8px 8px 0px 0px ${AC}` }}>

                        <div className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 bg-accent clip-path-polygon-[100%_0,0_0,100%_100%]"></div>

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-black rounded-full p-1.5 sm:p-2 border-4 border-black mb-6 sm:mb-8 relative shadow-xl transform transition-transform duration-500 hover:rotate-3" style={{ borderColor: BC }}>
                                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin-slow" style={{ borderColor: AC }}></div>
                                {profile?.profile_image ? (
                                    <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-monero-orange flex items-center justify-center text-4xl sm:text-6xl font-black text-white">
                                        {username?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-mono uppercase tracking-tighter mb-4 flex items-center justify-center gap-2 break-all text-center" style={{ color: TC || '#000' }}>
                                <span className="truncate">@{username}</span>
                                <Zap size={24} className="text-accent fill-current animate-bounce shrink-0" />
                            </h1>

                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {tags.map((tag, idx) => (
                                    <div key={idx}
                                        className="px-2 py-1 font-mono text-[10px] sm:text-xs font-bold uppercase border-2"
                                        style={{ backgroundColor: idx === 0 ? AC : 'transparent', color: idx === 0 ? '#fff' : (TC || '#000'), borderColor: BC || '#000' }}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>

                            <p className="font-mono text-sm sm:text-base text-gray-700 w-full max-w-lg mx-auto mb-6 leading-relaxed border-l-4 border-accent pl-4 text-left bg-gray-50/50 py-3" style={{ color: TC || 'inherit' }}>
                                {profile?.bio || "No manifesto encrypted."}
                            </p>

                            {xmrWallet && (
                                <div className="mb-10 w-full max-w-lg mx-auto bg-black text-white p-3 border-2 border-accent shadow-accent animate-in fade-in slide-in-from-top-4 duration-1000">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[8px] font-bold uppercase tracking-widest text-monero-orange">Wallet_Lookup_Protocol</span>
                                        <div className="flex gap-1">
                                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                                            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                        <div className="font-mono text-[10px] sm:text-xs truncate">
                                            <span className="text-gray-500">@</span>
                                            <span className="text-white font-bold">{username}</span>
                                            <span className="text-gray-500">@{(() => {
                                                const parts = window.location.hostname.split('.');
                                                return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                            })()}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const rootDomain = (() => {
                                                    const parts = window.location.hostname.split('.');
                                                    return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                                })();
                                                const handle = `@${username}@${rootDomain}`;
                                                navigator.clipboard.writeText(handle);
                                                setCopied(handle);
                                                setTimeout(() => setCopied(null), 2000);
                                            }}
                                            className="shrink-0 text-[10px] border border-white/20 px-2 py-0.5 hover:bg-white hover:text-black transition-colors"
                                        >
                                            {copied && copied.startsWith('@') ? 'COPIED' : 'COPY'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 mb-12">
                            {links.map((link, i) => (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="block border-2 border-black p-3 sm:p-4 bg-white transition-all transform active:scale-95 sm:active:scale-100 sm:hover:-translate-y-1 sm:hover:translate-x-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group/link hover:bg-black hover:text-white"
                                    style={{
                                        borderColor: BC,
                                        boxShadow: `4px 4px 0px 0px ${AC}`,
                                        backgroundColor: buttonColor || 'white',
                                        color: buttonColor ? (TC || '#fff') : 'inherit'
                                    }}
                                >
                                    <div className="flex justify-between items-center relative z-10">
                                        <span className="font-mono font-bold flex items-center gap-3 sm:gap-4 text-base sm:text-lg truncate">
                                            <IconRenderer name={link.icon || link.type} className="shrink-0" />
                                            <span className="truncate">{link.title}</span>
                                        </span>
                                        <ExternalLink size={18} className="transform group-hover/link:rotate-45 transition-transform shrink-0" />
                                    </div>
                                </a>
                            ))}
                        </div>

                        <div className="border-t-4 border-black pt-8 sm:pt-10" style={{ borderColor: BC }}>
                            <div className="flex items-center gap-2 mb-8 justify-center">
                                <div className="w-8 sm:w-12 h-1 bg-accent"></div>
                                <h3 className="font-mono font-black uppercase text-lg sm:text-xl" style={{ color: TC || '#000' }}>Treasury</h3>
                                <div className="w-8 sm:w-12 h-1 bg-accent"></div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div className="space-y-4 w-full overflow-hidden">
                                    {wallets.map((wallet, i) => (
                                        <div key={i} className="group/wallet w-full">
                                            <div className="flex justify-between text-[10px] font-mono font-bold uppercase mb-1 flex-wrap gap-1">
                                                <span className="flex items-center gap-2 font-black" style={{ color: wallet.currency === 'XMR' ? '#F26822' : '#f59e0b' }}>
                                                    {wallet.currency} | {wallet.label}
                                                </span>
                                                {copied === wallet.address && <span className="text-green-600 bg-green-50 px-1">COPIED_</span>}
                                            </div>
                                            <button
                                                onClick={() => wallet.address && handleCopy(wallet.address, wallet.address)}
                                                className={`w-full relative border-2 border-black bg-gray-50 p-3 text-left font-mono text-[10px] sm:text-xs break-all transition-all ${wallet.address ? 'hover:bg-black hover:text-white active:bg-black active:text-white' : 'opacity-50 cursor-not-allowed'}`}
                                                style={{ borderColor: BC }}
                                                disabled={!wallet.address}
                                            >
                                                {wallet.address || "NO_ADDRESS_ATTACHED"}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-gray-50 border-2 border-black relative w-full" style={{ borderColor: BC }}>
                                    <div className="absolute -top-3 right-4 bg-black text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest z-20">Secure_Foundry v1.0</div>
                                    <div id="qr-code-container" ref={qrRef} className="bg-white p-2 border-2 border-black transition-transform hover:scale-105 flex justify-center items-center w-full max-w-[250px]" style={{ borderColor: AC }}></div>
                                    <div className="mt-4 w-full flex flex-col gap-2 max-w-[250px]">
                                        <button
                                            onClick={() => qrInstance.current?.download({ name: `goxmr-${username}-qr`, extension: 'png' })}
                                            className="w-full bg-black text-white text-[10px] font-bold py-2 hover:bg-accent transition-colors uppercase border-2 border-black"
                                            style={{ backgroundColor: buttonColor || AC, color: buttonColor ? (TC || '#fff') : '#fff' }}
                                        >
                                            Save_Node_Asset
                                        </button>

                                        {xmrWallet && (
                                            <button
                                                onClick={() => setIsCakeModalOpen(true)}
                                                className="w-full bg-[#f59e0b] text-white text-[10px] font-bold py-2 hover:bg-black transition-colors uppercase border-2 border-black flex items-center justify-center gap-2"
                                            >
                                                Donate via CakeWallet 🍰
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cake Wallet Safety Modal */}
                        {isCakeModalOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white border-4 border-black p-6 sm:p-8 max-w-md w-full shadow-[12px_12px_0px_0px_rgba(242,104,34,1)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-12 h-12 bg-monero-orange clip-path-polygon-[100%_0,0_0,100%_100%]"></div>
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                            <AlertTriangle size={32} className="text-red-600" />
                                        </div>
                                        <h2 className="text-2xl font-black font-mono uppercase tracking-tighter mb-4">SECURITY_PROTOCOL_REQUIRED</h2>
                                        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-left">
                                            <p className="font-mono text-xs text-red-700 font-bold uppercase mb-2">⚠ VERIFICATION_WARNING:</p>
                                            <p className="font-mono text-[10px] sm:text-xs text-red-600">
                                                Malicious actors often swap addresses on public pages. You must manually verify that the address in your wallet matches:
                                            </p>
                                            <div className="mt-3 p-2 bg-white border border-red-200 font-mono text-[9px] break-all select-all">
                                                {xmrWallet?.address}
                                            </div>
                                        </div>
                                        <div className="flex flex-col w-full gap-3">
                                            <a
                                                href={`monero:${xmrWallet?.address}`}
                                                onClick={() => setIsCakeModalOpen(false)}
                                                className="w-full bg-black text-white py-3 font-mono font-bold uppercase hover:bg-monero-orange transition-colors flex items-center justify-center gap-2"
                                            >
                                                Proceed to Wallet <ExternalLink size={14} />
                                            </a>
                                            <button
                                                onClick={() => setIsCakeModalOpen(false)}
                                                className="w-full py-2 font-mono text-[10px] font-bold uppercase text-gray-400 hover:text-black transition-colors"
                                            >
                                                Abort Handshake
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="text-center mt-12 mb-16 pb-8">
                        <RouterLink to="/" className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 sm:px-8 sm:py-4 font-mono font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none text-xs sm:text-sm">
                            Forge Your Own Base <Zap size={16} />
                        </RouterLink>
                    </div>
                </div>
            </div>
        </div>
    );
};