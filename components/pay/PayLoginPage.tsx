import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { PayLayout } from './PayLayout';

export const PayLoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError('');
        setLoading(true);
        try {
            const r = await fetch('/pay/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Login failed');
            localStorage.setItem('goxmr_pay_token', data.token);
            localStorage.setItem('goxmr_pay_merchant_id', String(data.merchant_id));
            navigate('/pay/dashboard');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PayLayout>
            <div className="max-w-md mx-auto px-4 py-12">
                <h1 className="font-mono font-black uppercase text-3xl tracking-tighter mb-6 italic">Merchant Login</h1>
                <div className="space-y-3">
                    <label className="block">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider block mb-1">Email</span>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm" />
                    </label>
                    <label className="block">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider block mb-1">Password</span>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm" />
                    </label>
                    {error && <p className="text-red-500 text-xs font-mono">{error}</p>}
                    <button onClick={submit} disabled={loading || !email || !password}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-mono text-sm font-black uppercase py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <>Login <ArrowRight size={14} /></>}
                    </button>
                    <p className="font-mono text-[10px] text-center text-gray-400 dark:text-gray-500 pt-2">
                        No account? <Link to="/pay/signup" className="text-monero-orange hover:underline">Sign up free</Link>
                    </p>
                </div>
            </div>
        </PayLayout>
    );
};
