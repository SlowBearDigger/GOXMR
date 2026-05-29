import React, { useState, useEffect } from 'react';
import { Mail, Trash2, Lock, Eye, Loader2, X } from 'lucide-react';
import { showToast } from './Toast';

interface Message {
    id: number;
    sender_name: string;
    encrypted_content: string;
    is_read: number;
    created_at: string;
    decrypted?: string;
}

const apiFetch = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('goxmr_token');
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
        },
    });
};

export const MessageInbox: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const [decryptingId, setDecryptingId] = useState<number | null>(null);

    // Inline decrypt modal state
    const [decryptTarget, setDecryptTarget] = useState<Message | null>(null);
    const [privateKeyInput, setPrivateKeyInput] = useState('');
    const [passphraseInput, setPassphraseInput] = useState('');

    useEffect(() => { loadMessages(); }, []);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/me/messages');
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setUnread(data.unread || 0);
            }
        } catch { }
        setLoading(false);
    };

    const openDecryptModal = (msg: Message) => {
        setDecryptTarget(msg);
        setPrivateKeyInput('');
        setPassphraseInput('');
    };

    const closeDecryptModal = () => {
        setDecryptTarget(null);
        setPrivateKeyInput('');
        setPassphraseInput('');
    };

    const handleDecrypt = async () => {
        if (!decryptTarget || !privateKeyInput.trim()) return;

        setDecryptingId(decryptTarget.id);
        try {
            const openpgp = await import('openpgp');
            const privateKey = passphraseInput
                ? await openpgp.decryptKey({ privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyInput }), passphrase: passphraseInput })
                : await openpgp.readPrivateKey({ armoredKey: privateKeyInput });

            const message = await openpgp.readMessage({ armoredMessage: decryptTarget.encrypted_content });
            const { data: decrypted } = await openpgp.decrypt({ message, decryptionKeys: privateKey });

            setMessages(prev => prev.map(m => m.id === decryptTarget.id ? { ...m, decrypted: decrypted as string } : m));

            // Mark as read
            await apiFetch(`/api/me/messages/${decryptTarget.id}/read`, { method: 'PUT' });
            showToast('Message decrypted', 'success');
            closeDecryptModal();
        } catch (err: any) {
            showToast('Decryption failed. Check your private key.', 'error');
        }
        setDecryptingId(null);
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await apiFetch(`/api/me/messages/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessages(prev => prev.filter(m => m.id !== id));
                showToast('Message deleted', 'success');
            }
        } catch {
            showToast('Failed to delete', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" size={20} />
                <span className="ml-2 font-mono text-xs dark:text-gray-300">Loading messages...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mail size={16} className="text-monero-orange" />
                    <span className="font-mono font-bold text-xs uppercase dark:text-white">
                        Encrypted Inbox {unread > 0 && <span className="bg-monero-orange text-white text-[10px] px-1.5 py-0.5 ml-1">{unread} new</span>}
                    </span>
                </div>
            </div>

            {messages.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-700">
                    <Mail size={32} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">No encrypted messages yet</p>
                    <p className="font-mono text-[10px] text-gray-400 dark:text-zinc-500">Messages from your profile visitors will appear here</p>
                </div>
            ) : (
                messages.map(msg => (
                    <div key={msg.id} className={`border-2 ${msg.is_read ? 'border-gray-300 dark:border-zinc-700' : 'border-black dark:border-white'} bg-white dark:bg-zinc-900 p-4`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-mono font-bold text-sm dark:text-white">{msg.sender_name || 'Anonymous'}</div>
                                <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{new Date(msg.created_at).toLocaleString()}</div>
                            </div>
                            <div className="flex gap-2">
                                {!msg.decrypted && (
                                    <button
                                        onClick={() => openDecryptModal(msg)}
                                        disabled={decryptingId === msg.id}
                                        aria-label="Decrypt message"
                                        className="p-2.5 border border-black dark:border-white hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors focus-visible:ring-2 focus-visible:ring-monero-orange"
                                        title="Decrypt"
                                    >
                                        {decryptingId === msg.id ? <Loader2 size={14} className="animate-spin dark:text-white" /> : <Eye size={14} className="dark:text-white" />}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(msg.id)}
                                    aria-label="Delete message"
                                    className="p-2.5 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {msg.decrypted ? (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 font-mono text-xs whitespace-pre-wrap dark:text-green-300">
                                {msg.decrypted}
                            </div>
                        ) : (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 font-mono text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Lock size={12} /> PGP-encrypted — click decrypt to read
                            </div>
                        )}
                    </div>
                ))
            )}

            {/* PGP Decrypt Modal */}
            {decryptTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] w-full max-w-lg p-6 relative">
                        <button
                            onClick={closeDecryptModal}
                            aria-label="Close"
                            className="absolute top-3 right-3 p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X size={18} className="dark:text-white" />
                        </button>

                        <div className="flex items-center gap-2 mb-4">
                            <Lock size={16} className="text-monero-orange" />
                            <h3 className="font-mono font-black text-sm uppercase dark:text-white">Decrypt Message</h3>
                        </div>

                        <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-4 uppercase">
                            From: {decryptTarget.sender_name || 'Anonymous'} — {new Date(decryptTarget.created_at).toLocaleString()}
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="font-mono text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">PGP Private Key *</label>
                                <textarea
                                    value={privateKeyInput}
                                    onChange={e => setPrivateKeyInput(e.target.value)}
                                    placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----&#10;..."
                                    rows={6}
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-3 font-mono text-[11px] dark:text-white resize-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-monero-orange outline-none"
                                />
                            </div>

                            <div>
                                <label className="font-mono text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">Passphrase (if key is protected)</label>
                                <input
                                    type="password"
                                    value={passphraseInput}
                                    onChange={e => setPassphraseInput(e.target.value)}
                                    placeholder="Leave empty if none"
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-3 font-mono text-xs dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-monero-orange outline-none"
                                />
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-2 flex gap-2 items-start">
                                <Lock size={12} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                <p className="font-mono text-[9px] text-yellow-700 dark:text-yellow-300 uppercase leading-tight">
                                    Your private key never leaves your browser. Decryption happens client-side only.
                                </p>
                            </div>

                            <button
                                onClick={handleDecrypt}
                                disabled={!privateKeyInput.trim() || decryptingId === decryptTarget.id}
                                className="w-full bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase py-3 border-2 border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-monero-orange"
                            >
                                {decryptingId === decryptTarget.id ? <><Loader2 size={14} className="animate-spin" /> Decrypting...</> : <><Eye size={14} /> Decrypt Message</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
