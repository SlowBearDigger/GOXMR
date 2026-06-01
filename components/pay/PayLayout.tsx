import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, LogOut, FileText, LayoutDashboard, KeyRound } from 'lucide-react';

// shared chrome for all /pay/* pages. logo + nav + dashboard logout shortcut.
// auth state comes from localStorage('goxmr_pay_token'); pages that need auth
// gate themselves by reading it on mount and redirecting on absence.

export const PayLayout: React.FC<{ children: React.ReactNode; bare?: boolean }> = ({ children, bare = false }) => {
    const navigate = useNavigate();
    const token = typeof window !== 'undefined' ? localStorage.getItem('goxmr_pay_token') : null;
    const logout = () => {
        localStorage.removeItem('goxmr_pay_token');
        localStorage.removeItem('goxmr_pay_merchant_id');
        navigate('/pay');
    };
    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 dark:text-white">
            {!bare && (
                <header className="border-b-2 border-black dark:border-white">
                    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                        <Link to="/pay" className="flex items-center gap-2 group">
                            <div className="bg-monero-orange p-1.5 border-2 border-black dark:border-white">
                                <Zap size={16} className="text-white" />
                            </div>
                            <span className="font-mono font-black uppercase text-sm tracking-tighter">GoXMR_Pay</span>
                        </Link>
                        <nav className="flex items-center gap-2">
                            <Link to="/pay/docs" className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-transparent hover:border-black dark:hover:border-white flex items-center gap-1.5">
                                <FileText size={11} /> Docs
                            </Link>
                            {token ? (
                                <>
                                    <Link to="/pay/dashboard" className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white flex items-center gap-1.5">
                                        <LayoutDashboard size={11} /> Dashboard
                                    </Link>
                                    <button onClick={logout} className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-transparent text-gray-500 hover:text-red-500 flex items-center gap-1.5">
                                        <LogOut size={11} /> Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/pay/login" className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-transparent hover:border-black dark:hover:border-white flex items-center gap-1.5">
                                        <KeyRound size={11} /> Login
                                    </Link>
                                    <Link to="/pay/signup" className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange">
                                        Sign Up Free
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>
            )}
            <main>{children}</main>
            {!bare && (
                <footer className="border-t border-gray-200 dark:border-zinc-800 mt-12 py-6 text-center font-mono text-[10px] text-gray-400 dark:text-gray-500">
                    GoXMR Pay · Non-custodial Monero payment gateway · 0% fees · Open source
                </footer>
            )}
        </div>
    );
};

// shared API helper for merchant-authenticated requests.
// throws on non-2xx so call sites can use try/catch and react to errors.
export async function payApi(path: string, opts: RequestInit = {}) {
    const token = localStorage.getItem('goxmr_pay_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(path, { ...opts, headers });
    if (!r.ok) {
        let msg = 'Request failed (' + r.status + ')';
        try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
    }
    return r.json();
}
