import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X, Sun, Moon, ChevronDown, User, LogOut, Gauge, Package, Heart } from 'lucide-react';
import { DonationGoalButton } from './DonationGoal';
import { PriceTicker } from './PriceTicker';

interface HeaderProps {
    isLoggedIn: boolean;
    username: string;
    onLoginClick: () => void;
    onRegisterClick: () => void;
    onLogoutClick: () => void;
    theme?: 'light' | 'dark';
    onThemeToggle?: () => void;
    activeSection?: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity';
    onNavigate?: (section: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity') => void;
}

// brutalist shadow used across the header. Extracted so a single edit changes every callsite.
const BRUTAL_SHADOW = 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]';
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-monero-orange focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black';

export const Header: React.FC<HeaderProps> = ({ isLoggedIn, username, onLoginClick, onRegisterClick, onLogoutClick, theme, onThemeToggle, activeSection, onNavigate }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSwapsOpen, setIsSwapsOpen] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const navigate = useNavigate();
    const swapsRef = useRef<HTMLDivElement>(null);
    const accountRef = useRef<HTMLDivElement>(null);

    // Close any open dropdown on outside click or Escape — keyboard parity with mouse.
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (swapsRef.current && !swapsRef.current.contains(e.target as Node)) setIsSwapsOpen(false);
            if (accountRef.current && !accountRef.current.contains(e.target as Node)) setIsAccountOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setIsSwapsOpen(false); setIsAccountOpen(false); }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
    }, []);

    const handleNavClick = (section: 'home' | 'learn' | 'guide' | 'tools' | 'contribute' | 'swap' | 'shop' | 'activity') => {
        // #9: when App owns activeSection (it does), let it handle URL writes (hash sync). We
        // only fall back to a direct navigate if onNavigate isn't wired. Hitting navigate('/dashboard')
        // here after onNavigate would race-clear the hash that setActiveSection just set.
        if (onNavigate) {
            onNavigate(section);
        } else {
            navigate('/');
        }
        setIsMenuOpen(false);
        setIsSwapsOpen(false);
        setIsAccountOpen(false);
    };

    const handleDashboardClick = () => {
        if (onNavigate) onNavigate('home');
        navigate('/dashboard');
        setIsAccountOpen(false);
        setIsMenuOpen(false);
    };

    const navItems = [
        { name: 'Home', section: 'home' as const },
        { name: 'Learn', section: 'learn' as const },
        { name: 'Guide', section: 'guide' as const },
        { name: 'Tools', section: 'tools' as const },
        { name: 'Contribute', section: 'contribute' as const },
    ];
    const swapItems = [
        { name: 'Asset Swap', section: 'swap' as const },
        { name: 'Boutique', section: 'shop' as const },
        { name: 'Activity', section: 'activity' as const },
    ];
    const isSwapsActive = activeSection === 'swap' || activeSection === 'shop' || activeSection === 'activity';

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/90 backdrop-blur-sm border-b-2 border-black dark:border-white h-16 md:h-20 transition-all">
            <div className="flex justify-between items-center h-full px-4 md:px-6 relative gap-2">
                {/* Logo */}
                <button
                    onClick={() => handleNavClick('home')}
                    className={`flex items-center gap-2 z-20 ${FOCUS_RING}`}
                    aria-label="GOXMR home"
                >
                    <img
                        src="https://www.getmonero.org/press-kit/symbols/monero-symbol-480.png"
                        alt=""
                        className="w-8 h-8 object-contain"
                    />
                    <span className="font-mono font-bold text-xl tracking-tighter hidden md:inline dark:text-white uppercase">GOXMR</span>
                </button>

                {/* Ticker only shows on wide screens to avoid colliding with the nav */}
                <div className="hidden 2xl:flex flex-1 items-center justify-center gap-4 px-4 overflow-hidden">
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-zinc-900/50 border-2 border-black/10 dark:border-white/10 px-4 py-2 shadow-inner">
                        <DonationGoalButton />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10" />
                        <PriceTicker />
                    </div>
                </div>

                {/* Right cluster */}
                <div className="flex items-center gap-2 sm:gap-3 z-20">
                    {/* Public nav (lg+ only — collapses into the burger below 1024px) */}
                    <div className="hidden lg:flex items-center gap-5 mr-1">
                        {navItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleNavClick(item.section)}
                                className={`font-mono font-bold text-sm tracking-tight uppercase transition-colors pb-0.5 border-b-2 ${activeSection === item.section
                                    ? 'text-monero-orange border-monero-orange'
                                    : 'border-transparent hover:text-monero-orange dark:text-white'} ${FOCUS_RING}`}
                                aria-current={activeSection === item.section ? 'page' : undefined}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    {/* GET XMR dropdown — click-to-toggle so keyboard works */}
                    <div className="relative hidden sm:block" ref={swapsRef}>
                        <button
                            onClick={() => setIsSwapsOpen(o => !o)}
                            aria-haspopup="menu"
                            aria-expanded={isSwapsOpen}
                            className={`flex items-center gap-1 font-mono font-bold text-sm tracking-tight uppercase transition-colors px-3 py-2 border-2 border-black dark:border-white min-h-[44px] ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none
                                ${isSwapsActive ? 'bg-monero-orange text-white' : 'bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:text-white dark:hover:bg-monero-orange'} ${FOCUS_RING}`}
                        >
                            Get XMR <ChevronDown size={14} className={`transition-transform ${isSwapsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isSwapsOpen && (
                            <div role="menu" className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-black border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                                {swapItems.map(item => (
                                    <button
                                        key={item.name}
                                        role="menuitem"
                                        onClick={() => handleNavClick(item.section)}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 last:border-none ${activeSection === item.section ? 'text-monero-orange' : 'dark:text-white'} ${FOCUS_RING}`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isLoggedIn ? (
                        // Single account dropdown collapses Command Center + My Profile + Theme + Logout
                        <div className="relative hidden sm:block" ref={accountRef}>
                            <button
                                onClick={() => setIsAccountOpen(o => !o)}
                                aria-haspopup="menu"
                                aria-expanded={isAccountOpen}
                                className={`flex items-center gap-1.5 font-mono font-bold text-sm tracking-tight uppercase px-3 py-2 min-h-[44px] bg-monero-orange text-white border-2 border-black dark:border-white ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none transition-all ${FOCUS_RING}`}
                            >
                                <User size={14} />
                                <span className="hidden md:inline max-w-[120px] truncate">@{username}</span>
                                <ChevronDown size={14} className={`transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isAccountOpen && (
                                <div role="menu" className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-black border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                                    <div className="px-4 py-2 font-mono text-[10px] uppercase text-gray-400 dark:text-zinc-500 border-b border-black/10 dark:border-white/10">
                                        Signed in as <span className="font-bold text-monero-orange">@{username}</span>
                                    </div>
                                    <button
                                        role="menuitem"
                                        onClick={handleDashboardClick}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 dark:text-white flex items-center gap-2 ${FOCUS_RING}`}
                                    >
                                        <Gauge size={14} /> Command Center
                                    </button>
                                    <a
                                        role="menuitem"
                                        href={`/${username}`}
                                        onClick={() => setIsAccountOpen(false)}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 dark:text-white flex items-center gap-2 ${FOCUS_RING}`}
                                    >
                                        <User size={14} /> My Profile <ArrowRight size={10} className="ml-auto" />
                                    </a>
                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsAccountOpen(false); navigate('/orders'); }}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 dark:text-white flex items-center gap-2 ${FOCUS_RING}`}
                                    >
                                        <Package size={14} /> My Orders
                                    </button>
                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsAccountOpen(false); window.dispatchEvent(new CustomEvent('goxmr:support:open')); }}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 dark:text-white flex items-center gap-2 ${FOCUS_RING}`}
                                    >
                                        <Heart size={14} className="text-monero-orange" /> Support
                                    </button>
                                    {onThemeToggle && (
                                        <button
                                            role="menuitem"
                                            onClick={() => { onThemeToggle(); setIsAccountOpen(false); }}
                                            className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase hover:bg-monero-orange hover:text-white transition-colors border-b border-black/10 dark:border-white/10 dark:text-white flex items-center gap-2 ${FOCUS_RING}`}
                                        >
                                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                                        </button>
                                    )}
                                    <button
                                        role="menuitem"
                                        onClick={() => { onLogoutClick(); setIsAccountOpen(false); }}
                                        className={`w-full text-left px-4 py-3 font-mono font-bold text-xs uppercase text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2 ${FOCUS_RING}`}
                                    >
                                        <LogOut size={14} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="hidden sm:flex items-center gap-3">
                            <button
                                onClick={onLoginClick}
                                className={`font-mono font-bold text-sm hover:underline uppercase dark:text-white px-3 py-2 min-h-[44px] ${FOCUS_RING}`}
                            >
                                Login
                            </button>
                            <button
                                onClick={onRegisterClick}
                                className={`bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-sm px-4 py-2 min-h-[44px] border-2 border-black dark:border-white hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-all uppercase flex items-center gap-2 ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none ${FOCUS_RING}`}
                            >
                                Join <ArrowRight size={14} />
                            </button>
                        </div>
                    )}

                    {/* Standalone theme toggle when logged out (logged-in has it inside account menu) */}
                    {!isLoggedIn && onThemeToggle && (
                        <button
                            onClick={onThemeToggle}
                            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            className={`hidden sm:flex items-center justify-center min-h-[44px] min-w-[44px] border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all ${BRUTAL_SHADOW} hover:translate-y-1 hover:shadow-none ${FOCUS_RING}`}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    )}

                    {/* Burger — opens below lg so the tablet zone (768–1023) gets the full menu instead of cramming buttons */}
                    <button
                        className={`lg:hidden flex items-center justify-center min-h-[44px] min-w-[44px] border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${FOCUS_RING}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle Menu"
                        aria-expanded={isMenuOpen}
                    >
                        {isMenuOpen ? <X size={24} className="dark:text-white" /> : <Menu size={24} className="dark:text-white" />}
                    </button>
                </div>
            </div>

            {/* Mobile / tablet menu */}
            {isMenuOpen && (
                <div className="lg:hidden absolute top-16 md:top-20 left-0 w-full bg-white dark:bg-zinc-900 border-b-4 border-black dark:border-white p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
                    <div className="flex flex-col gap-2">
                        {navItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleNavClick(item.section)}
                                className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase transition-all active:translate-x-1 text-center ${activeSection === item.section
                                    ? 'bg-monero-orange text-white'
                                    : 'hover:bg-monero-orange hover:text-white dark:text-white'} ${FOCUS_RING}`}
                            >
                                {item.name}
                            </button>
                        ))}

                        <div className="h-px bg-black/10 dark:bg-white/10 my-1" />

                        {swapItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleNavClick(item.section)}
                                className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase transition-all active:translate-x-1 text-center ${activeSection === item.section
                                    ? 'bg-monero-orange text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                    : 'bg-black text-white hover:bg-monero-orange dark:bg-white dark:text-black dark:hover:bg-monero-orange dark:hover:text-white'} ${FOCUS_RING}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>

                    <div className="h-px bg-black/10 dark:bg-white/10 my-2" />

                    <div className="flex flex-col gap-3">
                        {isLoggedIn ? (
                            <>
                                <button
                                    onClick={handleDashboardClick}
                                    className={`w-full bg-black dark:bg-white text-white dark:text-black p-4 font-mono font-bold uppercase text-center border-2 border-black dark:border-white flex items-center justify-center gap-2 ${FOCUS_RING}`}
                                >
                                    <Gauge size={16} /> Command Center
                                </button>
                                <a
                                    href={`/${username}`}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`w-full bg-monero-orange text-white p-4 font-mono font-bold uppercase text-center border-2 border-black flex items-center justify-center gap-2 ${FOCUS_RING}`}
                                >
                                    <User size={16} /> My Profile
                                </a>
                                <button
                                    onClick={() => { setIsMenuOpen(false); navigate('/orders'); }}
                                    className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase hover:bg-gray-50 dark:hover:bg-zinc-800 text-center dark:text-white flex items-center justify-center gap-2 transition-all ${FOCUS_RING}`}
                                >
                                    <Package size={16} /> My Orders
                                </button>
                                <button
                                    onClick={() => { onLogoutClick(); setIsMenuOpen(false); }}
                                    className={`w-full bg-red-600 text-white p-4 font-mono font-bold uppercase hover:bg-red-700 text-center border-2 border-black flex items-center justify-center gap-2 ${FOCUS_RING}`}
                                >
                                    <LogOut size={16} /> Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => { onLoginClick(); setIsMenuOpen(false); }}
                                    className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase hover:bg-gray-50 dark:hover:bg-zinc-800 text-center dark:text-white transition-all ${FOCUS_RING}`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => { onRegisterClick(); setIsMenuOpen(false); }}
                                    className={`w-full bg-black dark:bg-white text-white dark:text-black p-4 font-mono font-bold uppercase border-2 border-black dark:border-white text-center flex items-center justify-center gap-2 ${FOCUS_RING}`}
                                >
                                    Join <ArrowRight size={16} />
                                </button>
                            </>
                        )}

                        {onThemeToggle && (
                            <button
                                onClick={() => { onThemeToggle(); setIsMenuOpen(false); }}
                                className={`w-full border-2 border-black dark:border-white p-4 font-mono font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black flex items-center justify-center gap-3 transition-all dark:text-white ${FOCUS_RING}`}
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
