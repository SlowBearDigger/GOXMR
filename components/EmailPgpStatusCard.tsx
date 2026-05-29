import React from 'react';
import { Mail, Lock, AlertCircle, ChevronRight } from 'lucide-react';

interface Props {
    hasPgpKey: boolean;
    hasNotificationEmail: boolean;
    onJumpToPgp?: () => void;
}

export const EmailPgpStatusCard: React.FC<Props> = ({ hasPgpKey, hasNotificationEmail, onJumpToPgp }) => {
    if (!hasNotificationEmail) {
        return (
            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Mail size={12} /> No notification email set
                </p>
                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Add one above to receive order alerts, dead-man's switch heartbeats, and DM previews.
                </p>
            </div>
        );
    }

    if (hasPgpKey) {
        return (
            <div className="border-2 border-green-500 bg-green-50 dark:bg-green-900/15 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-green-700 dark:text-green-300 flex items-center gap-2 font-black">
                    <Lock size={12} /> Email notifications are PGP-encrypted
                </p>
                <p className="font-mono text-[10px] text-green-900 dark:text-green-100 mt-1 leading-relaxed">
                    Every outbound notification is encrypted to your published public key before it
                    leaves the server. Subjects are prefixed <span className="font-bold">[PGP]</span> and
                    bodies arrive as ASCII-armoured ciphertext — decrypt with your private key in any
                    standard PGP-aware mail client.
                </p>
            </div>
        );
    }

    return (
        <div className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/15 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center gap-2 font-black">
                <AlertCircle size={12} /> Notifications go out as plaintext
            </p>
            <p className="font-mono text-[10px] text-amber-900 dark:text-amber-100 mt-1 leading-relaxed">
                You haven't published a PGP key. Order alerts and DM previews are sent in cleartext
                over SMTP. Add a public key to lock them down — the mailer detects it automatically.
            </p>
            {onJumpToPgp && (
                <button
                    onClick={onJumpToPgp}
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:underline"
                >
                    Set PGP key now <ChevronRight size={10} />
                </button>
            )}
        </div>
    );
};
