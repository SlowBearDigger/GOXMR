import React, { useState, useEffect } from 'react';
import { Lock, Send, Loader2, Check } from 'lucide-react';
import * as openpgp from 'openpgp';
import { AltchaWidget } from './AltchaWidget';
import { showToast } from './Toast';

interface EncryptedContactFormProps {
    username: string;
    accentColor?: string;
}

export const EncryptedContactForm: React.FC<EncryptedContactFormProps> = ({ username, accentColor }) => {
    const AC = accentColor || '#F26822';
    const [pgpKey, setPgpKey] = useState('');
    const [senderName, setSenderName] = useState('');
    const [message, setMessage] = useState('');
    const [altchaPayload, setAltchaPayload] = useState('');
    const [status, setStatus] = useState<'idle' | 'encrypting' | 'sending' | 'sent' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetch(`/api/pgp/${username}/key`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.pgp_public_key) setPgpKey(d.pgp_public_key); })
            .catch(() => {});
    }, [username]);

    if (!pgpKey) return null;

    const handleSend = async () => {
        if (!message.trim()) return;
        if (!altchaPayload) { setErrorMsg('Complete the security challenge first'); setStatus('error'); return; }

        setStatus('encrypting');
        setErrorMsg('');

        try {
            // Encrypt message client-side with recipient's PGP key
            const publicKey = await openpgp.readKey({ armoredKey: pgpKey });
            const encrypted = await openpgp.encrypt({
                message: await openpgp.createMessage({ text: message }),
                encryptionKeys: publicKey
            }) as string;

            setStatus('sending');
            const res = await fetch(`/api/user/${username}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_name: senderName.trim() || undefined,
                    encrypted_content: encrypted,
                    altcha: altchaPayload
                })
            });

            const data = await res.json();
            if (res.ok) {
                setStatus('sent');
                showToast('Message sent securely', 'success');
                setMessage('');
                setSenderName('');
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message);
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="border-2 border-black dark:border-white p-4 bg-white/90 dark:bg-zinc-900/90" style={{ boxShadow: `4px 4px 0px 0px ${AC}` }}>
            <div className="flex items-center gap-2 mb-4">
                <Lock size={16} style={{ color: AC }} />
                <h3 className="font-mono font-black text-sm uppercase">Encrypted Message</h3>
            </div>

            {status === 'sent' ? (
                <div className="text-center py-6">
                    <Check size={32} className="mx-auto mb-2 text-green-500" />
                    <p className="font-mono text-sm font-bold">Message sent securely</p>
                    <p className="font-mono text-[10px] text-gray-500 mt-1">Only @{username} can decrypt it with their PGP key</p>
                    <button onClick={() => setStatus('idle')} className="mt-3 font-mono text-xs text-monero-orange hover:underline">
                        Send another
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        Your message will be PGP-encrypted before leaving your browser. Only @{username} can read it.
                    </p>

                    <input
                        type="text"
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full border-2 border-black dark:border-white p-2 font-mono text-xs bg-white dark:bg-zinc-800 dark:text-white"
                        maxLength={50}
                    />

                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Type your message..."
                        rows={4}
                        className="w-full border-2 border-black dark:border-white p-2 font-mono text-xs resize-none bg-white dark:bg-zinc-800 dark:text-white"
                        maxLength={5000}
                    />
                    <div className="text-right font-mono text-[9px] text-gray-400 dark:text-zinc-500 -mt-2">{message.length}/5000</div>

                    <AltchaWidget onVerify={(payload: string) => setAltchaPayload(payload)} />

                    {errorMsg && <p className="font-mono text-[10px] text-red-500 dark:text-red-400">{errorMsg}</p>}

                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || status === 'encrypting' || status === 'sending'}
                        className="w-full font-mono text-xs font-black uppercase py-2.5 border-2 border-black text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: AC }}
                    >
                        {status === 'encrypting' ? <><Loader2 size={12} className="animate-spin" /> Encrypting...</> :
                         status === 'sending' ? <><Loader2 size={12} className="animate-spin" /> Sending...</> :
                         <><Send size={12} /> Send Encrypted Message</>}
                    </button>
                </div>
            )}
        </div>
    );
};
