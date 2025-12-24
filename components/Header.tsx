import React, { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { DonationGoal } from './DonationGoal';
import { Typewriter } from './Typewriter';
import { PriceTicker } from './PriceTicker';
interface HeaderProps {
    isLoggedIn: boolean;
    username: string;
    onLoginClick: () => void;
    onRegisterClick: () => void;
    onLogoutClick: () => void;
}
export const Header: React.FC<HeaderProps> = ({ isLoggedIn, username, onLoginClick, onRegisterClick, onLogoutClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (
        <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b-2 border-black h-16 md:h-20 shadow-md transition-all">
            <div className="flex justify-between items-center h-full px-4 md:px-6 relative">
                { }
                <div className="flex items-center gap-2 z-20 cursor-pointer" onClick={() => window.location.href = '/'}>
                    <img
                        src="https://www.getmonero.org/press-kit/symbols/monero-symbol-480.png"
                        alt="Monero Logo"
                        className="w-8 h-8 object-contain"
                    />
                    <span className="font-mono font-bold text-xl tracking-tighter hidden md:inline">GOXMR</span>
                </div>
                { }
                <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 w-full max-w-xl">
                    <DonationGoal />
                    <Typewriter
                        className="text-[10px] font-mono text-gray-500 text-center leading-tight h-3"
                        texts={[
                            "Funds: Domain, Hosting, & Infrastructure",
                            "Funds: Open Source Development & Tools",
                            "Funds: Pizza, Coffee & Occasional Beer",
                            "Funds: Keeping the Network Sovereign",
                        ]}
                    />
                </div>
                { }
                <div className="flex md:hidden items-center gap-2 mx-auto scale-90">
                    <DonationGoal />
                    <PriceTicker />
                </div>
                { }
                <div className="flex items-center gap-4 z-20">
                    { }
                    <div className="hidden md:flex items-center gap-4">
                        <PriceTicker />
                        {isLoggedIn ? (
                            <div className="flex items-center gap-2">
                                <a
                                    href={`/${username}`}
                                    target="_blank"
                                    className="bg-monero-orange text-white font-mono font-bold text-[10px] px-3 py-2 border-2 border-black hover:bg-black hover:scale-105 active:scale-95 transition-all uppercase flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                                >
                                    MY PROFILE <ArrowRight size={12} />
                                </a>
                                <button
                                    onClick={onLogoutClick}
                                    className="bg-black text-white font-mono font-bold text-[10px] px-3 py-2 hover:bg-red-600 transition-colors uppercase border-2 border-transparent"
                                >
                                    LOGOUT
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onLoginClick}
                                    className="font-mono font-bold text-sm hover:underline uppercase"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={onRegisterClick}
                                    className="bg-black text-white font-mono font-bold text-sm px-4 py-2 hover:bg-monero-orange transition-colors uppercase flex items-center gap-2"
                                >
                                    Join <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    { }
                    <button
                        className="md:hidden p-1 border-2 border-transparent hover:border-black rounded transition-all"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>
            { }
            {
                isMenuOpen && (
                    <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b-2 border-black p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                        {isLoggedIn ? (
                            <div className="flex flex-col gap-2">
                                <a
                                    href={`/${username}`}
                                    target="_blank"
                                    className="w-full bg-monero-orange text-white p-3 font-mono font-bold uppercase text-center border-2 border-transparent"
                                >
                                    View My Page
                                </a>
                                <button
                                    onClick={onLogoutClick}
                                    className="w-full bg-red-600 text-white p-3 font-mono font-bold uppercase hover:bg-red-700 text-center"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => { onLoginClick(); setIsMenuOpen(false); }}
                                    className="w-full border-2 border-black p-3 font-mono font-bold uppercase hover:bg-gray-50 text-center"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => { onRegisterClick(); setIsMenuOpen(false); }}
                                    className="w-full bg-black text-white p-3 font-mono font-bold uppercase hover:bg-monero-orange text-center flex items-center justify-center gap-2"
                                >
                                    Join Community <ArrowRight size={16} />
                                </button>
                            </>
                        )}
                    </div>
                )
            }
        </nav >
    );
};
