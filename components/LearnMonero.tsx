import React, { useState, useEffect } from 'react';
import { Shield, BookOpen, Lock, Wallet, Cpu, Zap, Info, ChevronRight, CornerDownRight, MessageSquare, ExternalLink, ArrowRight } from 'lucide-react';
import { GlitchText } from './GlitchText';

const SECTIONS = [
    { id: 'intro', title: 'What is Monero?', icon: BookOpen },
    { id: 'why', title: 'Why Privacy?', icon: Shield },
    { id: 'start', title: 'Getting Started', icon: Zap },
    { id: 'wallets', title: 'Digital Wallets', icon: Wallet },
    { id: 'transactions', title: 'Private Transactions', icon: Lock },
    { id: 'mining', title: 'Mining (Optional)', icon: Cpu },
    { id: 'advanced', title: 'Deep Knowledge', icon: Info },
];

export const LearnMonero: React.FC = () => {
    const [activeSection, setActiveSection] = useState('intro');

    useEffect(() => {
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        const observerCallback = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        SECTIONS.forEach(section => {
            const element = document.getElementById(section.id);
            if (element) observer.observe(element);
        });

        // Special check for bottom of page to force last section active
        const handleScroll = () => {
            const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
            if (isAtBottom) {
                setActiveSection(SECTIONS[SECTIONS.length - 1].id);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 100;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="container mx-auto px-6 py-12 max-w-7xl flex flex-col lg:flex-row gap-12">
            {/* Sidebar Navigation */}
            <aside className="lg:w-1/4 lg:sticky lg:top-24 self-start space-y-2">
                <div className="border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-xs uppercase mb-4 shadow-[4px_4px_0px_0px_rgba(242,104,34,1)]">
                    Intelligence Log
                </div>
                {SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => scrollTo(section.id)}
                        className={`w-full text-left p-3 font-mono text-xs uppercase border-2 transition-all flex items-center justify-between group ${activeSection === section.id
                            ? 'border-monero-orange bg-monero-orange/10 text-monero-orange translate-x-1'
                            : 'border-black dark:border-white hover:border-monero-orange dark:text-white'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <section.icon size={14} />
                            <span>{section.title}</span>
                        </div>
                        {activeSection === section.id && <ChevronRight size={14} className="animate-pulse" />}
                    </button>
                ))}
                <div className="mt-8 p-4 border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                    <p className="font-mono text-[10px] text-gray-400 leading-tight uppercase">
                        Data: Decrypted Telemetry <br />
                        Auth: Cypher Bureau <br />
                        Protocol: 0xm-r
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:w-3/4 space-y-20">
                <header className="mb-20">
                    <div className="inline-flex items-center gap-2 border border-black px-3 py-1 bg-monero-orange text-white transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
                        <BookOpen size={16} />
                        <span className="font-mono text-xs font-bold uppercase">XMR Intelligence Briefing</span>
                    </div>
                    <GlitchText
                        text="MONERO MASTERCLASS"
                        as="h1"
                        className="text-5xl md:text-8xl font-black tracking-tighter text-black dark:text-white mb-6 uppercase"
                    />
                    <p className="font-mono text-xl text-gray-500 dark:text-gray-400 max-w-3xl leading-relaxed">
                        Privacy is a right, not a complication. Learn how to protect your financial sovereignity in a transparent world.
                    </p>
                </header>

                {/* Section: Intro */}
                <section id="intro" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">01.</span> What is Monero?
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-4">
                        <p className="font-mono text-gray-600 dark:text-gray-400 leading-relaxed italic text-lg">
                            "Monero is designed for privacy. It's digital cash for the modern age."
                        </p>
                        <p className="font-mono dark:text-white leading-relaxed">
                            Monero (often abbreviated as XMR) is a type of digital money, similar to cash you can use online, but with a strong focus on keeping your transactions private. Unlike bank transfers or other cryptocurrencies where details like amounts and addresses are visible to anyone, Monero hides these to protect your freedom.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                            <div className="border-2 border-black dark:border-white p-4 bg-yellow-50 dark:bg-zinc-800">
                                <span className="font-mono font-bold text-xs text-monero-orange block mb-2 uppercase">Core Appeal</span>
                                <p className="font-mono text-xs dark:text-gray-300">Monero's core appeal lies in keeping your financial transactions confidential, unlike more transparent blockchains like Bitcoin.</p>
                            </div>
                            <div className="border-2 border-black dark:border-white p-4 bg-green-50 dark:bg-zinc-800">
                                <span className="font-mono font-bold text-xs text-green-600 block mb-2 uppercase">Decentralization</span>
                                <p className="font-mono text-xs dark:text-gray-300">It's run by a global community of users. No single company or government controls the network.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Why Privacy */}
                <section id="why" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">02.</span> Why Privacy Matters?
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-6 text-gray-600 dark:text-gray-400 font-mono">
                        <p className="dark:text-white text-lg font-bold uppercase tracking-tighter">Privacy is not about hiding illegal activities; it's about protecting against everyday risks.</p>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-1.5 w-1.5 h-1.5 bg-monero-orange flex-shrink-0" />
                                <span>Protect against identity theft and data breaches.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1.5 w-1.5 h-1.5 bg-monero-orange flex-shrink-0" />
                                <span>Prevent advertisers from tracking your spending habits.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1.5 w-1.5 h-1.5 bg-monero-orange flex-shrink-0" />
                                <span>Stop others from knowing your wallet balance or donation history.</span>
                            </li>
                        </ul>
                        <div className="p-4 bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white font-mono text-xs">
                            <span className="flex items-center gap-2 mb-2"><Info size={14} className="text-monero-orange" /> INTEL BRIEF:</span>
                            Bitcoin transactions are like postcards. Anyone can see the content. Monero is like a sealed envelope. Only you and the receiver know what's inside.
                        </div>
                    </div>
                </section>

                {/* Section: Getting Started */}
                <section id="start" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">03.</span> Getting Started
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { title: '1. Choose Wallet', text: 'Download a beginner-friendly wallet like Cake Wallet or the Monero GUI.' },
                                { title: '2. Save Seed', text: 'Securely back up your 25-word seed phrase. Lose this, lose your funds.' },
                                { title: '3. Acquire XMR', text: 'Use exchanges like LocalMonero, Kraken, or swap services like Trocador.' },
                            ].map((step, i) => (
                                <div key={i} className="border-2 border-black dark:border-white p-4 relative group">
                                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-mono font-black text-xs">
                                        {i + 1}
                                    </div>
                                    <h4 className="font-mono font-black text-sm uppercase mb-2 dark:text-white">{step.title}</h4>
                                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{step.text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-monero-orange/5 p-6 border-2 border-monero-orange space-y-4">
                            <h4 className="font-mono font-black text-sm uppercase dark:text-white">Expert Tips for Operatives</h4>
                            <ul className="space-y-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-monero-orange" /> Start with small amounts ($10-50) to test.</li>
                                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-monero-orange" /> Never share your seed phrase with anyone or digital capture it.</li>
                                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-monero-orange" /> Use community remote nodes for faster initial sync.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Section: Wallets */}
                <section id="wallets" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">04.</span> Wallets (Your Purse)
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <CornerDownRight size={18} className="text-monero-orange" />
                                    <h3 className="font-mono font-black text-xl uppercase dark:text-white">Recommended for Beginners</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="border-2 border-black dark:border-white p-4 hover:shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono font-black text-sm uppercase dark:text-white">Cake Wallet</span>
                                            <span className="text-[8px] font-mono bg-black text-white px-1">Mobile</span>
                                        </div>
                                        <p className="font-mono text-xs text-gray-500">Mobile-friendly, supports swaps, easy interface. Best for iOS/Android users.</p>
                                    </div>
                                    <div className="border-2 border-black dark:border-white p-4 hover:shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono font-black text-sm uppercase dark:text-white">Monero GUI</span>
                                            <span className="text-[8px] font-mono bg-black text-white px-1">Desktop</span>
                                        </div>
                                        <p className="font-mono text-xs text-gray-500">Official desktop app. Includes 'Simple Mode' for quick connectivity.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800 p-6 border-2 border-black dark:border-white">
                                <h4 className="font-mono font-black text-sm uppercase mb-4 dark:text-white">Security Checklist</h4>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Firmware Updated', checked: true },
                                        { label: 'Seed Offline', checked: true },
                                        { label: '2FA Enabled (if applicable)', checked: false },
                                        { label: 'Tor/I2P Active', checked: false },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className={`w-4 h-4 border-2 border-black dark:border-white flex items-center justify-center ${item.checked ? 'bg-monero-orange' : ''}`}>
                                                {item.checked && <div className="w-2 h-2 bg-white" />}
                                            </div>
                                            <span className="font-mono text-xs text-gray-500 uppercase">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Transactions */}
                <section id="transactions" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">05.</span> Private Transactions
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <p className="font-mono dark:text-white text-lg font-bold">Monero uses three main technologies to achieve absolute privacy:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { title: 'Ring Signatures', desc: 'Mixes your transaction with others. Like blending footprints in the snow.' },
                                { title: 'Stealth Addresses', desc: 'One-time addresses for every transfer. No one can see your activity history.' },
                                { title: 'RingCT', desc: 'Masks the transaction amounts. No one knows how much was sent.' },
                            ].map((tech, i) => (
                                <div key={i} className="bg-black text-white p-4 border-2 border-monero-orange">
                                    <h4 className="font-mono font-black text-xs uppercase mb-2 text-monero-orange">{tech.title}</h4>
                                    <p className="font-mono text-[10px] opacity-70 leading-relaxed">{tech.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section: Mining */}
                <section id="mining" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">06.</span> Mining (Optional)
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-6">
                        <p className="font-mono dark:text-white">
                            Mining is how you help secure the network and earn new XMR. Unlike Bitcoin, Monero is designed to be mined on regular home computers.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-2 border-black dark:border-white font-mono text-xs">
                                <thead className="bg-black text-white dark:bg-white dark:text-black">
                                    <tr>
                                        <th className="p-3 text-left">Method</th>
                                        <th className="p-3 text-left">Difficulty</th>
                                        <th className="p-3 text-left">Stability</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black dark:divide-white">
                                    <tr>
                                        <td className="p-3">Solo Mining</td>
                                        <td className="p-3 text-red-500">EXPERT</td>
                                        <td className="p-3">Low (Lottery)</td>
                                    </tr>
                                    <tr className="bg-monero-orange/5">
                                        <td className="p-3">Pool Mining</td>
                                        <td className="p-3 text-green-600">BEGINNER</td>
                                        <td className="p-3">High (Consistent)</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Node Mining</td>
                                        <td className="p-3 text-yellow-600">MEDIUM</td>
                                        <td className="p-3">Medium</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Section: Advanced */}
                <section id="advanced" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">07.</span> Deep Knowledge
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 font-mono text-sm dark:text-gray-300">
                                <p>Ready to go deeper? Master tools like **View Keys** to selectively prove transactions, or **Subaddresses** to organize your finances with absolute isolation.</p>
                                <div className="flex gap-4">
                                    <a href="https://www.getmonero.org/" target="_blank" className="flex items-center gap-1 text-monero-orange hover:underline font-bold uppercase transition-all">Official Site <ExternalLink size={12} /></a>
                                    <a href="https://reddit.com/r/Monero" target="_blank" className="flex items-center gap-1 text-monero-orange hover:underline font-bold uppercase transition-all">Reddit Intel <ExternalLink size={12} /></a>
                                </div>
                            </div>
                            <div className="border-2 border-black dark:border-white p-6 bg-red-50 dark:bg-red-900/10">
                                <div className="flex items-center gap-2 mb-4 text-red-600 font-black uppercase font-mono">
                                    <Shield size={18} /> OPERATIONAL WARNING
                                </div>
                                <p className="font-mono text-xs text-red-700 dark:text-red-400 opacity-80 leading-relaxed">
                                    Avoid centralized exchanges that force KYC if you value absolute anonymity. Always use Tor or a VPN when broadcasting transactions to mask your IP address from nodes.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="mt-32 border-t-2 border-black dark:border-white pt-12 text-center space-y-8">
                    <div className="font-mono text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed mb-8">
                        "Stop being tracked. Start being sovereign. GoXMR is the only link-in-bio alternative that treats your privacy as a human right, not a product."
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-monero-orange text-white border-2 border-black dark:border-white p-6 font-mono font-black uppercase text-lg flex flex-col items-center gap-2 mx-auto hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none active:translate-x-1 active:translate-y-1"
                    >
                        <span>CLAIM YOUR SOVEREIGN IDENTITY</span>
                        <div className="flex items-center gap-2 text-xs opacity-80">
                            START USING GOXMR NOW <ArrowRight size={14} />
                        </div>
                    </button>
                    <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">
                        The Privacy-First Linktree Alternative
                    </p>
                </footer>
            </main>

            <style>{`
        .scroll-mt-32 {
          scroll-margin-top: 8rem;
        }
      `}</style>
        </div>
    );
};
