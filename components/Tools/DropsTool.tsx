import React, { useState } from 'react';
import { FileText, Shield, Clock, Copy, Check, Lock, AlertCircle, Loader2, Trash2, Eye, Zap } from 'lucide-react';
import { AltchaWidget } from '../AltchaWidget';
import * as openpgp from 'openpgp';

export const DropsTool: React.FC<{ isLoggedIn: boolean; isPremium: boolean }> = ({ isLoggedIn, isPremium }) => {
    const [content, setContent] = useState('');
    const [password, setPassword] = useState('');
    const [method, setMethod] = useState<'AES' | 'PGP'>('AES');
    const [pgpPublicKey, setPgpPublicKey] = useState('');
    const [burnAfterRead, setBurnAfterRead] = useState(false);
    const [expiresHours, setExpiresHours] = useState('24');
    const [altchaPayload, setAltchaPayload] = useState<string | null>(null);

    const [status, setStatus] = useState<'idle' | 'encrypting' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [result, setResult] = useState<{ dropCode: string; fullUrl: string; expiresAt?: string } | null>(null);
    const [copied, setCopied] = useState(false);

    // Client-side AES Encryption
    const encryptAES = async (text: string, pass: string) => {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(pass),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            enc.encode(text)
        );

        // Package as Base64: Salt(16) + IV(12) + Data
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    };

    const handleCreate = async () => {
        if (!content) return;
        if (method === 'PGP' && (!isLoggedIn || !isPremium || !pgpPublicKey)) {
            setErrorMsg('Professional PGP encryption requires premium status');
            setStatus('error');
            return;
        }

        setStatus('encrypting');
        setErrorMsg('');

        try {
            let encryptedBlob = '';
            if (method === 'AES') {
                encryptedBlob = await encryptAES(content, password);
            } else {
                const publicKey = await openpgp.readKey({ armoredKey: pgpPublicKey });
                encryptedBlob = (await openpgp.encrypt({
                    message: await openpgp.createMessage({ text: content }),
                    encryptionKeys: publicKey
                })) as string;
            }

            setStatus('sending');
            const token = localStorage.getItem('goxmr_token');
            const resp = await fetch('/api/tools/drop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    content: encryptedBlob,
                    method,
                    burnAfterRead: (isLoggedIn && isPremium) ? burnAfterRead : false,
                    expiresHours: isLoggedIn ? (isPremium ? parseInt(expiresHours) : Math.min(parseInt(expiresHours), 24)) : 24,
                    altcha: altchaPayload
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to create drop');

            const fullUrl = `${window.location.origin}/d/${data.dropCode}`;
            setResult({ dropCode: data.dropCode, fullUrl, expiresAt: data.expiresAt });
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
                    <div className="bg-monero-orange p-3 border-2 border-black dark:border-white">
                        <Lock size={32} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-mono font-black text-2xl uppercase dark:text-white">Dead Drop Active</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase">Encrypted package stored in sovereign buffer</p>
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

                    <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-500/20 p-4 mt-4">
                        <h4 className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 mb-2 tracking-widest flex items-center gap-2">
                            <AlertCircle size={12} /> Sovereignty Warning
                        </h4>
                        <p className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 leading-relaxed uppercase">
                            This link is the ONLY way to access the content. GOXMR cannot recover encrypted data.
                            {result.expiresAt && <span className="block mt-1">PURGE ESTIMATED: {new Date(result.expiresAt).toLocaleString()}</span>}
                        </p>
                    </div>

                    <button
                        onClick={() => { setStatus('idle'); setResult(null); setContent(''); setPassword(''); }}
                        className="mt-8 w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors"
                    >
                        Create New Drop
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Content Area */}
                <div className="md:col-span-2 flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-end mb-1">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Secure Content</label>
                            <span className="text-[10px] font-mono font-bold opacity-50 dark:text-white">{content.length} / 10000 bytes</span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value.slice(0, 10000))}
                            placeholder="Enter the sensitive payload here..."
                            className="w-full h-64 p-4 font-mono text-sm border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Longevity protocol</label>
                            <div className="grid grid-cols-3 border-4 border-black dark:border-white">
                                {['24H', '7D', '30D'].map((lbl, idx) => {
                                    const val = lbl === '24H' ? '24' : lbl === '7D' ? '168' : '720';
                                    const isPro = lbl !== '24H';
                                    return (
                                        <button
                                            key={lbl}
                                            disabled={(!isLoggedIn && isPro) || (isPro && !isPremium)}
                                            onClick={() => setExpiresHours(val)}
                                            className={`py-2 font-mono font-bold text-xs relative ${expiresHours === val ? 'bg-monero-orange text-white' : 'dark:text-white disabled:opacity-30'} ${idx > 0 ? 'border-l-4 border-black dark:border-white' : ''}`}
                                        >
                                            {lbl}
                                            {isPro && !isPremium && <Zap size={8} className="absolute top-0.5 right-0.5 text-monero-orange" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-end pb-1">
                            <button
                                onClick={() => setBurnAfterRead(!burnAfterRead)}
                                disabled={!isPremium}
                                className={`flex-1 border-4 border-black dark:border-white py-2 px-4 flex items-center justify-center gap-2 font-mono font-bold text-xs uppercase transition-colors disabled:opacity-30 relative ${burnAfterRead ? 'bg-red-600 text-white border-red-600' : 'dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                            >
                                <Trash2 size={14} />
                                {burnAfterRead ? 'Burn Active' : 'Burn After Read'}
                                {!isPremium && <Zap size={8} className="absolute top-1 right-1 text-monero-orange" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Encryption Settings */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Encryption Method</label>
                        <div className="flex border-4 border-black dark:border-white overflow-hidden">
                            <button
                                onClick={() => setMethod('AES')}
                                className={`flex-1 py-3 font-mono font-bold text-xs flex items-center justify-center gap-2 ${method === 'AES' ? 'bg-black text-white dark:bg-white dark:text-black' : 'dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                            >
                                <Lock size={14} /> AES
                            </button>
                            <button
                                onClick={() => setMethod('PGP')}
                                className={`flex-1 py-3 font-mono font-bold text-xs flex items-center justify-center gap-2 border-l-4 border-black dark:border-white relative ${method === 'PGP' ? 'bg-black text-white dark:bg-white dark:text-black' : 'dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                            >
                                <FileText size={14} /> PGP
                                {!isPremium && <Zap size={8} className="absolute top-1 right-1 text-monero-orange" />}
                            </button>
                        </div>
                    </div>

                    {method === 'AES' ? (
                        <div className="flex flex-col gap-1 animate-in fade-in duration-300">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Decryption Key</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter secret passphrase"
                                    className="w-full pl-10 pr-4 py-3 font-mono font-bold border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 animate-in fade-in duration-300">
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center justify-between">
                                Recipient Public Key
                                {!isPremium && <span className="text-[8px] bg-monero-orange text-white px-1 font-black">PREMIUM</span>}
                            </label>
                            <textarea
                                value={pgpPublicKey}
                                disabled={!isPremium}
                                onChange={(e) => setPgpPublicKey(e.target.value)}
                                placeholder={isPremium ? "-----BEGIN PGP PUBLIC KEY BLOCK----- ..." : "Sovereign PGP Encryption Locked"}
                                className="w-full h-32 p-3 font-mono text-[10px] border-4 border-black dark:border-white bg-white dark:bg-zinc-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 resize-none disabled:opacity-50"
                            />
                        </div>
                    )}

                    <AltchaWidget onVerify={setAltchaPayload} />

                    {status === 'error' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase leading-none">{errorMsg}</p>
                        </div>
                    )}

                    <button
                        onClick={handleCreate}
                        disabled={status === 'encrypting' || status === 'sending' || !content || !altchaPayload}
                        className="w-full bg-monero-orange text-white font-bold py-5 uppercase border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none transition-all flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-widest"
                    >
                        {status === 'encrypting' ? (<><Loader2 className="animate-spin" /> ENCRYPTING...</>) :
                            status === 'sending' ? (<><Loader2 className="animate-spin" /> EMITTING...</>) :
                                'Establish Drop'}
                    </button>

                    {!isPremium && isLoggedIn && (
                        <p className="text-[8px] font-mono font-black text-center uppercase tracking-widest opacity-50 dark:text-white">
                            Upgrade to <span className="text-monero-orange">Premium</span> to unlock PGP, Burn-After-Read, and permanent drops
                        </p>
                    )}

                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/30 flex gap-2 items-start">
                        <Shield size={12} className="text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-yellow-700 dark:text-yellow-400 uppercase leading-tight">
                            Encryption occurs strictly client-side. The cleartext content NEVER leaves your browser buffer.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-8 border-t-2 border-dashed border-gray-300 dark:border-zinc-800 pt-8">
                <div className="flex items-center gap-2 mb-4">
                    <Shield size={18} className="text-monero-orange" />
                    <h4 className="font-mono font-bold text-sm uppercase dark:text-white tracking-widest">Sovereignty_Log</h4>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-white p-6">
                    <p className="text-[10px] font-mono font-bold text-gray-500 dark:text-zinc-400 uppercase leading-relaxed">
                        <span className="text-monero-orange">Zero-Knowledge Protocol:</span> Drops are stored as encrypted blobs.
                        We record ZERO analytics for individual drops. There are no visit counters, no IP logs, and no metadata retained beyond the expiration date.
                        Once a drop is retrieved (if Burn After Read is enabled) or expires, it is purged forever from the physical storage disks.
                    </p>
                </div>
            </div>
        </div>
    );
};

// Re-using icon for clarity in component
const Key = ({ className, size }: { className?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.5-2.5" />
    </svg>
);
