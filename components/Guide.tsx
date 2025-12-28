import React from 'react';
import { Shield, ArrowRight, Lock, Key, QrCode, Wallet, Code, User, Settings, Info, Zap, Globe, Cpu, Music } from 'lucide-react';
import { GlitchText } from './GlitchText';

const GuideSection = ({ icon: Icon, title, description, children }: { icon: any, title: string, description: string, children?: React.ReactNode }) => (
    <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] p-6 group hover:translate-x-1 hover:-translate-y-1 transition-all duration-200">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-monero-orange text-white border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-mono font-black text-xl uppercase dark:text-white leading-none">{title}</h3>
                <p className="font-mono text-[10px] text-monero-orange font-bold uppercase tracking-widest mt-1">Status: Operational</p>
            </div>
        </div>
        <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
            {description}
        </p>
        {children}
    </div>
);

export const Guide: React.FC = () => {
    return (
        <div className="container mx-auto px-6 py-12 max-w-5xl">
            <div className="mb-16 text-center">
                <div className="inline-flex items-center gap-2 border border-black px-3 py-1 bg-yellow-300 transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
                    <Info size={16} />
                    <span className="font-mono text-xs font-bold uppercase">System Manual v1.0</span>
                </div>
                <GlitchText
                    text="OPERATIONS GUIDE"
                    as="h1"
                    className="text-5xl md:text-7xl font-black tracking-tighter text-black dark:text-white mb-4"
                />
                <p className="font-mono text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                    Master the tools of sovereign identity. Everything you need to know to secure your presence on the network.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GuideSection
                    icon={User}
                    title="Identity Claim"
                    description="Your journey starts by claiming a unique handle. This handle is your sovereign identity on the goxmr.click network and acts as your public profile URL."
                >
                    <ul className="text-xs font-mono space-y-2 text-gray-500 dark:text-gray-500">
                        <li className="flex items-center gap-2"><ArrowRight size={10} className="text-monero-orange" /> Pick a unique username on the landing page.</li>
                        <li className="flex items-center gap-2"><ArrowRight size={10} className="text-monero-orange" /> Register via Passkey (Biometric) or PGP for maximum security.</li>
                        <li className="flex items-center gap-2"><ArrowRight size={10} className="text-monero-orange" /> Your profile lives at: goxmr.click/yourname</li>
                    </ul>
                </GuideSection>

                <GuideSection
                    icon={Zap}
                    title="Signals (Links)"
                    description="Signals are the external connections of your identity. Link your socials, websites, or project pages with custom icons and industrial styling."
                >
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="border border-black dark:border-white p-2 text-[9px] font-mono dark:text-gray-400">
                            <span className="text-monero-orange font-bold uppercase block mb-1">Custom Icons</span>
                            Choose from a library of industrial signals.
                        </div>
                        <div className="border border-black dark:border-white p-2 text-[9px] font-mono dark:text-gray-400">
                            <span className="text-monero-orange font-bold uppercase block mb-1">Live Updates</span>
                            Changes deploy instantly to the mesh.
                        </div>
                    </div>
                </GuideSection>

                <GuideSection
                    icon={Wallet}
                    title="Treasury (Wallets)"
                    description="Manage your donation addresses. GoXMR supports a multi-chain treasury including Monero, Bitcoin, Ethereum, and more."
                >
                    <div className="bg-black/5 dark:bg-white/5 border-l-4 border-monero-orange p-3">
                        <p className="text-[10px] font-mono dark:text-gray-400">
                            Simply add your wallet addresses in the Dashboard. They will appear as secure, one-click copy targets on your public profile.
                        </p>
                    </div>
                </GuideSection>

                <GuideSection
                    icon={Globe}
                    title="Handle Resolution"
                    description="GoXMR implements the Mastodon-compatible lookup protocol. This allows wallets like Cake Wallet to resolve your handle into a crypto address."
                >
                    <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-3 bg-gray-50 dark:bg-zinc-800/50">
                        <code className="text-[11px] font-mono text-monero-orange font-bold">@yourname@goxmr.click</code>
                        <p className="text-[9px] font-mono text-gray-400 mt-2">
                            Type this into any supported wallet to automatically fetch your Monero or Bitcoin address.
                        </p>
                    </div>
                </GuideSection>

                <GuideSection
                    icon={QrCode}
                    title="QR Foundry"
                    description="Create custom, branded QR codes for your wallets. Adjust colors, shapes, and embed your own logos for a unique terminal aesthetic."
                >
                    <div className="flex gap-2 items-center mt-2">
                        <div className="w-10 h-10 border border-black dark:border-white bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:10px_10px] flex items-center justify-center">
                            <QrCode size={20} className="text-black" />
                        </div>
                        <div className="flex-1 text-[10px] font-mono text-gray-500 italic">
                            "Every code is an artifact of your brand."
                        </div>
                    </div>
                </GuideSection>

                <GuideSection
                    icon={Cpu}
                    title="Design Studio"
                    description="Personalize your profile aesthetics. Choose from pre-configured Visual Protocols (skins) or customize every color, border, and accent."
                >
                    <div className="flex flex-wrap gap-2 mt-2">
                        {['Standard_Ops', 'Void_Glitch', 'Plasma_Neon'].map(skin => (
                            <span key={skin} className="px-2 py-1 bg-black text-white dark:bg-white dark:text-black text-[9px] font-mono font-black uppercase">{skin}</span>
                        ))}
                    </div>
                </GuideSection>

                <GuideSection
                    icon={Music}
                    title="Sonic Profile"
                    description="Add an auditory dimension to your profile. Upload a 15-second loop that reflects your identity's frequency."
                >
                    <p className="text-[10px] font-mono text-gray-400 italic">
                        Audio triggers only upon user interaction to ensure network standards.
                    </p>
                </GuideSection>

                <GuideSection
                    icon={Shield}
                    title="Deep Security"
                    description="Your security is paramount. We support hardware keys (YubiKey), biometric passkeys, and PGP authentication."
                >
                    <div className="flex items-center gap-2 mt-2">
                        <Lock size={14} className="text-green-500" />
                        <span className="text-[10px] font-mono font-bold text-green-500 uppercase">End-to-End Privacy</span>
                    </div>
                    <p className="text-[9px] font-mono text-gray-400 mt-1">
                        No trackers, no cookies (except for auth session), no data harvesting.
                    </p>
                </GuideSection>
            </div>

            <div className="mt-20 border-t-2 border-black dark:border-white pt-12 text-center">
                <h2 className="font-mono font-black text-3xl uppercase mb-6 dark:text-white">Ready to deploy?</h2>
                <button
                    onClick={() => window.location.href = '/'}
                    className="bg-monero-orange text-white font-mono font-bold px-8 py-4 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase flex items-center gap-3 mx-auto"
                >
                    Join the Network <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
};
