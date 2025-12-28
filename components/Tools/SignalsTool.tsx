import React, { useState } from 'react';
import { Link2, Shield, Clock, Copy, Check, BarChart3, AlertCircle, Loader2, Zap } from 'lucide-react';
import { AltchaWidget } from '../AltchaWidget';

export const SignalsTool: React.FC<{ isLoggedIn: boolean; isPremium: boolean }> = ({ isLoggedIn, isPremium }) => {
    const [url, setUrl] = useState('');
    const [password, setPassword] = useState('');
    const [customCode, setCustomCode] = useState('');
    const [expiresHours, setExpiresHours] = useState('24');
    const [altchaPayload, setAltchaPayload] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [result, setResult] = useState<{ shortCode: string; fullUrl: string; expiresAt?: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        if (!url) return;
        setStatus('creating');
        setErrorMsg('');

        try {
            const token = localStorage.getItem('goxmr_token');
            const resp = await fetch('/api/tools/signal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    url,
                    password: isLoggedIn ? password : null,
                    customCode: (isLoggedIn && isPremium) ? customCode : null,
                    expiresHours: isLoggedIn ? (isPremium ? parseInt(expiresHours) : Math.min(parseInt(expiresHours), 24)) : 24,
                    altcha: altchaPayload
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to create signal');

            console.log("Signal Created Data:", data); // Debugging
            const code = data.shortCode || data.short_code;
            if (!code) throw new Error("Server returned no signal code");

            const shortUrl = `${window.location.origin}/s/${code}`;
            setResult({ shortCode: code, fullUrl: shortUrl, expiresAt: data.expiresAt });
            setStatus('success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
        }
    };

    const copyToClipboard = () => {
        if (!result) return;
        navigator.clipboard.writeText(result.fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (status === 'success' && result) {
        return (
            <div className="bg-white dark:bg-zinc-950 border-4 border-black dark:border-white p-8 animate-in zoom-in duration-300">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-green-500 p-3 border-2 border-black dark:border-white">
                        <Check size={32} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-mono font-black text-2xl uppercase dark:text-white">Signal Established</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase">Redirection link generated successfully</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-gray-100 dark:bg-zinc-900 p-4 border-2 border-black dark:border-white border-dashed relative group">
                        <div className="font-mono text-xl font-bold dark:text-white break-all pr-12">
                            {result.fullUrl}
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange transition-colors"
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="border-2 border-black dark:border-white p-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Status</div>
                            <div className="font-mono font-bold text-green-600 uppercase">Active</div>
                        </div>
                        <div className="border-2 border-black dark:border-white p-3">
                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Expires</div>
                            <div className="font-mono font-bold dark:text-white">
                                {result.expiresAt ? new Date(result.expiresAt).toLocaleString() : 'Never'}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => { setStatus('idle'); setResult(null); setUrl(''); setPassword(''); setCustomCode(''); }}
                        className="mt-8 w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors"
                    >
                        Create Another Signal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Main Input */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Target Destination</label>
                        <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full pl-12 pr-4 py-4 font-mono font-bold border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            />
                        </div>
                    </div>

                    {!isLoggedIn && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Shield size={14} className="text-blue-500" />
                                <span className="font-bold text-[10px] uppercase text-blue-700 dark:text-blue-300">Anonymous Drop</span>
                            </div>
                            <p className="text-[10px] font-bold dark:text-blue-400">
                                Anonymous signals expire in <span className="text-monero-orange">24 hours</span>.
                                Log in to create permanent links and custom aliases.
                            </p>
                        </div>
                    )}

                    {isLoggedIn && (
                        <div className="animate-in slide-in-from-left duration-300 space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center justify-between">
                                    Custom Alias (Optional)
                                    {!isPremium && <span className="text-[8px] bg-monero-orange text-white px-1 font-black">PREMIUM</span>}
                                </label>
                                <div className="flex relative">
                                    <div className="bg-gray-100 dark:bg-zinc-800 border-4 border-r-0 border-black dark:border-white px-3 flex items-center font-mono text-xs font-bold text-gray-500">
                                        s/
                                    </div>
                                    <input
                                        type="text"
                                        disabled={!isPremium}
                                        value={customCode}
                                        onChange={(e) => setCustomCode(e.target.value)}
                                        placeholder={isPremium ? "my-link" : "Pro Alias Locked"}
                                        className="flex-1 px-4 py-2 font-mono font-bold border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Password Gate (Optional)</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Require password for redirect"
                                        className="w-full pl-10 pr-4 py-2 font-mono font-bold border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Options & Actions */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Longevity Protocol</label>
                        <div className="grid grid-cols-3 border-4 border-black dark:border-white">
                            {[
                                { label: '24H', val: '24', pro: false },
                                { label: '30D', val: '720', pro: true },
                                { label: 'PERM', val: '0', pro: true }
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    disabled={(!isLoggedIn && opt.val !== '24') || (opt.pro && !isPremium)}
                                    onClick={() => setExpiresHours(opt.val)}
                                    className={`py-3 font-mono font-bold text-xs transition-colors relative group/opt ${expiresHours === opt.val
                                        ? 'bg-monero-orange text-white'
                                        : 'bg-white dark:bg-zinc-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed'
                                        } ${opt.val !== '24' ? 'border-l-4 border-black dark:border-white' : ''}`}
                                >
                                    {opt.label}
                                    {opt.pro && !isPremium && <Zap size={8} className="absolute top-1 right-1 text-monero-orange" />}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                            {expiresHours === '0' ? 'Link will never expire' : `Drops after ${expiresHours} hours`}
                        </p>
                    </div>

                    <AltchaWidget onVerify={setAltchaPayload} />

                    {status === 'error' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">{errorMsg}</p>
                        </div>
                    )}

                    <button
                        onClick={handleCreate}
                        disabled={status === 'creating' || !url || !altchaPayload}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-5 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-widest shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] active:shadow-none active:translate-y-1"
                    >
                        {status === 'creating' ? <Loader2 className="animate-spin" /> : 'Emit Signal'}
                    </button>

                    {!isPremium && isLoggedIn && (
                        <p className="text-[8px] font-mono font-black text-center uppercase tracking-widest opacity-50 dark:text-white">
                            Upgrade to <span className="text-monero-orange">Premium</span> to unlock custom aliases and permanent storage
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-8 border-t-2 border-dashed border-gray-300 dark:border-zinc-800 pt-8">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-monero-orange" />
                    <h4 className="font-mono font-bold text-sm uppercase dark:text-white tracking-widest">Signal_Analytics</h4>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-white p-6">
                    <p className="text-[10px] font-mono font-bold text-gray-500 dark:text-zinc-400 uppercase leading-relaxed">
                        <span className="text-monero-orange">Privacy-First Tracking:</span> We only record the total number of redirections (clicks).
                        No IP addresses, device signatures, browser fingerprints, or tracking cookies are ever collected.
                        Your sovereignty remains absolute.
                    </p>
                    {isLoggedIn && (
                        <p className="text-[10px] font-mono font-bold text-gray-400 mt-4 uppercase">
                            View and manage your active signals in your <a href="/dashboard" className="text-monero-orange hover:underline">Command Center</a>.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
