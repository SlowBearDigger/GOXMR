import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Twitter, Github, Globe, ExternalLink, Copy, Check, Terminal, Zap, Info, Wifi, Cpu, Activity, ArrowLeft } from 'lucide-react';
import { GlitchText } from './GlitchText';
import QRCodeStyling from 'qr-code-styling';

export const PublicProfile: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);
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
    const [activeProtocol, setActiveProtocol] = useState('DEFAULT');
    const [tags, setTags] = useState<string[]>([]);

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
            width: 200,
            height: 200,
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
            className={`min-h-screen text-black font-sans selection:text-white transition-colors duration-500 relative card-texture ${isAmber ? 'theme-amber' : ''} ${isVoid ? 'theme-void' : ''} ${isShadow ? 'theme-shadow' : ''} ${isNeon ? 'theme-neon' : ''}`}
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
            `}</style>

            {isAmber && <div className="scanline-effect"></div>}

            <div className="relative z-10">
                <div className="relative w-full aspect-[21/9] md:aspect-[3/1] min-h-[200px] h-[35vh] max-h-[600px] overflow-hidden bg-black border-b-4 border-accent">
                    {profile.banner_image ? (
                        <img src={profile.banner_image} alt="Banner" className="w-full h-full object-cover object-top" />
                    ) : (
                        <div className="absolute inset-0 opacity-40 mix-blend-screen"
                            style={{ backgroundImage: `repeating-linear-gradient(45deg, ${AC} 0px, ${AC} 1px, transparent 1px, transparent 10px)` }}>
                        </div>
                    )}
                </div>

                <div className="container mx-auto px-4 max-w-2xl -mt-32 relative z-20 mb-24 animate-in slide-in-from-bottom-10 fade-in duration-700">
                    <div className="bg-white/90 backdrop-blur-md border-2 border-black p-6 md:p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group card-texture"
                        style={{ borderColor: BC, backgroundColor: BG, boxShadow: `12px 12px 0px 0px ${AC}` }}>

                        <div className="absolute top-0 right-0 w-12 h-12 bg-accent clip-path-polygon-[100%_0,0_0,100%_100%]"></div>

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-40 h-40 md:w-48 md:h-48 bg-black rounded-full p-2 border-4 border-black mb-8 relative shadow-xl transform transition-transform duration-500 hover:rotate-3" style={{ borderColor: BC }}>
                                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin-slow" style={{ borderColor: AC }}></div>
                                {profile.profile_image ? (
                                    <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-monero-orange flex items-center justify-center text-6xl font-black text-white">
                                        {username?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <h1 className="text-5xl md:text-6xl font-black font-mono uppercase tracking-tighter mb-4 flex items-center gap-2" style={{ color: BC }}>
                                @{username}
                                <Zap size={24} className="text-accent fill-current animate-bounce" />
                            </h1>

                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {tags.map((tag, idx) => (
                                    <div key={idx}
                                        className="px-2 py-1 font-mono text-[10px] font-bold uppercase border-2"
                                        style={{ backgroundColor: idx === 0 ? AC : 'transparent', color: idx === 0 ? '#fff' : (BC || '#000'), borderColor: BC || '#000' }}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>

                            <p className="font-mono text-sm md:text-base text-gray-700 max-w-lg mx-auto mb-10 leading-relaxed border-l-4 border-accent pl-4 text-left bg-gray-50 py-3">
                                {profile.bio || "No manifesto encrypted."}
                            </p>
                        </div>

                        <div className="space-y-4 mb-12">
                            {links.map((link, i) => (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="block border-2 border-black p-4 bg-white transition-all transform hover:-translate-y-1 hover:translate-x-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group/link hover:bg-black hover:text-white"
                                    style={{ borderColor: BC, boxShadow: `4px 4px 0px 0px ${AC}` }}
                                >
                                    <div className="flex justify-between items-center relative z-10">
                                        <span className="font-mono font-bold flex items-center gap-4 text-lg">
                                            {link.type === 'twitter' ? <Twitter size={22} /> : link.type === 'github' ? <Github size={22} /> : <Globe size={22} />}
                                            {link.title}
                                        </span>
                                        <ExternalLink size={20} className="transform group-hover/link:rotate-45 transition-transform" />
                                    </div>
                                </a>
                            ))}
                        </div>

                        <div className="border-t-4 border-black pt-10" style={{ borderColor: BC }}>
                            <div className="flex items-center gap-2 mb-8 justify-center">
                                <div className="w-12 h-1 bg-accent"></div>
                                <h3 className="font-mono font-black uppercase text-xl">Treasury</h3>
                                <div className="w-12 h-1 bg-accent"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-4">
                                    {wallets.map((wallet, i) => (
                                        <div key={i} className="group/wallet">
                                            <div className="flex justify-between text-[10px] font-mono font-bold uppercase mb-1">
                                                <span className="flex items-center gap-2 font-black" style={{ color: wallet.currency === 'XMR' ? '#F26822' : '#f59e0b' }}>
                                                    {wallet.currency} | {wallet.label}
                                                </span>
                                                {copied === wallet.address && <span className="text-green-600 bg-green-50 px-1">COPIED_</span>}
                                            </div>
                                            <button
                                                onClick={() => wallet.address && handleCopy(wallet.address, wallet.address)}
                                                className={`w-full relative border-2 border-black bg-gray-50 p-3 text-left font-mono text-[10px] break-all transition-all ${wallet.address ? 'hover:bg-black hover:text-white' : 'opacity-50 cursor-not-allowed'}`}
                                                style={{ borderColor: BC }}
                                                disabled={!wallet.address}
                                            >
                                                {wallet.address || "NO_ADDRESS_ATTACHED"}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-black relative" style={{ borderColor: BC }}>
                                    <div className="absolute -top-3 right-4 bg-black text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest z-20">Secure_Foundry v1.0</div>
                                    <div ref={qrRef} className="bg-white p-2 border-2 border-black transition-transform hover:scale-105" style={{ borderColor: AC }}></div>
                                    <div className="mt-4 w-full flex flex-col gap-2">
                                        <button
                                            onClick={() => qrInstance.current?.download({ name: `goxmr-${username}-qr`, extension: 'png' })}
                                            className="w-full bg-black text-white text-[10px] font-bold py-2 hover:bg-accent transition-colors uppercase border-2 border-black"
                                            style={{ backgroundColor: AC }}
                                        >
                                            Save_Node_Asset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-12 mb-16 pb-8">
                        <RouterLink to="/" className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 font-mono font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                            Forge Your Own Base <Zap size={16} />
                        </RouterLink>
                    </div>
                </div>
            </div>
        </div>
    );
};
