import React, { useState, useEffect } from 'react';
import { Shield, BookOpen, Lock, Wallet, Cpu, Zap, Info, ChevronRight, CornerDownRight, MessageSquare, ExternalLink, ArrowRight, Share2, Globe, Heart } from 'lucide-react';
import { GlitchText } from './GlitchText';

const SECTIONS = [
    { id: 'why-node', title: 'Why Run a Node?', icon: Cpu },
    { id: 'getting-started', title: 'Getting Started', icon: Zap },
    { id: 'monero-gui', title: 'Monero GUI', icon: Wallet },
    { id: 'requirements', title: 'Requirements', icon: Info },
    { id: 'contribute', title: 'Other Ways', icon: Heart },
];

export const Contribute: React.FC = () => {
    const [activeSection, setActiveSection] = useState('why-node');

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
                    Network Status
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
                        Protocol: P2P Network <br />
                        Stat: 100% Sovereign <br />
                        Goal: Decentralization
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:w-3/4 space-y-20">
                <header className="mb-20">
                    <div className="inline-flex items-center gap-2 border border-black px-3 py-1 bg-monero-orange text-white transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
                        <Cpu size={16} />
                        <span className="font-mono text-xs font-bold uppercase">Node Operator Manual</span>
                    </div>
                    <GlitchText
                        text="CONTRIBUTE TO MONERO"
                        as="h1"
                        className="text-5xl md:text-8xl font-black tracking-tighter text-black dark:text-white mb-6 uppercase"
                    />
                    <p className="font-mono text-xl text-gray-500 dark:text-gray-400 max-w-3xl leading-relaxed">
                        Become the backbone of the privacy revolution. Running a node is the single most important way to protect the network.
                    </p>
                </header>

                {/* Section: Why Run a Node? */}
                <section id="why-node" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">01.</span> Why Run a Node?
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-4">
                        <p className="font-mono text-gray-600 dark:text-gray-400 leading-relaxed italic text-lg">
                            "A node is a device that keeps a copy of the Monero blockchain and helps broadcast transactions."
                        </p>
                        <p className="font-mono dark:text-white leading-relaxed">
                            Every time you run a node, you are helping to keep Monero decentralized and secure. You don't just use the network—you <strong>become</strong> the network.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                            <div className="border-2 border-black dark:border-white p-4 bg-yellow-50 dark:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                <span className="font-mono font-bold text-xs text-monero-orange block mb-2 uppercase flex items-center gap-2"><Lock size={12} /> Privacy Boost</span>
                                <p className="font-mono text-xs dark:text-gray-300">Using your own node prevents remote node operators from seeing your IP address or transaction requests.</p>
                            </div>
                            <div className="border-2 border-black dark:border-white p-4 bg-green-50 dark:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                                <span className="font-mono font-bold text-xs text-green-600 block mb-2 uppercase flex items-center gap-2"><Globe size={12} /> Network Security</span>
                                <p className="font-mono text-xs dark:text-gray-300">More nodes mean a more resilient network against attacks and censorship.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Getting Started */}
                <section id="getting-started" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">02.</span> Getting Started
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-6 text-gray-600 dark:text-gray-400 font-mono">
                        <p className="dark:text-white text-lg font-bold uppercase tracking-tighter">You don't need to be a hacker to run a node.</p>
                        <div className="bg-black text-white dark:bg-white dark:text-black p-6 border-2 border-black dark:border-white font-mono">
                            <ul className="space-y-4 text-sm">
                                <li className="flex items-start gap-3">
                                    <span className="text-monero-orange font-bold">STEP_01:</span>
                                    <span>Download the official Monero GUI or CLI software from getmonero.org.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-monero-orange font-bold">STEP_02:</span>
                                    <span>Choose "Advanced Mode" to have full control over your node settings.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-monero-orange font-bold">STEP_03:</span>
                                    <span>Wait for the blockchain to sync. This is where you download the history of all transactions.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Section: Monero GUI */}
                <section id="monero-gui" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">03.</span> Monero GUI (Recommended)
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <div className="p-6 bg-monero-orange/5 border-2 border-monero-orange">
                            <h4 className="font-mono font-black text-sm uppercase dark:text-white mb-4">The easiest way to contribute</h4>
                            <p className="font-mono text-sm dark:text-gray-300 mb-6">
                                The Monero GUI is the official wallet with a graphical interface. It includes a built-in node that you can start with a single click.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-black dark:border-white p-3 font-mono text-[10px] uppercase">
                                    <span className="text-monero-orange font-bold">Simple Mode:</span> Connects to a remote node. Fast browse, but less privacy.
                                </div>
                                <div className="border border-black dark:border-white p-3 font-mono text-[10px] uppercase">
                                    <span className="text-monero-orange font-bold">Advanced Mode:</span> Runs your own node. Maximum privacy & network support.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Requirements */}
                <section id="requirements" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">04.</span> Technical Requirements
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full border-2 border-black dark:border-white font-mono text-xs">
                                <thead className="bg-black text-white dark:bg-white dark:text-black">
                                    <tr>
                                        <th className="p-3 text-left">Component</th>
                                        <th className="p-3 text-left">Full Node</th>
                                        <th className="p-3 text-left">Pruned Node</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black dark:divide-white">
                                    <tr>
                                        <td className="p-3 font-bold">Disk Space</td>
                                        <td className="p-3">~240 GB (SSD Recommended)</td>
                                        <td className="p-3 text-green-600">~80 GB (Pruned)</td>
                                    </tr>
                                    <tr className="bg-monero-orange/5">
                                        <td className="p-3 font-bold">RAM</td>
                                        <td className="p-3">2-4 GB Minimum</td>
                                        <td className="p-3">2-4 GB Minimum</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-bold">Download</td>
                                        <td className="p-3">Unlimited / High Speed</td>
                                        <td className="p-3">Unlimited / High Speed</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="font-mono text-xs text-gray-500 italic">
                            * Pruned nodes offer the same security benefits while requiring much less disk space.
                        </p>
                    </div>
                </section>

                {/* Section: Other Ways */}
                <section id="contribute" className="scroll-mt-32 space-y-6 min-h-[40vh]">
                    <h2 className="font-black text-4xl font-mono uppercase dark:text-white flex items-center gap-4">
                        <span className="text-monero-orange">05.</span> Other Ways to Help
                    </h2>
                    <div className="border-l-4 border-monero-orange pl-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Share2 size={18} className="text-monero-orange" />
                                    <h3 className="font-mono font-black text-xl uppercase dark:text-white">Be a Public Peer</h3>
                                </div>
                                <p className="font-mono text-sm text-gray-500">
                                    Open <strong>Port 18080</strong> on your router to allow other nodes to connect to yours. This helps new users sync faster.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Heart size={18} className="text-red-600" />
                                    <h3 className="font-mono font-black text-xl uppercase dark:text-white">Community & Dev</h3>
                                </div>
                                <p className="font-mono text-sm text-gray-500">
                                    Donate to the CCS (Community Crowdfunding System) or contribute code to the official Monero repositories.
                                </p>
                            </div>
                        </div>
                        <div className="border-2 border-black dark:border-white p-6 bg-red-50 dark:bg-red-900/10">
                            <div className="flex items-center gap-2 mb-4 text-red-600 font-black uppercase font-mono">
                                <Info size={18} /> PRO TIP
                            </div>
                            <p className="font-mono text-xs text-red-700 dark:text-red-400 opacity-80 leading-relaxed">
                                Always keep your software updated. Monero evolves through regular network upgrades (hard forks) to enhance privacy and security. Check the official site every few months.
                            </p>
                        </div>
                    </div>
                </section>

                <footer className="mt-32 border-t-2 border-black dark:border-white pt-12 text-center space-y-8">
                    <div className="font-mono text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed mb-8">
                        "Financial privacy is a human right. By running a node, you are exercising that right and helping others do the same."
                    </div>
                    <button
                        onClick={() => window.open('https://www.getmonero.org/get-started/nodes/', '_blank')}
                        className="bg-monero-orange text-white border-2 border-black dark:border-white p-6 font-mono font-black uppercase text-lg flex flex-col items-center gap-2 mx-auto hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none active:translate-x-1 active:translate-y-1"
                    >
                        <span>GET THE MONERO GUI</span>
                        <div className="flex items-center gap-2 text-xs opacity-80">
                            DOWNLOAD FROM GETMONERO.ORG <ExternalLink size={14} />
                        </div>
                    </button>
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
