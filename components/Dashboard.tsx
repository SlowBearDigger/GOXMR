import React, { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Twitter, Globe, Github, Youtube, Smartphone, DollarSign, Wallet as WalletIcon, Check, Loader2, Instagram, Twitch, MessageSquare, Send, Mail, Link as LinkIcon, Zap, Shield, Cpu, ChevronDown } from 'lucide-react';
import { QrGenerator } from './QrGenerator';
import { Settings } from './Settings';
import { DashboardNav } from './DashboardNav';
import type { Link, Wallet } from '../types.ts';
const INITIAL_LINKS: Link[] = [];
const INITIAL_WALLETS: Wallet[] = [];

const AVAILABLE_ICONS = [
    { name: 'Twitter', icon: Twitter, id: 'twitter' },
    { name: 'Github', icon: Github, id: 'github' },
    { name: 'Globe', icon: Globe, id: 'globe' },
    { name: 'Youtube', icon: Youtube, id: 'youtube' },
    { name: 'Instagram', icon: Instagram, id: 'instagram' },
    { name: 'Twitch', icon: Twitch, id: 'twitch' },
    { name: 'Discord', icon: MessageSquare, id: 'discord' },
    { name: 'Telegram', icon: Send, id: 'telegram' },
    { name: 'Mail', icon: Mail, id: 'mail' },
    { name: 'Link', icon: LinkIcon, id: 'link' },
    { name: 'Zap', icon: Zap, id: 'zap' },
    { name: 'Shield', icon: Shield, id: 'shield' },
    { name: 'Cpu', icon: Cpu, id: 'cpu' },
];

