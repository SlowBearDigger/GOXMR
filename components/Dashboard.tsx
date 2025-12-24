import React, { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Twitter, Globe, Github, Youtube, Smartphone, DollarSign, Wallet as WalletIcon, Check, Loader2 } from 'lucide-react';
import { QrGenerator } from './QrGenerator';
import { Settings } from './Settings';
import { DashboardNav } from './DashboardNav';
import type { Link, Wallet } from '../types.ts';
const INITIAL_LINKS: Link[] = [];
const INITIAL_WALLETS: Wallet[] = [];
export const Dashboard: React.FC = () => {
    const [links, setLinks] = useState<Link[]>(INITIAL_LINKS);
    const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
    const [activeSection, setActiveSection] = useState('identity');
    const addLink = () => {
        const id = Date.now();
        setLinks([...links, { id, type: 'globe', title: 'New Link', url: 'https://google.com' }]);
    };
    const removeLink = (id: number) => {
        setLinks(links.filter(l => l.id !== id));
    };
    const addWallet = () => {
        const id = Date.now();
        setWallets([...wallets, { id, currency: 'XMR', label: 'New Wallet (Private)', address: '' }]);
    };
    const removeWallet = (id: number) => {
        setWallets(wallets.filter(w => w.id !== id));
    };
    const updateLink = (id: number, updates: Partial<Link>) => {
        setLinks(links.map(l => l.id === id ? { ...l, ...updates } : l));
    };
    const updateWallet = (id: number, updates: Partial<Wallet>) => {
        setWallets(wallets.map(w => w.id === id ? { ...w, ...updates } : w));
    };
    const handleRestore = (data: { links: Link[], wallets: Wallet[] }) => {
        setLinks(data.links);
        setWallets(data.wallets);
    };
    const [designTags, setDesignTags] = useState<string[]>(['Cypherpunk']);
    const [accentColor, setAccentColor] = useState('#F26822');
    const [backgroundColor, setBackgroundColor] = useState('');
    const [pageColor, setPageColor] = useState('');
    const [borderColor, setBorderColor] = useState('');
    const [activeProtocol, setActiveProtocol] = useState('DEFAULT');
    const [username, setUsername] = useState('Loading...');
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [bannerImage, setBannerImage] = useState<string | null>(null);
    const [hasRecovery, setHasRecovery] = useState(true);
    const fileInputRefProfile = React.useRef<HTMLInputElement>(null);
    const fileInputRefBanner = React.useRef<HTMLInputElement>(null);
    const [qrDesign, setQrDesign] = useState({
        color: '#F26822',
        shape: 'square',
        cornerType: 'square',
        backgroundColor: '#FFFFFF',
        useGradient: false,
        gradientColor: '#000000',
        gradientType: 'linear',
        logoUrl: null as string | null,
    });
    const fetchProfile = async () => {
        const token = localStorage.getItem('goxmr_token');
        if (!token) return;
        try {
            const res = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsername(data.username);
                setDisplayName(data.display_name || '');
                setBio(data.bio || '');
                if (data.profile_image) setProfileImage(data.profile_image);
                if (data.banner_image) setBannerImage(data.banner_image);
                if (data.links) setLinks(data.links);
                if (data.wallets) setWallets(data.wallets);
                setHasRecovery(!!data.hasRecovery);
                if (data.design) {
                    if (data.design.accentColor) setAccentColor(data.design.accentColor);
                    if (data.design.backgroundColor) setBackgroundColor(data.design.backgroundColor);
                    if (data.design.pageColor) setPageColor(data.design.pageColor);
                    if (data.design.borderColor) setBorderColor(data.design.borderColor);
                    if (data.design.tags) setDesignTags(data.design.tags);
                    if (data.design.activeProtocol) setActiveProtocol(data.design.activeProtocol);
                    if (data.design.qrDesign) setQrDesign({ ...qrDesign, ...data.design.qrDesign });
                    localStorage.setItem('goxmr_design', JSON.stringify(data.design));
                }
            }
        } catch (error) {
            console.error("Failed to fetch profile", error);
        }
    };
    const [isDeploying, setIsDeploying] = useState(false);
    const [isDeploySuccess, setIsDeploySuccess] = useState(false);
    const handleDeploy = async () => {
        setIsDeploying(true);
        setIsDeploySuccess(false);
        const token = localStorage.getItem('goxmr_token');
        const designData = {
            accentColor,
            backgroundColor,
            pageColor,
            borderColor,
            tags: designTags,
            activeProtocol,
            qrDesign
        };
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const res = await fetch('/api/me/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    links,
                    wallets,
                    design: designData
                })
            });
            if (res.ok) {
                setIsDeploySuccess(true);
                setTimeout(() => setIsDeploySuccess(false), 3000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeploying(false);
        }
    };
    const saveProfileText = async () => {
        const token = localStorage.getItem('goxmr_token');
        try {
            await fetch('/api/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ display_name: displayName, bio })
            });
        } catch (e) {
            console.error(e);
        }
    };
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'banner' | 'qr_logo') => {
        const file = event.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        const token = localStorage.getItem('goxmr_token');
        try {
            const res = await fetch(`/api/me/upload/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                const fullUrl = data.url;
                if (type === 'profile') setProfileImage(fullUrl);
                else if (type === 'banner') setBannerImage(fullUrl);
                else if (type === 'qr_logo') setQrDesign(prev => ({ ...prev, logoUrl: fullUrl }));
            } else {
                const errData = await res.json();
                alert(`Upload failed: ${errData.error || 'Server Error'}`);
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Check server logs.");
        }
    };
    useEffect(() => {
        fetchProfile();
        const saved = localStorage.getItem('goxmr_design');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.accentColor) setAccentColor(parsed.accentColor);
            if (parsed.backgroundColor) setBackgroundColor(parsed.backgroundColor);
            if (parsed.pageColor) setPageColor(parsed.pageColor);
            if (parsed.borderColor) setBorderColor(parsed.borderColor);
            if (parsed.tags) setDesignTags(parsed.tags);
            if (parsed.activeProtocol) setActiveProtocol(parsed.activeProtocol);
        }
    }, []);
    const updateDesign = (key: string, value: any) => {
        const settings = JSON.parse(localStorage.getItem('goxmr_design') || '{}');
        const newSettings = { ...settings, [key]: value };
        localStorage.setItem('goxmr_design', JSON.stringify(newSettings));
        window.dispatchEvent(new Event('goxmr_design_update'));
        if (key === 'accentColor') setAccentColor(value);
        if (key === 'accentColor') setAccentColor(value);
        if (key === 'backgroundColor') setBackgroundColor(value);
        if (key === 'pageColor') setPageColor(value);
        if (key === 'borderColor') setBorderColor(value);
        if (key === 'tags') setDesignTags(value);
        if (key === 'activeProtocol') setActiveProtocol(value);
    };
    const handleBlur = () => {
        saveProfileText();
    };
    const addTag = () => {
        const newTags = [...designTags, 'New Tag'];
        updateDesign('tags', newTags);
    };
    const removeTag = (index: number) => {
        const newTags = designTags.filter((_, i) => i !== index);
        updateDesign('tags', newTags);
    };
    const editTag = (index: number, val: string) => {
        const newTags = [...designTags];
        newTags[index] = val;
        updateDesign('tags', newTags);
    };
    useEffect(() => {
        const handleScroll = () => {
            const sections = ['identity', 'signals', 'treasury', 'qr-foundry', 'design', 'settings'];
            const scrollPosition = window.scrollY + 200;
            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveSection(section);
                    }
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in zoom-in duration-500">
            { }
            <div className="flex justify-between items-end mb-8 border-b-2 border-black pb-4 ml-0 lg:ml-[25%]">
                <div>
                    <h1 className="text-4xl font-black font-mono tracking-tighter uppercase mb-2">Command Center</h1>
                    <p className="font-mono text-sm text-gray-500">Manage your sovereign identity.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className={`font-mono text-xs px-4 py-2 border-2 border-black font-bold uppercase transition-all flex items-center gap-2 ${isDeploySuccess ? 'bg-green-500 text-white' : 'bg-black text-white hover:bg-white hover:text-black'
                            }`}
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                DEPLOYING...
                            </>
                        ) : isDeploySuccess ? (
                            <>
                                <Check size={14} />
                                SYNC COMPLETE
                            </>
                        ) : (
                            <>
                                DEPLOY CHANGES
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </>
                        )}
                    </button>
                    <div className="font-mono text-xs bg-green-100 text-green-800 px-2 py-1 border border-green-800 font-bold">
                        ● SYSTEMS ONLINE
                    </div>
                </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-8">
                { }
                <div className="lg:w-1/4">
                    <DashboardNav
                        activeSection={activeSection}
                        isDeploying={isDeploying}
                        onDeploy={handleDeploy}
                        isSuccess={isDeploySuccess}
                    />
                </div>
                { }
                <div className="lg:w-3/4 flex flex-col gap-12">
                    { }
                    <section id="identity" className="scroll-mt-32">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="bg-black text-white p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Identity Module</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            { }
                            <input type="file" ref={fileInputRefBanner} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
                            <input type="file" ref={fileInputRefProfile} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile')} />

                            <div className="relative group">
                                <div className="h-48 bg-gray-100 overflow-hidden relative">
                                    {bannerImage ? (
                                        <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 flex items-center justify-center font-mono text-gray-400 text-xs">
                                            <div className="flex flex-col items-center gap-1">
                                                <span>NO_BANNER_DETECTED</span>
                                                <span className="text-[10px] opacity-50 uppercase mt-2">Recommended: 1500x500px</span>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log("[DEBUG] Banner upload triggered via click");
                                            fileInputRefBanner.current?.click();
                                        }}
                                        className="absolute bottom-4 right-4 bg-monero-orange text-white p-2 hover:bg-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-30"
                                        title="Change Banner Image"
                                    >
                                        <Camera size={16} />
                                    </button>
                                </div>
                                <div className="p-6 pt-0 -mt-12 relative flex flex-col md:flex-row gap-6 items-end">
                                    <div className="relative group/profile">
                                        <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-lg relative">
                                            {profileImage ? (
                                                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <Camera size={24} className="text-gray-400 mb-1" />
                                                    <span className="text-[8px] text-gray-400 font-mono uppercase">512x512</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => fileInputRefProfile.current?.click()}
                                            className="absolute bottom-0 right-0 bg-monero-orange text-white p-1.5 rounded-full hover:scale-110 transition-transform shadow-lg"
                                        >
                                            <Camera size={12} />
                                        </button>
                                    </div>
                                    <div className="flex-1 w-full space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sovereign Identity</label>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-lg">@{username}</span>
                                                <div className="px-1 bg-green-100 text-green-700 text-[8px] font-mono border border-green-200">VERIFIED</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2 font-mono">Display Name</label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                onBlur={handleBlur}
                                                placeholder="Enter display name..."
                                                className="w-full border-2 border-black p-3 font-mono text-sm focus:bg-gray-50 outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2 font-mono">Sovereign Bio</label>
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                onBlur={handleBlur}
                                                placeholder="Tell your story..."
                                                className="w-full border-2 border-black p-3 font-mono text-sm h-32 focus:bg-gray-50 outline-none transition-colors resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="signals" className="scroll-mt-32 w-full">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
                            <div className="bg-black text-white p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Signals (Links)</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[600px]">
                                {links.map(link => (
                                    <div key={link.id} className="border border-black p-2 flex items-center gap-2 bg-gray-50 group hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                        <div className="w-8 h-8 bg-white border border-black flex items-center justify-center text-monero-orange">
                                            {link.type === 'twitter' ? <Twitter size={14} /> : link.type === 'github' ? <Github size={14} /> : <Globe size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={link.title}
                                                onChange={(e) => updateLink(link.id, { title: e.target.value })}
                                                className="w-full font-mono text-xs font-bold bg-transparent outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={link.url}
                                                onChange={(e) => updateLink(link.id, { url: e.target.value })}
                                                className="w-full font-mono text-[10px] text-gray-500 bg-transparent outline-none"
                                            />
                                        </div>
                                        <button onClick={() => removeLink(link.id)} className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={addLink} className="w-full border-2 border-dashed border-gray-300 p-3 flex items-center justify-center gap-2 font-mono text-xs font-bold text-gray-400 hover:text-monero-orange hover:border-monero-orange transition-colors">
                                    <Plus size={14} /> ADD SIGNAL
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="treasury" className="scroll-mt-32 w-full">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
                            <div className="bg-black text-white p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Treasury (Wallets)</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col gap-3">
                                {wallets.map(wallet => (
                                    <div key={wallet.id} className="border border-black p-3 bg-gray-50 flex flex-col gap-2 group hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {wallet.currency === 'XMR' ?
                                                    <div className="w-5 h-5 bg-monero-orange rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-black">M</div> :
                                                    <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-black">B</div>
                                                }
                                                <input
                                                    type="text"
                                                    value={wallet.label}
                                                    onChange={(e) => updateWallet(wallet.id, { label: e.target.value })}
                                                    className="font-mono text-xs font-bold bg-transparent outline-none"
                                                />
                                            </div>
                                            <button onClick={() => removeWallet(wallet.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                <WalletIcon size={10} className="text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={wallet.address}
                                                onChange={(e) => updateWallet(wallet.id, { address: e.target.value })}
                                                placeholder="Paste Address"
                                                className="w-full pl-6 pr-2 py-1 font-mono text-[10px] bg-white border border-gray-200 focus:border-black outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addWallet} className="w-full border-2 border-dashed border-gray-300 p-3 flex items-center justify-center gap-2 font-mono text-xs font-bold text-gray-400 hover:text-monero-orange hover:border-monero-orange transition-colors">
                                    <Plus size={14} /> ADD WALLET
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="qr-foundry" className="scroll-mt-32">
                        <QrGenerator
                            wallets={wallets}
                            qrDesign={qrDesign}
                            onQrDesignChange={setQrDesign}
                            onUploadLogo={(e) => handleImageUpload(e, 'qr_logo')}
                        />
                    </section>
                    { }
                    <section id="design" className="scroll-mt-32">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="bg-black text-white p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Design Studio</span>
                                <div className="flex gap-2 items-center">
                                    <span className="text-[10px] opacity-50">VIRTUAL_RENDERER v2.0</span>
                                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    { }
                                    <div className="space-y-8">
                                        { }
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-4 border-b border-gray-100 pb-1">Visual Protocol (Skins)</h4>
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                                {[
                                                    { id: 'DEFAULT', name: 'Standard_Ops', color: '#F26822' },
                                                    { id: 'SHADOW', name: 'Shadow_Link', color: '#00FF41' },
                                                    { id: 'AMBER', name: 'Amber_Grid', color: '#FFB000' },
                                                    { id: 'VOID', name: 'Void_Glitch', color: '#000000' },
                                                    { id: 'NEON', name: 'Plasma_Neon', color: '#ff00ff' }
                                                ].map(skin => (
                                                    <button
                                                        key={skin.id}
                                                        onClick={() => {
                                                            updateDesign('activeProtocol', skin.id);
                                                            updateDesign('accentColor', skin.color);
                                                        }}
                                                        className={`flex flex-col gap-1 p-2 border-2 transition-all group ${activeProtocol === skin.id
                                                            ? 'border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                                            : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'}`}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="font-mono text-[8px] font-bold">[{activeProtocol === skin.id ? 'ACTIVE' : 'READY'}]</span>
                                                            <div className="w-2 h-2" style={{ backgroundColor: skin.color }}></div>
                                                        </div>
                                                        <span className="font-mono text-[10px] font-black uppercase text-left">{skin.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    { }
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        { }
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Primary Accent</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={accentColor}
                                                    onChange={(e) => updateDesign('accentColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={accentColor.toUpperCase()}
                                                    onChange={(e) => updateDesign('accentColor', e.target.value)}
                                                    className="font-mono text-xs border-2 border-black p-2 w-full outline-none focus:bg-gray-50 uppercase"
                                                />
                                            </div>
                                        </div>
                                        { }
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Custom Border</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={borderColor || '#000000'}
                                                    onChange={(e) => updateDesign('borderColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={borderColor ? borderColor.toUpperCase() : ''}
                                                        placeholder="DEFAULT"
                                                        onChange={(e) => updateDesign('borderColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black p-2 w-full outline-none focus:bg-gray-50 uppercase"
                                                    />
                                                    {borderColor && (
                                                        <button onClick={() => updateDesign('borderColor', '')} className="border-2 border-black px-2 hover:bg-black hover:text-white transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        { }
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Page Body Background</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={pageColor || '#000000'}
                                                    onChange={(e) => updateDesign('pageColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={pageColor ? pageColor.toUpperCase() : ''}
                                                        placeholder="THEME_DEFAULT"
                                                        onChange={(e) => updateDesign('pageColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black p-2 w-full outline-none focus:bg-gray-50 uppercase"
                                                    />
                                                    {pageColor && (
                                                        <button onClick={() => updateDesign('pageColor', '')} className="border-2 border-black px-2 hover:bg-black hover:text-white transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        { }
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Card Background</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={backgroundColor || '#000000'}
                                                    onChange={(e) => updateDesign('backgroundColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={backgroundColor ? backgroundColor.toUpperCase() : ''}
                                                        placeholder="DEFAULT"
                                                        onChange={(e) => updateDesign('backgroundColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black p-2 w-full outline-none focus:bg-gray-50 uppercase"
                                                    />
                                                    {backgroundColor && (
                                                        <button onClick={() => updateDesign('backgroundColor', '')} className="border-2 border-black px-2 hover:bg-black hover:text-white transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    { }
                                    <div>
                                        <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-4 border-b border-gray-100 pb-1">Identity Tags</h4>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {designTags.map((tag, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-gray-100 border border-black px-2 py-1 group/tag">
                                                    <input
                                                        type="text"
                                                        value={tag}
                                                        onChange={(e) => editTag(idx, e.target.value)}
                                                        className="bg-transparent font-mono text-[10px] uppercase font-bold outline-none w-20"
                                                    />
                                                    <button onClick={() => removeTag(idx)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={addTag} className="border border-dashed border-gray-400 px-2 py-1 text-[10px] font-mono hover:border-black transition-colors">
                                                + ADD_TAG
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                { }
                                <div className={`border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center relative overflow-hidden group/prev min-h-[420px] transition-all duration-500
                                        ${activeProtocol === 'AMBER' ? 'theme-amber bg-[#0d0d0d]' : ''}
                                        ${activeProtocol === 'VOID' ? 'theme-void bg-black' : ''}
                                        ${activeProtocol === 'SHADOW' ? 'theme-shadow bg-[#010203]' : ''}
                                        ${activeProtocol === 'NEON' ? 'theme-neon bg-[#0a0015]' : ''}
                                        ${activeProtocol === 'DEFAULT' ? 'bg-gray-50' : ''}
                                    `}>
                                    <div className="absolute top-2 left-2 font-mono text-[8px] text-gray-300">LIVE_PREVIEW_TARGET</div>
                                    <div className="absolute inset-0 transition-colors" style={{ backgroundColor: pageColor, opacity: pageColor ? 1 : 0, zIndex: 0 }}></div>
                                    <div className="w-full max-w-[280px] bg-white border-2 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative transition-all card-texture z-10"
                                        style={{
                                            backgroundColor: backgroundColor || '#ffffff',
                                            borderColor: borderColor || '#000000',
                                            boxShadow: `8px 8px 0px 0px ${accentColor}`
                                        }}
                                    >
                                        <div className="absolute top-0 right-0 w-8 h-8 transition-colors" style={{ backgroundColor: accentColor, clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}></div>
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-20 h-20 rounded-full border-2 border-black mb-4 p-1 relative" style={{ borderColor: borderColor || '#000000' }}>
                                                <div className="absolute inset-0 rounded-full border-2 animate-spin-slow" style={{ borderColor: accentColor, borderTopColor: 'transparent', borderRightColor: accentColor, borderBottomColor: accentColor, borderLeftColor: accentColor }}></div>
                                                <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                                                    <img src={profileImage || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"} alt="Profile" className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                            <div className="font-mono font-black uppercase text-sm mb-1" style={{ color: borderColor || '#000000' }}>@{username.replace('@', '')}</div>
                                            <div className="flex flex-wrap justify-center gap-1 mb-3">
                                                {designTags.slice(0, 3).map((t, i) => (
                                                    <span key={i} className="text-[8px] px-1 py-0.5 text-white font-mono uppercase" style={{ backgroundColor: i === 0 ? accentColor : (borderColor || '#000') }}>{t}</span>
                                                ))}
                                            </div>
                                            <div className="w-full h-1 bg-gray-100 mb-3" style={{ backgroundColor: `${accentColor}20` }}></div>
                                            <div className="w-full flex gap-1">
                                                <div className="flex-1 h-6 border border-black bg-gray-50 flex items-center justify-center font-mono text-[8px] uppercase group-hover/prev:bg-black group-hover/prev:text-white transition-colors" style={{ borderColor: borderColor || '#000000' }}>Join Signals</div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-8 font-mono text-[10px] text-gray-400 text-center max-w-[200px]">
                                        Real-time visual abstraction of your public profile deployment.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                    { }
                    <section id="settings" className="scroll-mt-32 pb-32">
                        <Settings
                            links={links}
                            wallets={wallets}
                            onRestore={handleRestore}
                            username={username}
                            hasRecovery={hasRecovery}
                        />
                    </section>
                </div>
            </div >
        </div >
    );
};
