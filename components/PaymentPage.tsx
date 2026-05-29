import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { showToast } from './Toast';

export const PaymentPage: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const [searchParams] = useSearchParams();
    const initialAmount = searchParams.get('amount') || '';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [xmrAddress, setXmrAddress] = useState('');
    const [amount, setAmount] = useState(initialAmount);
    const [copied, setCopied] = useState(false);
    const [accentColor, setAccentColor] = useState('#F26822');

    const qrRef = useRef<HTMLDivElement>(null);
    const qrCodeRef = useRef<QRCodeStyling | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`/api/user/${username}`);
                if (!res.ok) throw new Error('User not found');
                const data = await res.json();
                setDisplayName(data.display_name || data.username);
                setProfileImage(data.profile_image || '');

                // Load user's QR design customization
                const userQr = data.design?.qrDesign || {};
                const ac = data.design?.accentColor || '#F26822';
                setAccentColor(ac);

                const xmrWallet = data.wallets?.find((w: any) => w.currency === 'XMR');
                if (!xmrWallet?.address) throw new Error('No XMR wallet configured');
                setXmrAddress(xmrWallet.address);

                // Create QR with user's custom design
                qrCodeRef.current = new QRCodeStyling({
                    width: 220,
                    height: 220,
                    type: 'svg',
                    data: `monero:${xmrWallet.address}`,
                    margin: 8,
                    qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'Q' },
                    dotsOptions: {
                        type: (userQr.shape as any) || 'extra-rounded',
                        color: userQr.color || ac
                    },
                    backgroundOptions: { color: userQr.backgroundColor || '#ffffff' },
                    cornersSquareOptions: { type: (userQr.cornerType as any) || 'extra-rounded', color: '#000' },
                    cornersDotOptions: { type: 'dot', color: '#000' },
                    ...(userQr.logoUrl ? { image: userQr.logoUrl, imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 2 } } : {})
                });

                if (qrRef.current) {
                    qrRef.current.innerHTML = '';
                    qrCodeRef.current.append(qrRef.current);
                }
            } catch (err: any) {
                setError(err.message);
            }
            setLoading(false);
        };
        if (username) fetchUser();
    }, [username]);

    useEffect(() => {
        if (!xmrAddress || !qrCodeRef.current) return;
        const uri = amount ? `monero:${xmrAddress}?tx_amount=${amount}` : `monero:${xmrAddress}`;
        qrCodeRef.current.update({ data: uri });
    }, [xmrAddress, amount]);

    const handleCopy = () => {
        navigator.clipboard.writeText(xmrAddress);
        setCopied(true);
        showToast('Address copied', 'info', 1500);
        setTimeout(() => setCopied(false), 2000);
    };

    const presets = [0.01, 0.05, 0.1, 0.5, 1.0];

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="animate-spin text-monero-orange" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                    <h1 className="font-mono font-black text-xl mb-2">{error}</h1>
                    <a href="/" className="font-mono text-sm text-monero-orange hover:underline">Back to GOXMR</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-6">
                    <a href="/" className="font-mono font-black text-xs text-gray-400 uppercase tracking-widest hover:text-monero-orange">GOXMR.CLICK</a>
                </div>

                {/* Card */}
                <div className="border-4 border-black" style={{ boxShadow: `8px 8px 0px 0px ${accentColor}` }}>
                    {/* Recipient */}
                    <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center gap-3">
                        {profileImage ? (
                            <img src={profileImage} alt="" className="w-10 h-10 object-cover border-2 border-black" />
                        ) : (
                            <div className="w-10 h-10 bg-monero-orange border-2 border-black flex items-center justify-center font-mono font-black text-white">
                                {(displayName || '?').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="font-mono font-black text-sm">{displayName}</div>
                            <div className="font-mono text-[10px] text-gray-500">@{username}</div>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="p-6 flex justify-center bg-white">
                        <div ref={qrRef} />
                    </div>

                    {/* Amount */}
                    <div className="px-4 pb-4">
                        {!initialAmount && (
                            <div className="mb-3">
                                <div className="font-mono text-[10px] font-bold uppercase text-gray-500 mb-1.5">Amount (XMR)</div>
                                <div className="flex gap-1.5 mb-2 flex-wrap">
                                    {presets.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setAmount(String(p))}
                                            className={`font-mono text-[10px] font-bold px-2.5 py-1.5 border-2 transition-colors ${amount === String(p) ? 'text-white' : 'border-black hover:bg-gray-100'}`}
                            style={amount === String(p) ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="Custom amount..."
                                    className="w-full border-2 border-black p-2 font-mono text-xs"
                                />
                            </div>
                        )}

                        {initialAmount && (
                            <div className="text-center mb-3">
                                <div className="font-mono text-[10px] text-gray-500 uppercase">Requested Amount</div>
                                <div className="font-mono font-black text-2xl" style={{ color: accentColor }}>{amount} XMR</div>
                            </div>
                        )}

                        {/* Address */}
                        <div
                            onClick={handleCopy}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && handleCopy()}
                            className="bg-gray-50 border-2 border-black p-3 font-mono text-[10px] break-all cursor-pointer hover:bg-gray-100 transition-colors flex items-start gap-2 focus-visible:ring-2 focus-visible:ring-monero-orange select-all"
                        >
                            <span className="flex-1">{xmrAddress}</span>
                            {copied ? <Check size={14} className="text-green-500 shrink-0" /> : <Copy size={14} className="text-gray-400 shrink-0" />}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t-2 border-black p-2 bg-gray-50 text-center">
                        <span className="font-mono text-[8px] text-gray-400 uppercase tracking-widest">Powered by Monero</span>
                    </div>
                </div>

                {/* Back link */}
                <div className="text-center mt-4">
                    <a href={`/${username}`} className="font-mono text-xs text-gray-500 hover:text-monero-orange">
                        View @{username}'s profile
                    </a>
                </div>
            </div>
        </div>
    );
};
