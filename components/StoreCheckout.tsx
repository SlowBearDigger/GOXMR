import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Loader2, ShoppingCart, Lock, Eye } from 'lucide-react';
import { showToast } from './Toast';
import QRCodeStyling from 'qr-code-styling';
import { fetchRates, convertFromXMR, formatFiat, type RatesMap, type CurrencyCode, type FiatCode } from '../utils/rates';
import { saveOrder } from '../utils/orderHistory';

type BuyerFormField = { key: string; label: string; type: 'text' | 'textarea' | 'email'; required: boolean };

interface Product {
    id: number;
    name: string;
    product_type: string;
    price_xmr: number;
    thumbnail_url: string;
    buyer_form_fields?: string | BuyerFormField[] | null;
}

interface StoreCheckoutProps {
    product: Product;
    sellerUsername: string;
    onClose: () => void;
    accentColor?: string;
    /** 3C: present for unlisted products. Server requires it on order POST. */
    unlockToken?: string;
}

export const StoreCheckout: React.FC<StoreCheckoutProps> = ({ product, sellerUsername, onClose, accentColor, unlockToken }) => {
    const AC = accentColor || '#F26822';
    const [step, setStep] = useState<'review' | 'fill_form' | 'creating' | 'payment' | 'proof' | 'tracking'>('review');
    // 3B: parse the seller-defined form fields from the product (string or array)
    const formFields: BuyerFormField[] = (() => {
        const raw = product.buyer_form_fields;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
    })();
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [pgpKey, setPgpKey] = useState<string | null>(null);
    const [hasStorePgp, setHasStorePgp] = useState(false);
    const [showVerifyHint, setShowVerifyHint] = useState(false);

    // 3E: accepted-currency map from store config + rates for converted display
    const [paymentAddresses, setPaymentAddresses] = useState<Record<string, string>>({});
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('XMR');
    const [rates, setRates] = useState<RatesMap>({});
    useEffect(() => { fetchRates().then(setRates); }, []);
    const acceptedCurrencies = ['XMR', ...Object.keys(paymentAddresses)] as CurrencyCode[];
    const altAmount = (target: CurrencyCode | FiatCode) => {
        const v = convertFromXMR(priceXmr || product.price_xmr, target, rates);
        return v;
    };

    // Fetch the seller's effective PGP key on mount (3A exposed this in /api/store/config)
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const r = await fetch(`/api/store/config/${sellerUsername}`);
                if (!r.ok || !active) return;
                const data = await r.json();
                setPgpKey(data.pgp_public_key || null);
                setHasStorePgp(!!data.has_store_pgp);
                if (data.payment_addresses) setPaymentAddresses(data.payment_addresses);
            } catch { /* non-fatal: form fields will just refuse to submit later */ }
        })();
        return () => { active = false; };
    }, [sellerUsername]);
    const [orderCode, setOrderCode] = useState('');
    const [orderId, setOrderId] = useState<number | null>(null);
    const [paymentAddress, setPaymentAddress] = useState('');
    const [priceXmr, setPriceXmr] = useState(0);
    const [copied, setCopied] = useState(false);
    const [txid, setTxid] = useState('');
    const [txKey, setTxKey] = useState('');
    const [proofSubmitted, setProofSubmitted] = useState(false);
    const [orderStatus, setOrderStatus] = useState('pending');
    const [error, setError] = useState('');
    const [digitalContent, setDigitalContent] = useState<any[]>([]);

    const qrRef = useRef<HTMLDivElement>(null);
    const [qrCode] = useState(() => new QRCodeStyling({
        width: 180,
        height: 180,
        type: 'svg',
        data: 'monero:',
        margin: 5,
        qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'Q' },
        dotsOptions: { type: 'extra-rounded', color: AC },
        backgroundOptions: { color: 'transparent' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#000' },
        cornersDotOptions: { type: 'dot', color: '#000' }
    }));

    useEffect(() => {
        if (qrRef.current && paymentAddress) {
            qrRef.current.innerHTML = '';
            qrCode.update({ data: `monero:${paymentAddress}?tx_amount=${priceXmr}` });
            qrCode.append(qrRef.current);
        }
    }, [paymentAddress, priceXmr]);

    // Poll for status changes
    useEffect(() => {
        const terminalStatuses = ['complete', 'cancelled', 'expired', 'refunded'];
        if (!orderCode || terminalStatuses.includes(orderStatus)) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/store/orders/track/${orderCode}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status !== orderStatus) {
                        setOrderStatus(data.status);
                        if (data.status === 'paid' || data.status === 'complete') {
                            setStep('tracking');
                        }
                    }
                }
            } catch { }
        }, 15000);
        return () => clearInterval(interval);
    }, [orderCode, orderStatus]);

    // Called from the "Confirm" button on the review step. If the seller defined buyer fields,
    // route through the form step; otherwise create the order directly.
    const handleConfirm = () => {
        setError('');
        if (formFields.length > 0) {
            setStep('fill_form');
        } else {
            createOrder('{}', 'review');
        }
    };

    // Validate the buyer form, PGP-encrypt the JSON payload, then create the order.
    const submitForm = async () => {
        setError('');
        // required-field check
        for (const f of formFields) {
            if (f.required && !(formData[f.key] || '').trim()) {
                setError(`Field "${f.label}" is required`);
                return;
            }
            if (f.type === 'email' && formData[f.key] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData[f.key])) {
                setError(`"${f.label}" doesn't look like an email`);
                return;
            }
        }
        if (!pgpKey) {
            setError('Seller has no PGP key configured. Ask them to set one in store settings before ordering.');
            return;
        }
        let ciphertext: string;
        try {
            const openpgp = await import('openpgp');
            const publicKey = await openpgp.readKey({ armoredKey: pgpKey });
            const message = await openpgp.createMessage({ text: JSON.stringify({ fields: formData, submitted_at: new Date().toISOString() }) });
            ciphertext = await openpgp.encrypt({ message, encryptionKeys: publicKey });
        } catch (e: any) {
            setError('Encryption failed: ' + (e?.message || 'unknown'));
            return;
        }
        await createOrder(ciphertext, 'fill_form');
    };

    const createOrder = async (encryptedData: string, fallbackStep: 'review' | 'fill_form') => {
        setStep('creating');
        try {
            const token = localStorage.getItem('goxmr_token');
            const savedUser = localStorage.getItem('goxmr_user');
            const res = await fetch('/api/store/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    product_id: product.id,
                    buyer_username: savedUser || undefined,
                    encrypted_data: encryptedData,
                    // 3C: included only when checkout was opened from an unlocked unlisted product
                    unlock_token: unlockToken
                })
            });
            const data = await res.json();
            if (res.ok) {
                setOrderCode(data.order_code);
                setOrderId(data.order_id);
                setPaymentAddress(data.payment_address);
                setPriceXmr(data.price_xmr);
                // #4.1: persist the order locally so the buyer can find it later via /track or My Orders.
                // Server never gets a per-buyer index — only this device knows the list.
                saveOrder({
                    order_code: data.order_code,
                    product_name: product.name,
                    seller: sellerUsername,
                    price_xmr: data.price_xmr,
                    created_at: new Date().toISOString(),
                });
                setStep('payment');
            } else {
                setError(data.error || 'Failed to create order');
                showToast(data.error || 'Failed to create order', 'error');
                setStep(fallbackStep);
            }
        } catch {
            setError('Network error');
            showToast('Network error creating order', 'error');
            setStep(fallbackStep);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        showToast('Copied to clipboard', 'info', 1500);
        setTimeout(() => setCopied(false), 2000);
    };

    const submitProof = async () => {
        if (!txid.trim()) return;
        try {
            const res = await fetch(`/api/store/orders/${orderId}/proof`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txid: txid.trim(), tx_key: txKey.trim() || undefined, order_code: orderCode })
            });
            if (res.ok) {
                setProofSubmitted(true);
                setStep('tracking');
                showToast('Payment proof submitted', 'success');
            } else {
                showToast('Failed to submit proof', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handleDownload = async (contentId: number) => {
        try {
            const res = await fetch(`/api/store/download/${orderId}/${contentId}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setDigitalContent(prev => prev.map(c => c.id === contentId ? { ...c, downloaded: true, content: data.encrypted_content } : c));
            }
        } catch { }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] my-4 animate-scale-in">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b-2 border-black dark:border-white">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={16} style={{ color: AC }} />
                        <span className="font-mono font-black text-sm uppercase dark:text-white">Checkout</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                        <X size={16} className="dark:text-white" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Product summary */}
                    <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-zinc-700">
                        {product.thumbnail_url ? (
                            <img src={product.thumbnail_url} alt="" className="w-12 h-12 object-cover border border-black" />
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 border border-black dark:border-white flex items-center justify-center">
                                <ShoppingCart size={16} className="text-gray-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-mono font-bold text-sm dark:text-white truncate">{product.name}</div>
                            <div className="font-mono text-[10px] text-gray-500 uppercase">{product.product_type} | @{sellerUsername}</div>
                        </div>
                        <div className="font-mono font-black text-sm" style={{ color: AC }}>{product.price_xmr} XMR</div>
                    </div>

                    {error && <div className="text-red-500 font-mono text-xs p-2 border border-red-300 bg-red-50">{error}</div>}

                    {/* Review — explicit confirmation before creating the order */}
                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="font-mono text-xs dark:text-gray-300 leading-relaxed">
                                You're about to purchase <span className="font-bold dark:text-white">{product.name}</span> for <span className="font-black" style={{ color: AC }}>{product.price_xmr} XMR</span> from <span className="font-bold dark:text-white">@{sellerUsername}</span>.
                            </div>
                            <ul className="font-mono text-[10px] text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
                                <li>Confirming generates a payment address and an order code.</li>
                                <li>Payment goes directly to the seller's wallet.</li>
                                <li>Order is valid for 48 hours.</li>
                            </ul>
                            {formFields.length > 0 && (
                                <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 border-l-2 border-monero-orange p-2 flex items-start gap-2">
                                    <Lock size={10} className="mt-0.5 shrink-0 text-monero-orange" />
                                    <span>Seller will ask for <span className="dark:text-gray-200 font-bold">{formFields.length} field{formFields.length > 1 ? 's' : ''}</span> next, PGP-encrypted client-side. Only they can read it.</span>
                                </div>
                            )}
                            <button
                                onClick={handleConfirm}
                                className="w-full font-mono text-xs font-black uppercase py-3 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange hover:text-white transition-colors"
                            >
                                {formFields.length > 0 ? 'Next: Order Info' : 'Confirm & Generate Payment'}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full font-mono text-xs font-bold uppercase py-2 border-2 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Fill buyer form — values get PGP-encrypted client-side before submit */}
                    {step === 'fill_form' && (
                        <div className="space-y-3">
                            <div className="font-mono text-[10px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/50 border-l-2 border-monero-orange p-2 flex items-start gap-2">
                                <Lock size={10} className="mt-0.5 shrink-0 text-monero-orange" />
                                <span>
                                    These values are encrypted in your browser with the seller's PGP key before they leave your device.
                                    {' '}
                                    {pgpKey
                                        ? <>Key: <span className="dark:text-gray-200 font-bold">{hasStorePgp ? 'store-specific' : 'seller profile'}</span>.</>
                                        : <span className="text-red-500">Seller has no PGP key set — can't encrypt.</span>}
                                </span>
                            </div>
                            {formFields.map((f, idx) => (
                                <div key={idx}>
                                    <label className="font-mono text-[10px] font-bold uppercase tracking-wider dark:text-white block mb-1">
                                        {f.label} {f.required && <span className="text-monero-orange">*</span>}
                                    </label>
                                    {f.type === 'textarea' ? (
                                        <textarea
                                            value={formData[f.key] || ''}
                                            onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))}
                                            rows={3}
                                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white resize-none"
                                        />
                                    ) : (
                                        <input
                                            type={f.type === 'email' ? 'email' : 'text'}
                                            value={formData[f.key] || ''}
                                            onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))}
                                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                                        />
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setShowVerifyHint(s => !s)}
                                className="font-mono text-[10px] underline text-gray-500 dark:text-gray-400 hover:text-monero-orange flex items-center gap-1"
                            >
                                <Eye size={10} /> {showVerifyHint ? 'Hide' : 'How do I verify this is encrypted?'}
                            </button>
                            {showVerifyHint && (
                                <div className="font-mono text-[10px] text-gray-600 dark:text-gray-300 border border-dashed border-gray-400 dark:border-zinc-600 p-2 leading-relaxed">
                                    Open DevTools → Network tab → click "Submit Encrypted Order" below → find the
                                    {' '}<code className="bg-gray-100 dark:bg-zinc-800 px-1">POST /api/store/orders</code> request → Payload tab.
                                    The <code className="bg-gray-100 dark:bg-zinc-800 px-1">encrypted_data</code> field should be a
                                    {' '}<code className="bg-gray-100 dark:bg-zinc-800 px-1">-----BEGIN PGP MESSAGE-----</code> armored blob, not plain JSON.
                                </div>
                            )}
                            {error && <div className="text-red-500 font-mono text-xs">{error}</div>}
                            <button
                                onClick={submitForm}
                                disabled={!pgpKey}
                                className="w-full font-mono text-xs font-black uppercase py-3 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Submit Encrypted Order
                            </button>
                            <button
                                onClick={() => setStep('review')}
                                className="w-full font-mono text-xs font-bold uppercase py-2 border-2 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Back
                            </button>
                        </div>
                    )}

                    {/* Creating */}
                    {step === 'creating' && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin mr-2" size={16} />
                            <span className="font-mono text-xs dark:text-white">Creating order...</span>
                        </div>
                    )}

                    {/* Payment */}
                    {step === 'payment' && (() => {
                        // 3E: choose the address + amount to display based on selectedCurrency.
                        // XMR uses the (potentially auto-generated) sub-address from order creation;
                        // other cryptos use the seller's static address.
                        const isXmr = selectedCurrency === 'XMR';
                        const displayAddress = isXmr ? paymentAddress : (paymentAddresses[selectedCurrency] || '');
                        const altCryptoAmt = isXmr ? priceXmr : altAmount(selectedCurrency);
                        const usdEq = altAmount('usd');
                        const eurEq = altAmount('eur');
                        return (
                        <div className="space-y-4">
                            {/* 3E: currency tabs (only when seller accepts more than XMR) */}
                            {acceptedCurrencies.length > 1 && (
                                <div className="flex gap-1 flex-wrap">
                                    {acceptedCurrencies.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setSelectedCurrency(c)}
                                            className={`font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 transition-colors ${selectedCurrency === c ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="text-center">
                                <div className="font-mono text-[10px] text-gray-500 uppercase mb-2">Send exactly</div>
                                <div className="font-mono font-black text-2xl" style={{ color: AC }}>
                                    {altCryptoAmt !== null ? (isXmr ? `${altCryptoAmt} XMR` : `${altCryptoAmt.toFixed(8)} ${selectedCurrency}`) : '— rates loading —'}
                                </div>
                                {(usdEq !== null || eurEq !== null) && (
                                    <div className="font-mono text-[10px] text-gray-500 mt-1">
                                        ≈ {usdEq !== null ? formatFiat(usdEq, 'usd') : ''}{usdEq && eurEq ? ' / ' : ''}{eurEq !== null ? formatFiat(eurEq, 'eur') : ''}
                                    </div>
                                )}
                                <div className="font-mono text-[10px] text-gray-500 mt-1">to the address below</div>
                            </div>

                            {/* QR Code (XMR only — we encode `monero:` URIs; for other cryptos we just show the address) */}
                            {isXmr && (
                                <div className="flex justify-center">
                                    <div ref={qrRef} className="border-2 border-black dark:border-white p-2 bg-white" />
                                </div>
                            )}

                            {/* Non-XMR warning: the seller's address is reused, less privacy. Seller verifies manually. */}
                            {!isXmr && (
                                <div className="font-mono text-[10px] text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-500 p-2 leading-relaxed">
                                    <span className="font-bold text-amber-700 dark:text-amber-400">Non-XMR payment:</span> goes directly to the seller's fixed {selectedCurrency} address. The seller verifies manually. Less privacy than XMR (address reuse) — XMR is recommended.
                                </div>
                            )}

                            {/* Address */}
                            <div className="relative">
                                <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 uppercase mb-1">{selectedCurrency} Address — click to copy</div>
                                <div
                                    onClick={() => handleCopy(displayAddress)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && handleCopy(displayAddress)}
                                    className="bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-white p-3 font-mono text-[11px] break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors dark:text-white flex items-start gap-2 focus-visible:ring-2 focus-visible:ring-monero-orange"
                                >
                                    <span className="flex-1 select-all">{displayAddress}</span>
                                    <span className="shrink-0 mt-0.5">
                                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                                    </span>
                                </div>
                            </div>

                            {/* Order code */}
                            <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-2">
                                <div className="font-mono text-[10px] text-gray-500">Order Code (save this):</div>
                                <div className="font-mono text-xs font-bold dark:text-white">{orderCode}</div>
                            </div>

                            <button
                                onClick={() => setStep('proof')}
                                className="w-full font-mono text-xs font-black uppercase py-3 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange transition-colors"
                            >
                                I've Sent the Payment
                            </button>

                            <p className="font-mono text-[9px] text-gray-400 text-center">
                                Order expires in 48 hours. {isXmr ? 'Auto-checking every 15s.' : 'Seller will verify and update status manually.'}
                            </p>
                        </div>
                        );
                    })()}

                    {/* Proof submission */}
                    {step === 'proof' && (
                        <div className="space-y-4">
                            <div>
                                <label className="font-mono text-[10px] font-bold uppercase block mb-1 dark:text-white">Transaction ID (TXID) *</label>
                                <input
                                    type="text"
                                    value={txid}
                                    onChange={e => setTxid(e.target.value)}
                                    placeholder="Paste your TXID here..."
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="font-mono text-[10px] font-bold uppercase block mb-1 dark:text-white">TX Key (Proof of Payment)</label>
                                <input
                                    type="text"
                                    value={txKey}
                                    onChange={e => setTxKey(e.target.value)}
                                    placeholder="Optional but recommended..."
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white"
                                />
                                <p className="font-mono text-[9px] text-gray-400 mt-1">TX Key helps the seller verify your payment faster.</p>
                            </div>
                            <button
                                onClick={submitProof}
                                disabled={!txid.trim()}
                                className="w-full font-mono text-xs font-black uppercase py-3 border-2 transition-colors"
                                style={{ backgroundColor: txid.trim() ? AC : '#e5e7eb', color: txid.trim() ? 'white' : '#9ca3af', borderColor: txid.trim() ? AC : '#d1d5db' }}
                            >
                                Submit Payment Proof
                            </button>
                        </div>
                    )}

                    {/* Tracking */}
                    {step === 'tracking' && (
                        <div className="space-y-4">
                            <div className="text-center py-4">
                                {orderStatus === 'pending' && proofSubmitted && (
                                    <>
                                        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-yellow-500" />
                                        <div className="font-mono text-sm font-bold dark:text-white">Proof submitted</div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-1">Waiting for seller to verify payment...</div>
                                    </>
                                )}
                                {(orderStatus === 'paid' || orderStatus === 'processing' || orderStatus === 'shipped') && (
                                    <>
                                        <Check size={24} className="mx-auto mb-2 text-green-500" />
                                        <div className="font-mono text-sm font-bold text-green-600">Payment Confirmed!</div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-1 uppercase">Status: {orderStatus}</div>
                                    </>
                                )}
                                {orderStatus === 'complete' && (
                                    <>
                                        <Check size={24} className="mx-auto mb-2 text-green-500" />
                                        <div className="font-mono text-sm font-bold text-green-600">Order Complete</div>
                                    </>
                                )}
                            </div>

                            <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-2">
                                <div className="font-mono text-[10px] text-gray-500">Order: <span className="font-bold dark:text-white">{orderCode}</span></div>
                                <div className="font-mono text-[10px] text-gray-500 mt-1">
                                    Track anytime: <span className="text-monero-orange">goxmr.click</span> &rarr; /api/store/orders/track/{orderCode}
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full font-mono text-xs font-bold uppercase py-2 border-2 border-black dark:border-white dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
