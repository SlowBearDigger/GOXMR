import React, { useEffect, useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Mail, Send, Lock, Eye, EyeOff, Trash2, Plus, RefreshCw, X } from 'lucide-react';
import { showToast } from './Toast';
import { useModalChrome } from '../hooks/useModalChrome';

// End-to-end PGP direct messages between GOXMR users.
// Sender encrypts in browser with recipient's pubkey (fetched from /api/user/:username).
// Server stores opaque ciphertext only. Recipient decrypts in browser with their
// private key (kept in sessionStorage for the duration of the tab).

type Msg = {
    id: number;
    encrypted_payload: string;
    subject: string | null;
    read_at: string | null;
    created_at: string;
    from_username: string | null;
};

const apiFetch = (url: string, opts?: RequestInit) => {
    const token = localStorage.getItem('goxmr_token');
    return fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(opts?.headers || {}),
        },
    });
};

export const PgpInbox: React.FC = () => {
    const [messages, setMessages] = useState<Msg[]>([]);
    const [loading, setLoading] = useState(true);
    const [composeOpen, setComposeOpen] = useState(false);

    // Decryption state
    const [unlockOpen, setUnlockOpen] = useState(false);
    const [privKeyInput, setPrivKeyInput] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [unlockedKey, setUnlockedKey] = useState<any>(null);
    const [decrypted, setDecrypted] = useState<Record<number, string | { error: string }>>({});
    const [decrypting, setDecrypting] = useState<number | null>(null);
    const unlockModalRef = useRef<HTMLDivElement>(null);
    const unlockTitleId = useId();
    useModalChrome({ isOpen: unlockOpen, onClose: () => setUnlockOpen(false), contentRef: unlockModalRef });

    // Restore unlocked key from sessionStorage (same pattern as StoreSection)
    useEffect(() => {
        const armored = sessionStorage.getItem('goxmr_pgp_priv');
        const passp = sessionStorage.getItem('goxmr_pgp_pass') || '';
        if (!armored) return;
        (async () => {
            try {
                const openpgp = await import('openpgp');
                let key = await openpgp.readPrivateKey({ armoredKey: armored });
                if (!key.isDecrypted()) key = await openpgp.decryptKey({ privateKey: key, passphrase: passp });
                setUnlockedKey(key);
            } catch { sessionStorage.removeItem('goxmr_pgp_priv'); sessionStorage.removeItem('goxmr_pgp_pass'); }
        })();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const r = await apiFetch('/api/pgp/dm/inbox');
            if (r.ok) {
                const data = await r.json();
                setMessages(data.messages || []);
            }
        } catch {}
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const unlock = async () => {
        setUnlocking(true);
        try {
            const openpgp = await import('openpgp');
            let key = await openpgp.readPrivateKey({ armoredKey: privKeyInput });
            if (!key.isDecrypted()) key = await openpgp.decryptKey({ privateKey: key, passphrase });
            setUnlockedKey(key);
            sessionStorage.setItem('goxmr_pgp_priv', privKeyInput);
            if (passphrase) sessionStorage.setItem('goxmr_pgp_pass', passphrase);
            setUnlockOpen(false);
            setPrivKeyInput('');
            setPassphrase('');
            showToast('Inbox unlocked for this session', 'success');
        } catch (e: any) {
            showToast(e?.message || 'Failed to unlock', 'error');
        }
        setUnlocking(false);
    };

    const lock = () => {
        setUnlockedKey(null);
        setDecrypted({});
        sessionStorage.removeItem('goxmr_pgp_priv');
        sessionStorage.removeItem('goxmr_pgp_pass');
    };

    const decryptMsg = async (m: Msg) => {
        if (!unlockedKey) { setUnlockOpen(true); return; }
        if (decrypted[m.id]) {
            setDecrypted(d => { const n = { ...d }; delete n[m.id]; return n; });
            return;
        }
        setDecrypting(m.id);
        try {
            const openpgp = await import('openpgp');
            const message = await openpgp.readMessage({ armoredMessage: m.encrypted_payload });
            const { data } = await openpgp.decrypt({ message, decryptionKeys: unlockedKey });
            setDecrypted(d => ({ ...d, [m.id]: String(data) }));
            if (!m.read_at) {
                apiFetch(`/api/pgp/dm/${m.id}/read`, { method: 'PUT' }).then(() => load()).catch(() => {});
            }
        } catch (e: any) {
            setDecrypted(d => ({ ...d, [m.id]: { error: e?.message || 'decrypt failed' } }));
        }
        setDecrypting(null);
    };

    const del = async (id: number) => {
        if (!confirm('Delete this message?')) return;
        await apiFetch(`/api/pgp/dm/${id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mail size={16} className="text-monero-orange" />
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white">PGP Inbox</h3>
                    {messages.filter(m => !m.read_at).length > 0 && (
                        <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-monero-orange text-white">{messages.filter(m => !m.read_at).length} new</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="text-gray-400 hover:text-monero-orange" aria-label="Refresh">
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => unlockedKey ? lock() : setUnlockOpen(true)}
                        className="font-mono text-[10px] font-bold uppercase px-2 py-1 border border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white dark:text-white flex items-center gap-1"
                    >
                        <Lock size={11} /> {unlockedKey ? 'Lock' : 'Unlock'}
                    </button>
                    <button
                        onClick={() => setComposeOpen(true)}
                        className="font-mono text-[10px] font-bold uppercase px-2 py-1 bg-monero-orange text-white hover:bg-black transition-colors flex items-center gap-1"
                    >
                        <Plus size={11} /> New
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-4 flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span className="font-mono text-xs">Loading…</span></div>
            ) : messages.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-6 text-center">
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">Inbox empty</p>
                    <p className="font-mono text-[10px] text-gray-400 mt-1">Anyone with your PGP key on their profile can send you E2E messages.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {messages.map(m => {
                        const dec = decrypted[m.id];
                        return (
                            <div key={m.id} className={`border-2 ${m.read_at ? 'border-gray-300 dark:border-zinc-700' : 'border-monero-orange'} bg-white dark:bg-zinc-900 p-3`}>
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-xs font-bold dark:text-white truncate">
                                            {m.subject || '(no subject)'}
                                        </div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                                            from <span className="text-monero-orange">@{m.from_username || 'deleted'}</span> · {new Date(m.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button
                                            onClick={() => decryptMsg(m)}
                                            disabled={decrypting === m.id}
                                            className="font-mono text-[10px] font-bold uppercase px-2 py-1 border border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white dark:text-white flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {decrypting === m.id ? <Loader2 size={10} className="animate-spin" /> : dec ? <EyeOff size={10} /> : <Eye size={10} />}
                                            {dec ? 'Hide' : 'Decrypt'}
                                        </button>
                                        <button onClick={() => del(m.id)} className="text-gray-400 hover:text-red-500" aria-label="Delete">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                {dec && (
                                    typeof dec === 'object' && 'error' in dec ? (
                                        <div className="font-mono text-[10px] text-red-500 mt-2">Decrypt failed: {dec.error}</div>
                                    ) : (
                                        <div className="font-mono text-[11px] dark:text-gray-200 bg-gray-50 dark:bg-zinc-800 p-2 mt-2 border border-black/10 dark:border-white/10 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                                            {dec as string}
                                        </div>
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Unlock modal */}
            {unlockOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={unlockTitleId}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUnlockOpen(false)} />
                    <div
                        ref={unlockModalRef}
                        tabIndex={-1}
                        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[90vh] outline-none"
                    >
                        <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-gray-50 dark:bg-zinc-800 shrink-0">
                            <h3 id={unlockTitleId} className="font-mono font-black uppercase text-base dark:text-white flex items-center gap-2"><Lock size={16} /> Unlock Inbox</h3>
                            <button onClick={() => setUnlockOpen(false)} aria-label="Close" className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                        </div>
                        <div className="p-5 space-y-3 overflow-y-auto flex-1">
                            <p className="font-mono text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                Paste your PGP <span className="font-bold">private</span> key. Stored in this tab only — never sent to server.
                            </p>
                            <textarea
                                value={privKeyInput}
                                onChange={e => setPrivKeyInput(e.target.value)}
                                placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----&#10;…&#10;-----END PGP PRIVATE KEY BLOCK-----"
                                rows={7}
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[10px] dark:text-white resize-none"
                            />
                            <input
                                type="password"
                                value={passphrase}
                                onChange={e => setPassphrase(e.target.value)}
                                placeholder="Passphrase (if any)"
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                            />
                            <button
                                onClick={unlock}
                                disabled={unlocking || !privKeyInput.trim()}
                                className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white hover:bg-monero-orange hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {unlocking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                Unlock
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} onSent={load} />}
        </div>
    );
};

const ComposeModal: React.FC<{ onClose: () => void; onSent: () => void }> = ({ onClose, onSent }) => {
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [recipientPgp, setRecipientPgp] = useState<string | null>(null);
    const [recipientError, setRecipientError] = useState('');
    const composeRef = useRef<HTMLDivElement>(null);
    const composeTitleId = useId();
    useModalChrome({ isOpen: true, onClose, contentRef: composeRef });

    // Look up the recipient's PGP key as they type
    useEffect(() => {
        const r = recipient.replace(/^@/, '').trim().toLowerCase();
        if (!r || !/^[a-z0-9_]{1,30}$/.test(r)) { setRecipientPgp(null); setRecipientError(''); return; }
        const id = setTimeout(async () => {
            try {
                const res = await fetch(`/api/user/${encodeURIComponent(r)}`);
                if (!res.ok) { setRecipientPgp(null); setRecipientError('User not found'); return; }
                const data = await res.json();
                if (!data.has_pgp) { setRecipientPgp(null); setRecipientError('User has no PGP key — cannot send encrypted message'); return; }
                // The /api/user endpoint doesn't return the actual key; we need /api/store/config which exposes pgp_public_key
                const cfgRes = await fetch(`/api/store/config/${encodeURIComponent(r)}`);
                if (cfgRes.ok) {
                    const cfg = await cfgRes.json();
                    if (cfg.pgp_public_key) {
                        setRecipientPgp(cfg.pgp_public_key);
                        setRecipientError('');
                        return;
                    }
                }
                setRecipientPgp(null);
                setRecipientError('Could not load recipient PGP key');
            } catch { setRecipientPgp(null); setRecipientError('Network error'); }
        }, 400);
        return () => clearTimeout(id);
    }, [recipient]);

    const send = async () => {
        if (!recipientPgp || !body.trim()) return;
        setSending(true);
        try {
            const openpgp = await import('openpgp');
            const publicKey = await openpgp.readKey({ armoredKey: recipientPgp });
            const message = await openpgp.createMessage({ text: body });
            const ciphertext = await openpgp.encrypt({ message, encryptionKeys: publicKey });
            const r = await apiFetch('/api/pgp/dm', {
                method: 'POST',
                body: JSON.stringify({
                    to_username: recipient.replace(/^@/, '').trim(),
                    encrypted_payload: ciphertext,
                    subject: subject.trim() || null,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Send failed');
            showToast('Message sent (encrypted)', 'success');
            onSent();
            onClose();
        } catch (e: any) {
            showToast(e?.message || 'Send failed', 'error');
        }
        setSending(false);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={composeTitleId}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                ref={composeRef}
                tabIndex={-1}
                className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[90vh] outline-none"
            >
                <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-gray-50 dark:bg-zinc-800 shrink-0">
                    <h3 id={composeTitleId} className="font-mono font-black uppercase text-base dark:text-white flex items-center gap-2"><Send size={16} /> Compose PGP DM</h3>
                    <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase tracking-wider dark:text-white block mb-1">To</label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            placeholder="@username"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                            autoFocus
                        />
                        {recipientError && <p className="text-[10px] text-red-500 mt-1 font-mono">{recipientError}</p>}
                        {recipientPgp && <p className="text-[10px] text-green-600 mt-1 font-mono flex items-center gap-1"><Lock size={9} /> Will encrypt with recipient's PGP key</p>}
                    </div>
                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase tracking-wider dark:text-white block mb-1">Subject (optional, not encrypted)</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value.slice(0, 200))}
                            placeholder="Re: trade proposal"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase tracking-wider dark:text-white block mb-1">Message</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Your message — encrypted client-side before send"
                            rows={8}
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white resize-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">{body.length} chars · encrypted before leaving your device</p>
                    </div>
                    <button
                        onClick={send}
                        disabled={sending || !recipientPgp || !body.trim()}
                        className="w-full bg-monero-orange text-white font-mono text-xs font-black uppercase py-3 border-2 border-black dark:border-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send Encrypted
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
