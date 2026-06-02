import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { PayLayout } from './PayLayout';

// merchant signup. email + password (min 12 chars per backend) + optional business
// name. on success, JWT goes into localStorage and we land on the dashboard.

export const PaySignupPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError('');
        if (password.length < 12) { setError('Password must be at least 12 characters'); return; }
        if (!acceptTerms) { setError('You must accept the Terms of Use to continue'); return; }
        setLoading(true);
        try {
            const r = await fetch('/pay/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, business_name: businessName || undefined }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Signup failed');
            localStorage.setItem('goxmr_pay_token', data.token);
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
                <h1 className="font-mono font-black uppercase text-3xl tracking-tighter mb-2 italic">Start accepting XMR</h1>
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-6">No KYC. No verification. Just an email and a password.</p>

                <div className="space-y-3">
                    <Field label="Email">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-monero-orange outline-none" />
                    </Field>
                    <Field label="Password" hint="Minimum 12 characters">
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-monero-orange outline-none" />
                    </Field>
                    <Field label="Business Name (optional)" hint="Shows in the federated merchant directory if you opt in">
                        <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="ACME Corp"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-monero-orange outline-none" />
                    </Field>

                    <label className="flex items-start gap-2 text-[10px] font-mono text-gray-600 dark:text-gray-400 leading-relaxed cursor-pointer">
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)}
                            className="mt-0.5 accent-monero-orange shrink-0" />
                        <span>
                            I have read and accept the{' '}
                            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline text-monero-orange hover:no-underline">
                                Terms of Use
                            </Link>
                            . I take full responsibility for my Monero wallet credentials and any transactions processed through this account.
                        </span>
                    </label>

                    {error && <p className="text-red-500 text-xs font-mono">{error}</p>}

                    <button onClick={submit} disabled={loading || !email || password.length < 12 || !acceptTerms}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-mono text-sm font-black uppercase py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <>Create Account <ArrowRight size={14} /></>}
                    </button>

                    <p className="font-mono text-[10px] text-center text-gray-400 dark:text-gray-500 pt-2">
                        Already have an account? <Link to="/pay/login" className="text-monero-orange hover:underline">Log in</Link>
                    </p>
                </div>
            </div>
        </PayLayout>
    );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider block mb-1">{label}</span>
        {children}
        {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono">{hint}</p>}
    </label>
);