const IconPicker = ({ currentIcon, onSelect }: { currentIcon: string, onSelect: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const SelectedIcon = AVAILABLE_ICONS.find(i => i.id === currentIcon)?.icon || Globe;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 bg-white dark:bg-zinc-700 border border-black dark:border-white flex items-center justify-center text-monero-orange hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
            >
                <SelectedIcon size={14} />
            </button>

            {isOpen && (
                <div className="absolute top-10 left-0 z-50 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] grid grid-cols-4 gap-2 w-48 animate-in fade-in zoom-in duration-200">
                    {AVAILABLE_ICONS.map(({ id, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => {
                                onSelect(id);
                                setIsOpen(false);
                            }}
                            className={`p-2 border border-transparent hover:border-black dark:hover:border-white hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all ${currentIcon === id ? 'bg-monero-orange/10 border-monero-orange' : ''}`}
                        >
                            <Icon size={14} className={currentIcon === id ? 'text-monero-orange' : 'dark:text-white'} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
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
    const [textColor, setTextColor] = useState('');
    const [buttonColor, setButtonColor] = useState('');
    const [activeProtocol, setActiveProtocol] = useState('DEFAULT');
    const [username, setUsername] = useState('Loading...');
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [bannerImage, setBannerImage] = useState<string | null>(null);
    const [hasRecovery, setHasRecovery] = useState(true);
    const [hasPgp, setHasPgp] = useState(false);
    const [pgpKey, setPgpKey] = useState('');
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
                setHasPgp(!!data.hasPgp);
                if (data.pgp_public_key) setPgpKey(data.pgp_public_key);
                if (data.design) {
                    if (data.design.accentColor) setAccentColor(data.design.accentColor);
                    if (data.design.backgroundColor) setBackgroundColor(data.design.backgroundColor);
                    if (data.design.pageColor) setPageColor(data.design.pageColor);
                    if (data.design.borderColor) setBorderColor(data.design.borderColor);
                    if (data.design.textColor) setTextColor(data.design.textColor);
                    if (data.design.buttonColor) setButtonColor(data.design.buttonColor);
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
        const emptyWallets = wallets.filter(w => !w.address);
        if (emptyWallets.length > 0) {
            const confirm = window.confirm(`Warning: ${emptyWallets.length} wallet(s) have no address. They will be invisible on your public profile. Proceed anyway?`);
            if (!confirm) {
                setIsDeploying(false);
                return;
            }
        }

        const designData = {
            accentColor,
            backgroundColor,
            pageColor,
            borderColor,
            textColor,
            buttonColor,
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
            if (parsed.textColor) setTextColor(parsed.textColor);
            if (parsed.buttonColor) setButtonColor(parsed.buttonColor);
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
        if (key === 'textColor') setTextColor(value);
        if (key === 'buttonColor') setButtonColor(value);
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
            <div className="flex justify-between items-end mb-8 border-b-2 border-black dark:border-zinc-800 pb-4 ml-0 lg:ml-[25%] transition-colors">
                <div>
                    <h1 className="text-4xl font-black font-mono tracking-tighter uppercase mb-2 dark:text-white">Command Center</h1>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">Manage your sovereign identity.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className={`font-mono text-xs px-4 py-2 border-2 border-black dark:border-white font-bold uppercase transition-all flex items-center gap-2 ${isDeploySuccess ? 'bg-green-500 text-white' : 'bg-black text-white dark:bg-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange hover:text-white'
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
                    <div className="font-mono text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-1 border border-green-800 dark:border-green-600 font-bold">
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
                <div className="lg:w-3/4 flex flex-col gap-12 transition-colors duration-300">
                    { }
                    <section id="identity" className="scroll-mt-32">
                        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                            <div className="bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Identity Module</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>

                            <input type="file" ref={fileInputRefBanner} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
                            <input type="file" ref={fileInputRefProfile} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile')} />

                            <div className="relative group">
                                <div className="h-48 bg-gray-100 dark:bg-zinc-800 overflow-hidden relative">
                                    {bannerImage ? (
                                        <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center font-mono text-gray-400 text-xs">
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
                                        <div className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-900 bg-gray-100 dark:bg-zinc-800 overflow-hidden shadow-lg relative">
                                            {profileImage ? (
                                                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full">
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
                                                <span className="font-mono font-bold text-lg dark:text-white">@{username}</span>
                                                <div className="px-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[8px] font-mono border border-green-200 dark:border-green-800">VERIFIED</div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 border border-gray-200 dark:border-zinc-700 font-mono">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[8px] font-black uppercase text-monero-orange">Wallet_Lookup_Handle</label>
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                            </div>
                                            <div className="flex flex-col gap-3 overflow-hidden">
                                                <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                                                    <div className="flex flex-col">
                                                        <span className="text-[7px] font-black text-gray-400 uppercase">Social_Handle</span>
                                                        <div className="text-[10px] sm:text-xs truncate dark:text-white font-bold">
                                                            <span className="text-monero-orange">@</span>{username}<span className="text-gray-400">@{(() => {
                                                                const parts = window.location.hostname.split('.');
                                                                return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                                            })()}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const rootDomain = (() => {
                                                                const parts = window.location.hostname.split('.');
                                                                return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                                            })();
                                                            navigator.clipboard.writeText(`@${username}@${rootDomain}`);
                                                        }}
                                                        className="text-[8px] font-black bg-monero-orange text-white px-2 py-1 hover:bg-black transition-colors"
                                                    >
                                                        COPY
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                                                    <div className="flex flex-col">
                                                        <span className="text-[7px] font-black text-gray-400 uppercase">Subdomain_Handle</span>
                                                        <div className="text-[10px] sm:text-xs truncate dark:text-white font-bold">
                                                            {username}<span className="text-gray-400">.{(() => {
                                                                const parts = window.location.hostname.split('.');
                                                                return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                                            })()}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const rootDomain = (() => {
                                                                const parts = window.location.hostname.split('.');
                                                                return parts.length > 2 && !window.location.hostname.includes('localhost') ? parts.slice(-2).join('.') : window.location.hostname;
                                                            })();
                                                            navigator.clipboard.writeText(`${username}.${rootDomain}`);
                                                        }}
                                                        className="text-[8px] font-black bg-monero-orange text-white px-2 py-1 hover:bg-black transition-colors"
                                                    >
                                                        COPY
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="flex-1 h-[1px] bg-gray-200 dark:bg-zinc-700"></div>
                                                <span className="text-[8px] font-mono text-gray-400 uppercase">Universal_Lookup_Active</span>
                                                <div className="flex-1 h-[1px] bg-gray-200 dark:bg-zinc-700"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 dark:border-zinc-800">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 font-mono">Display Name</label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                onBlur={handleBlur}
                                                placeholder="Enter display name..."
                                                className="w-full bg-white dark:bg-zinc-800 border-2 border-black dark:border-white p-3 font-mono text-sm focus:bg-gray-50 dark:focus:bg-zinc-700 outline-none transition-colors dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 font-mono">Sovereign Bio</label>
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                onBlur={handleBlur}
                                                placeholder="Tell your story..."
                                                className="w-full bg-white dark:bg-zinc-800 border-2 border-black dark:border-white p-3 font-mono text-sm h-32 focus:bg-gray-50 dark:focus:bg-zinc-700 outline-none transition-colors resize-none dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="signals" className="scroll-mt-32 w-full">
                        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] h-full flex flex-col">
                            <div className="bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Signals (Links)</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[600px]">
                                {links.map(link => (
                                    <div key={link.id} className="border border-black dark:border-white p-2 flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 group hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                                        <IconPicker
                                            currentIcon={link.icon || link.type || 'globe'}
                                            onSelect={(icon) => updateLink(link.id, { icon })}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={link.title}
                                                onChange={(e) => updateLink(link.id, { title: e.target.value })}
                                                className="w-full font-mono text-xs font-bold bg-transparent outline-none dark:text-white"
                                            />
                                            <input
                                                type="text"
                                                value={link.url}
                                                onChange={(e) => updateLink(link.id, { url: e.target.value })}
                                                className="w-full font-mono text-[10px] text-gray-500 dark:text-gray-400 bg-transparent outline-none"
                                            />
                                        </div>
                                        <button onClick={() => removeLink(link.id)} className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={addLink} className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 p-3 flex items-center justify-center gap-2 font-mono text-xs font-bold text-gray-400 hover:text-monero-orange hover:border-monero-orange transition-colors">
                                    <Plus size={14} /> ADD SIGNAL
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="treasury" className="scroll-mt-32 w-full">
                        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] h-full flex flex-col">
                            <div className="bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
                                <span>Treasury (Wallets)</span>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col gap-3">
                                {wallets.map(wallet => (
                                    <div key={wallet.id} className="border border-black dark:border-white p-3 bg-gray-50 dark:bg-zinc-800 flex flex-col gap-2 group hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {wallet.currency === 'XMR' ?
                                                    <div className="w-5 h-5 bg-monero-orange rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-black dark:border-white">M</div> :
                                                    <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-black dark:border-white">B</div>
                                                }
                                                <input
                                                    type="text"
                                                    value={wallet.label}
                                                    onChange={(e) => updateWallet(wallet.id, { label: e.target.value })}
                                                    className="font-mono text-xs font-bold bg-transparent outline-none dark:text-white"
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
                                                className="w-full pl-6 pr-2 py-1 font-mono text-[10px] bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 focus:border-black dark:focus:border-white outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addWallet} className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 p-3 flex items-center justify-center gap-2 font-mono text-xs font-bold text-gray-400 hover:text-monero-orange hover:border-monero-orange transition-colors">
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
                        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                            <div className="bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-xs uppercase flex justify-between items-center">
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
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-4 border-b border-gray-100 dark:border-zinc-800 pb-1">Visual Protocol (Skins)</h4>
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
                                                            ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black shadow-[2px_2px_0px_0px_rgba(242,104,34,1)]'
                                                            : 'border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white dark:bg-zinc-800'}`}
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
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={accentColor.toUpperCase()}
                                                    onChange={(e) => updateDesign('accentColor', e.target.value)}
                                                    className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
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
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={borderColor ? borderColor.toUpperCase() : ''}
                                                        placeholder="DEFAULT"
                                                        onChange={(e) => updateDesign('borderColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
                                                    />
                                                    {borderColor && (
                                                        <button onClick={() => updateDesign('borderColor', '')} className="border-2 border-black dark:border-white px-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Color: Text */}
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Text Color</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={textColor || '#000000'}
                                                    onChange={(e) => updateDesign('textColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={textColor ? textColor.toUpperCase() : ''}
                                                        placeholder="DEFAULT"
                                                        onChange={(e) => updateDesign('textColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
                                                    />
                                                    {textColor && (
                                                        <button onClick={() => updateDesign('textColor', '')} className="border-2 border-black dark:border-white px-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
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
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={pageColor ? pageColor.toUpperCase() : ''}
                                                        placeholder="THEME_DEFAULT"
                                                        onChange={(e) => updateDesign('pageColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
                                                    />
                                                    {pageColor && (
                                                        <button onClick={() => updateDesign('pageColor', '')} className="border-2 border-black dark:border-white px-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
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
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={backgroundColor ? backgroundColor.toUpperCase() : ''}
                                                        placeholder="DEFAULT"
                                                        onChange={(e) => updateDesign('backgroundColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
                                                    />
                                                    {backgroundColor && (
                                                        <button onClick={() => updateDesign('backgroundColor', '')} className="border-2 border-black dark:border-white px-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Color: Buttons */}
                                        <div>
                                            <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-2">Button/Link Color</h4>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="color"
                                                    value={buttonColor || '#000000'}
                                                    onChange={(e) => updateDesign('buttonColor', e.target.value)}
                                                    className="w-10 h-10 border-2 border-black dark:border-white cursor-pointer bg-transparent rounded-none flex-shrink-0"
                                                />
                                                <div className="flex gap-1 flex-1">
                                                    <input
                                                        type="text"
                                                        value={buttonColor ? buttonColor.toUpperCase() : ''}
                                                        placeholder="MATCHES_ACCENT"
                                                        onChange={(e) => updateDesign('buttonColor', e.target.value)}
                                                        className="font-mono text-xs border-2 border-black dark:border-white p-2 w-full outline-none focus:bg-gray-50 dark:focus:bg-zinc-700 uppercase dark:text-white dark:bg-zinc-800"
                                                    />
                                                    {buttonColor && (
                                                        <button onClick={() => updateDesign('buttonColor', '')} className="border-2 border-black dark:border-white px-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    { }
                                    <div>
                                        <h4 className="font-mono font-bold text-xs uppercase text-gray-400 mb-4 border-b border-gray-100 dark:border-zinc-800 pb-1">Identity Tags</h4>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {designTags.map((tag, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 border border-black dark:border-white px-2 py-1 group/tag">
                                                    <input
                                                        type="text"
                                                        value={tag}
                                                        onChange={(e) => editTag(idx, e.target.value)}
                                                        className="bg-transparent font-mono text-[10px] uppercase font-bold outline-none w-20 dark:text-white"
                                                    />
                                                    <button onClick={() => removeTag(idx)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={addTag} className="border border-dashed border-gray-400 dark:border-zinc-600 px-2 py-1 text-[10px] font-mono hover:border-black dark:hover:border-white transition-colors dark:text-gray-400 dark:hover:text-white">
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
                                            <div className="font-mono font-black uppercase text-sm mb-1" style={{ color: textColor || borderColor || '#000000' }}>@{username.replace('@', '')}</div>
                                            <div className="flex flex-wrap justify-center gap-1 mb-3">
                                                {designTags.slice(0, 3).map((t, i) => (
                                                    <span key={i} className="text-[8px] px-1 py-0.5 text-white font-mono uppercase" style={{ backgroundColor: i === 0 ? accentColor : (borderColor || '#000'), color: i === 0 ? '#fff' : (textColor || '#fff') }}>{t}</span>
                                                ))}
                                            </div>
                                            <div className="w-full h-1 bg-gray-100 mb-3" style={{ backgroundColor: `${accentColor}20` }}></div>
                                            <div className="w-full flex gap-1">
                                                <div className="flex-1 h-6 border border-black bg-gray-50 flex items-center justify-center font-mono text-[8px] uppercase group-hover/prev:bg-black group-hover/prev:text-white transition-colors"
                                                    style={{
                                                        borderColor: borderColor || '#000000',
                                                        backgroundColor: buttonColor || 'transparent',
                                                        color: buttonColor ? (textColor || '#fff') : 'inherit'
                                                    }}>Join Signals</div>
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
                            hasPgp={hasPgp}
                            pgpKey={pgpKey}
                        />
                    </section>
                </div>
            </div >
        </div >
    );
};
