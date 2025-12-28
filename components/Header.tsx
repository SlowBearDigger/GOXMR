import React, { useState } from 'react';
import { ArrowRight, Menu, X, Sun, Moon, QrCode, ChevronDown, Wrench } from 'lucide-react';
import { DonationGoal } from './DonationGoal';
import { PriceTicker } from './PriceTicker';

interface HeaderProps {
    isLoggedIn: boolean;
    username: string;
    onLoginClick: () => void;
    onRegisterClick: () => void;
    onLogoutClick: () => void;
    theme?: 'light' | 'dark';
    onThemeToggle?: () => void;
    activeSection?: 'home' | 'learn' | 'guide' | 'tools';
    onNavigate?: (section: 'home' | 'learn' | 'guide' | 'tools') => void;
}

export const Header: React.FC<HeaderProps> = ({ isLoggedIn, username, onLoginClick, onRegisterClick, onLogoutClick, theme, onThemeToggle, activeSection, onNavigate }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isToolsOpen, setIsToolsOpen] = useState(false);

    const handleNavClick = (section: 'home' | 'learn' | 'guide' | 'tools') => {
        if (isLoggedIn && section === 'home') {
            window.location.href = '/dashboard';
        } else if (onNavigate) {
            onNavigate(section);
            window.history.pushState(null, '', '/'); // Ensure URL stays clean
        } else {
            window.location.href = '/';
        }
    };

    const navItems = [
        { name: 'Home', section: 'home' as const },
        { name: 'Learn', section: 'learn' as const },
        { name: 'Guide', section: 'guide' as const },
    ];

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/90 backdrop-blur-sm border-b-2 border-black dark:border-white h-16 md:h-20 shadow-md transition-all">
            <div className="flex justify-between items-center h-full px-4 md:px-6 relative">
                {/* Logo Section */}
                <div className="flex items-center gap-2 z-20 cursor-pointer" onClick={() => handleNavClick('home')}>
                    <img
                        src="https://www.getmonero.org/press-kit/symbols/monero-symbol-480.png"
                        alt="Monero Logo"
                        className="w-8 h-8 object-contain"
                    />
                    <span className="font-mono font-bold text-xl tracking-tighter hidden md:inline dark:text-white uppercase transition-colors">GOXMR</span>
                </div>

                {/* Center Section: Ticker & Goal (Desktop Only) */}
                <div className="hidden xl:flex flex-1 items-center justify-center gap-4 px-4 overflow-hidden">
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-zinc-900/50 border-2 border-black/10 dark:border-white/10 px-4 py-2 shadow-inner">
                        <DonationGoal />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10" />
                        <PriceTicker />
                    </div>
                </div>

                {/* Right Section: Navigation & Auth */}
                <div className="flex items-center gap-4 z-20">
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6 mr-2">
                        {navItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleNavClick(item.section)}
                                className={`font-mono font-bold text-sm tracking-tight uppercase transition-colors ${activeSection === item.section ? 'text-monero-orange' : 'hover:text-monero-orange dark:text-white'
                                    }`}
                            >
                                {item.name}
                            </button>
                        ))}

                        {/* Tools Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsToolsOpen(!isToolsOpen)}
                                onMouseEnter={() => setIsToolsOpen(true)}
                                className={`flex items-center gap-1 font-mono font-bold text-sm tracking-tight uppercase transition-colors ${activeSection === 'tools' ? 'text-monero-orange' : 'hover:text-monero-orange dark:text-white'
                                    }`}
                            >
                                Tools <ChevronDown size={14} className={`transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isToolsOpen && (
                                <div
                                    className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] py-2 z-[60]"
                                    onMouseLeave={() => setIsToolsOpen(false)}
                                >
                                    <button
                                        onClick={() => handleNavClick('tools')}
                                        className="w-full text-left px-4 py-2 hover:bg-monero-orange hover:text-white font-mono font-bold text-xs uppercase flex items-center gap-2 dark:text-white dark:hover:text-white"
                                    >
                                        <QrCode size={14} /> QR Foundry
                                    </button>
                                    <div className="px-4 py-2 border-t border-black/10 dark:border-white/10 mt-1">
                                        <span className="text-[8px] font-black uppercase opacity-30 dark:text-white">More tools pending...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center gap-2">
                        {isLoggedIn ? (
                            <div className="flex items-center gap-2">
                                <a
                                    href={`/${username}`}
                                    className="hidden sm:flex bg-monero-orange text-white font-mono font-bold text-[10px] px-3 py-2 border-2 border-black dark:border-white hover:bg-black dark:hover:bg-white dark:hover:text-black transition-all uppercase items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none"
                                >
                                    MY PROFILE <ArrowRight size={12} />
                                </a>
                                <button
                                    onClick={onLogoutClick}
                                    className="bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-[10px] px-3 py-2 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white hover:translate-y-1 hover:shadow-none transition-all uppercase"
                                >
                                    LOGOUT
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onLoginClick}
                                    className="font-mono font-bold text-sm hover:underline uppercase dark:text-white px-2 py-1"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={onRegisterClick}
                                    className="bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-sm px-4 py-2 border-2 border-black dark:border-white hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-all uppercase flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none"
                                >
                                    Join <ArrowRight size={14} />
                                </button>
                            </div>
                        )}

                        {/* Theme Toggle (ALWAYS AT THE END) */}
                        {onThemeToggle && (
                            <button
                                onClick={onThemeToggle}
                                className="p-2 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none"
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 border-2 border-black dark:border-white rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle Menu"
                    >
                        {isMenuOpen ? <X size={24} className="dark:text-white" /> : <Menu size={24} className="dark:text-white" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-[64px] left-0 w-full bg-white dark:bg-zinc-900 border-b-4 border-black dark:border-white p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 z-50">
                    <div className="flex flex-col gap-2">
                        {navItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => { handleNavClick(item.section); setIsMenuOpen(false); }}
                                className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase transition-all active:translate-x-1 text-center ${activeSection === item.section
                                    ? 'bg-monero-orange text-white'
                                    : 'hover:bg-monero-orange hover:text-white dark:text-white'
                                    }`}
                            >
                                {item.name}
                            </button>
                        ))}
                        <button
                            onClick={() => { handleNavClick('tools'); setIsMenuOpen(false); }}
                            className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase transition-all active:translate-x-1 text-center ${activeSection === 'tools'
                                ? 'bg-monero-orange text-white'
                                : 'hover:bg-monero-orange hover:text-white dark:text-white'
                                }`}
                        >
                            Tools (QR Foundry)
                        </button>
                    </div>

                    <div className="h-[2px] bg-black dark:bg-white opacity-10 my-2" />

                    <div className="flex flex-col gap-3">
                        {isLoggedIn ? (
                            <>
                                <a
                                    href={`/${username}`}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full bg-monero-orange text-white p-4 font-mono font-bold uppercase text-center border-2 border-black"
                                >
                                    My Sovereignty Page
                                </a>
                                <button
                                    onClick={() => { onLogoutClick(); setIsMenuOpen(false); }}
                                    className="w-full bg-red-600 text-white p-4 font-mono font-bold uppercase hover:bg-red-700 text-center border-2 border-black"
                                >
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => { onLoginClick(); setIsMenuOpen(false); }}
                                className="w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase hover:bg-gray-50 dark:hover:bg-zinc-800 text-center dark:text-white transition-all"
                            >
                                Connect Credentials
                            </button>
                        )}

                        {/* Mobile Theme Toggle at the end */}
                        {onThemeToggle && (
                            <button
                                onClick={() => { onThemeToggle(); setIsMenuOpen(false); }}
                                className="w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black flex items-center justify-center gap-3 transition-all dark:text-white"
                            >
                                {theme === 'dark' ? <><Sun size={20} /> Light Mode</> : <><Moon size={20} /> Dark Mode</>}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};
