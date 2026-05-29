import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Shield, ArrowRight, Loader2, AlertCircle, Copy, Check, FileText, Trash2 } from 'lucide-react';
import * as openpgp from 'openpgp';

export const ResolverPage: React.FC<{ mode: 'signal' | 'drop' }> = ({ mode }) => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'loading' | 'password_required' | 'decrypting' | 'success' | 'error' | 'expired'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [data, setData] = useState<any>(null);
    const [decryptedContent, setDecryptedContent] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        resolve();
    }, [code]);

    const resolve = async (pass?: string) => {
        setStatus('loading');
        try {
            const url = mode === 'signal' ? `/api/resolve/signal/${code}` : `/api/resolve/drop/${code}`;
            // Password sent via POST body, not query params

            const fetchOpts: RequestInit = {};
            if (pass) {
                fetchOpts.method = 'POST';
                fetchOpts.headers = { 'Content-Type': 'application/json' };
                fetchOpts.body = JSON.stringify({ password: pass });
            }
            const resp = await fetch(url, fetchOpts);
            const resData = await resp.json();

            if (resp.status === 410) {
                setStatus('expired');
                return;
            }

            if (!resp.ok) {
                if (resData.requiresPassword) {
                    setStatus('password_required');
                    return;
                }
                throw new Error(resData.error || 'Failed to resolve');
            }

            if (mode === 'signal') {
                // Validate URL before redirecting
                try {
                    const parsed = new URL(resData.url);
                    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
                    window.location.href = resData.url;
                } catch {
                    setStatus('error');
                    setErrorMsg('Invalid redirect URL');
                    return;
                }
            } else {
                setData(resData);
                setStatus('password_required'); // Drops ALWAYS require a key (pass or PGP) even if not technically "gated" by server
            }
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!password) {
            setErrorMsg('Enter the decryption key first');
            setStatus('error');
            return;
        }

        if (mode === 'signal') {
            resolve(password);
            return;
        }
        // Drop Decryption
        setStatus('decrypting');
        try {
            if (data.method === 'AES') {
                const decrypted = await decryptAES(data.content, password);
                setDecryptedContent(decrypted);
            } else if (data.method === 'PGP') {
                // The "password" textarea accepts the recipient's PGP private key block.
                // openpgp.js handles decryption client-side — the cleartext never reaches us.
                const isArmored = /-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(password);
                if (!isArmored) throw new Error('Paste your PGP PRIVATE KEY BLOCK to decrypt this drop.');
                const privateKey = await openpgp.readPrivateKey({ armoredKey: password });
                const message = await openpgp.readMessage({ armoredMessage: data.content });
                const { data: plain } = await openpgp.decrypt({ message, decryptionKeys: privateKey });
                setDecryptedContent(String(plain));
            } else {
                throw new Error(`Unknown encryption method: ${data.method}`);
            }
            setStatus('success');
        } catch (err: any) {
            setErrorMsg(err?.message || 'Decryption failed. Invalid key or corrupted data.');
            setStatus('error');
        }
    };

    // Decryption supports two PBKDF2 iteration counts:
    //   - 600,000 (new format, OWASP 2024 baseline)
    //   - 100,000 (legacy format, drops created before the bump)
    // We try the new format first and fall back to legacy on AES-GCM auth failure.
    // Wrong password fails both paths and the catch in handlePasswordSubmit reports it.
    const decryptAESWithIters = async (combined: Uint8Array, pass: string, iters: number) => {
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 16 + 12);
        const data = combined.slice(16 + 12);
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']
        );
        const key = await window.crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
            keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
        );
        const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return new TextDecoder().decode(plain);
    };
    const decryptAES = async (base64: string, pass: string) => {
        const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        try { return await decryptAESWithIters(combined, pass, 600000); }
        catch { return await decryptAESWithIters(combined, pass, 100000); }
    };

    if (status === 'loading' || status === 'decrypting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-monero-orange" size={48} />
                    <p className="font-mono font-black text-xs uppercase tracking-tighter dark:text-white">
                        {status === 'decrypting' ? 'Decrypting in your browser…' : 'Resolving Sovereign Entity...'}
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <div className="max-w-md w-full border-4 border-red-600 p-8 text-center bg-red-50 dark:bg-red-900/10">
                    <Trash2 className="mx-auto text-red-600 mb-4" size={48} />
                    <h2 className="font-mono font-black text-2xl text-red-600 uppercase mb-2">Protocol Expired</h2>
                    <p className="text-sm font-bold text-red-600/80 uppercase mb-6">This signal or drop has been purged from the sovereign buffer.</p>
                    <button onClick={() => navigate('/')} className="bg-red-600 text-white font-bold py-3 px-8 uppercase hover:bg-black transition-colors">Return to Home</button>
                </div>
            </div>
        );
    }

    if (status === 'password_required') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <div className="max-w-md w-full border-4 border-black dark:border-white p-8 bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(242,104,34,1)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-monero-orange p-2 border-2 border-black dark:border-white">
                            <Lock size={24} className="text-white" />
                        </div>
                        <h2 className="font-mono font-black text-xl uppercase dark:text-white">Gatekeeper Protocol</h2>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-6 leading-tight">
                        {mode === 'signal'
                            ? 'This redirection is protected by a cryptographic gate.'
                            : data?.method === 'PGP'
                                ? 'This drop is PGP-encrypted. Paste your private key block to decrypt it in your browser.'
                                : 'This dead drop is client-side encrypted. Enter the passphrase.'}
                    </p>

                    <div className="flex flex-col gap-4">
                        {mode === 'drop' && data?.method === 'PGP' ? (
                            <textarea
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----&#10;…&#10;-----END PGP PRIVATE KEY BLOCK-----"
                                rows={8}
                                className="w-full p-4 font-mono text-[10px] border-4 border-black dark:border-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                                autoFocus
                            />
                        ) : (
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                placeholder="Enter Decryption Key"
                                className="w-full p-4 font-mono font-bold border-4 border-black dark:border-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 dark:bg-zinc-950 dark:text-white"
                                autoFocus
                            />
                        )}
                        <button
                            onClick={handlePasswordSubmit}
                            className="bg-black dark:bg-white text-white dark:text-black font-bold py-4 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors flex justify-center items-center gap-2"
                        >
                            Unlock <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'success' && mode === 'drop') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <div className="max-w-2xl w-full border-4 border-black dark:border-white p-8 bg-white dark:bg-zinc-900 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex justify-between items-start mb-8 border-b-2 border-dashed border-gray-300 dark:border-zinc-800 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-500 p-3 border-2 border-black dark:border-white">
                                <FileText size={32} className="text-white" />
                            </div>
                            <div>
                                <h2 className="font-mono font-black text-2xl dark:text-white uppercase tracking-tighter">Secure Payload</h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Decrypted successfully in sovereign buffer</p>
                            </div>
                        </div>
                        {data.burnAfterRead && (
                            <div className="bg-red-600 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                Burn_Active
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-100 dark:bg-zinc-950 p-6 border-2 border-black dark:border-white min-h-[200px] relative">
                        <pre className="font-mono text-sm dark:text-white whitespace-pre-wrap break-all">
                            {decryptedContent}
                        </pre>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(decryptedContent);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="absolute right-4 top-4 p-2 bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange transition-colors"
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                    </div>

                    <div className="mt-8 flex flex-col gap-4">
                        {data.burnAfterRead && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 p-4 flex gap-3">
                                <AlertCircle className="text-yellow-600 shrink-0" size={16} />
                                <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase leading-snug">
                                    Self-destruct protocol triggered. Content has been purged from the server memory. This link is now invalid.
                                </p>
                            </div>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            className="w-full border-4 border-black dark:border-white dark:text-white font-bold py-4 uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Destroy Workspace
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4 text-center">
            <div className="max-w-md">
                <AlertCircle className="mx-auto text-red-600 mb-4" size={48} />
                <h2 className="font-mono font-black text-2xl dark:text-white uppercase mb-4">Resolver Error</h2>
                <p className="font-mono text-sm text-gray-500 mb-8 uppercase font-bold">{errorMsg || "Unknown Error"}</p>
                <button onClick={() => navigate('/')} className="bg-black dark:bg-white text-white dark:text-black py-2 px-6 font-bold uppercase">Back to Safety</button>
            </div>
        </div>
    );
};
