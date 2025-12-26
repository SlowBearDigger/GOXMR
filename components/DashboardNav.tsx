import React, { useState, useEffect } from 'react';
import { Terminal, Save, Loader2, Check } from 'lucide-react';
interface DashboardNavProps {
    activeSection: string;
    isDeploying: boolean;
    onDeploy: () => void;
    isSuccess: boolean;
}
const NAV_ITEMS = [
    { id: 'identity', label: '01_IDENTITY', status: 'OK' },
    { id: 'signals', label: '02_SIGNALS', status: 'OK' },
    { id: 'treasury', label: '03_TREASURY', status: 'OK' },
    { id: 'qr-foundry', label: '04_QR_FOUNDRY', status: 'ACTIVE' },
    { id: 'design', label: '05_DESIGN_STUDIO', status: 'READY' },
    { id: 'settings', label: '06_SECURITY_&_OPS', status: 'READY' },
];
export const DashboardNav: React.FC<DashboardNavProps> = ({ activeSection, isDeploying, onDeploy, isSuccess: deployed }) => {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };
    return (
        <div className="hidden lg:block sticky top-32 w-full self-start">
            <div className="border border-black dark:border-white bg-white dark:bg-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-colors">
                <div className="flex items-center gap-2 mb-6 border-b-2 border-dashed border-gray-200 dark:border-zinc-800 pb-2">
                    <Terminal size={16} className="dark:text-white" />
                    <h3 className="font-mono font-bold text-xs uppercase dark:text-white">SYSTEM_MONITOR</h3>
                </div>
                <div className="space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className={`w-full text-left font-mono text-xs py-2 px-2 flex justify-between items-center group transition-colors ${isActive
                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-[2px_2px_0px_0px_rgba(242,104,34,1)]'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    {isActive ? <span>{'>'}</span> : <span className="opacity-0 group-hover:opacity-50">{'>'}</span>}
                                    {item.label}
                                </span>
                                <span className={`text-[10px] ${isActive ? 'text-green-400' : 'opacity-0'}`}>
                                    [{isActive ? 'EXEC' : item.status}]
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-200 dark:border-zinc-800">
                    <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 mb-2 font-bold uppercase tracking-widest">Global Ops</div>
                    <button
                        onClick={onDeploy}
                        disabled={isDeploying}
                        className={`w-full border-2 border-black dark:border-white p-3 font-mono text-xs font-black uppercase tracking-tighter flex items-center justify-center gap-2 transition-all relative overflow-hidden active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] ${isDeploying
                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-gray-300 dark:border-zinc-700 shadow-none translate-y-[2px]'
                            : deployed
                                ? 'bg-green-500 text-white border-green-700 dark:border-green-400'
                                : 'bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange hover:text-white transition-colors'
                            }`}
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                DEPLOYING_...
                            </>
                        ) : deployed ? (
                            <>
                                <Check size={14} />
                                SYNC_COMPLETE
                            </>
                        ) : (
                            <>
                                <Save size={14} />
                                DEPLOY_CHANGES
                            </>
                        )}
                        {isDeploying && (
                            <div className="absolute bottom-0 left-0 h-1 bg-green-500 animate-progress-fast"></div>
                        )}
                    </button>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 mb-2">MEMORY_USAGE</div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-black dark:bg-monero-orange w-[45%] animate-pulse"></div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes progress-fast {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
                .animate-progress-fast {
                    animation: progress-fast 2s linear forwards;
                }
            `}</style>
        </div>
    );
};
