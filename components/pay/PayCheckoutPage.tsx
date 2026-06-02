import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Copy, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { PayLayout } from './PayLayout';

// public checkout page rendered when a buyer clicks a [data-goxmr-pay] button.
// shows QR + address + amount + live status. polls every 6s.
// auto-redirects to merchant's redirect_url on confirmation.

interface OrderStatus {
    order_id: string;
    amount_xmr: number;
    payment_address: string;
    status: string;
    confirmations: number;
    expires_at: string;
    redirect_url: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
    pending: { text: 'Awaiting payment', color: 'text-yellow-700 dark:text-yellow-300' },
    paid: { text: 'Payment confirmed', color: 'text-green-700 dark:text-green-300' },
    expired: { text: 'Order expired', color: 'text-gray-500 dark:text-gray-400' },
    cancelled: { text: 'Cancelled', color: 'text-red-700 dark:text-red-300' },
};

export const PayCheckoutPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<OrderStatus | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    const load = async () => {
        try {
            const r = await fetch(`/pay/checkout/${orderId}/status`);
            if (!r.ok) throw new Error((await r.json()).error || 'not found');
            const data = await r.json();
            setOrder(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // initial load + 6s poll while not in a terminal state
    useEffect(() => {
        if (!orderId) return;
        load();
        const id = setInterval(async () => {
            try {
                const r = await fetch(`/pay/checkout/${orderId}/status`);
                if (r.ok) {
                    const data = await r.json();
                    setOrder(data);
                    if (['paid', 'expired', 'cancelled'].includes(data.status)) {
                        clearInterval(id);
                        if (data.status === 'paid' && data.redirect_url) {
                            // replace, not assign, so the back button doesn't return to a
                            // mid-checkout state after the buyer lands on the merchant page.
                            setTimeout(() => { window.location.replace(data.redirect_url); }, 2500);
                        }
                    }
                }
            } catch { /* keep polling */ }
        }, 6000);
        return () => clearInterval(id);
    }, [orderId]);

    // render QR once we have an address+amount
    useEffect(() => {
        if (!qrRef.current || !order?.payment_address) return;
        const qr = new QRCodeStyling({
            width: 240,
            height: 240,
            type: 'svg',
            data: `monero:${order.payment_address}?tx_amount=${order.amount_xmr}`,
            dotsOptions: { color: '#F26822', type: 'square' },
            backgroundOptions: { color: 'transparent' },
            cornersSquareOptions: { type: 'square', color: '#000' },
            cornersDotOptions: { type: 'square', color: '#000' },
        });
        qrRef.current.innerHTML = '';
        qr.append(qrRef.current);
    }, [order?.payment_address, order?.amount_xmr]);

    const copyAddress = () => {
        if (!order) return;
        navigator.clipboard.writeText(order.payment_address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <PayLayout bare><div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div></PayLayout>;
    if (error || !order) return (
        <PayLayout bare>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md text-center">
                    <AlertTriangle size={48} className="text-red-500 mx-auto mb-3" />
                    <h1 className="font-mono font-black uppercase text-xl tracking-tighter mb-2">Order not found</h1>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{error || 'Check that the order ID is correct.'}</p>
                </div>
            </div>
        </PayLayout>
    );

    const status = STATUS_LABEL[order.status] || { text: order.status, color: '' };
    const isTerminal = ['paid', 'expired', 'cancelled'].includes(order.status);
    const expiresAt = new Date(order.expires_at);
    const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000));

    return (
        <PayLayout bare>
            <div className="max-w-md mx-auto p-4 py-8">
                <div className="bg-monero-orange p-1.5 text-white inline-block border-2 border-black mb-4">
                    <span className="font-mono text-[10px] font-black uppercase tracking-widest">GoXMR_Pay</span>
                </div>

                <div className="border-4 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(242,104,34,1)]">
                    <div className="p-4 border-b-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-800">
                        <p className="font-mono text-[10px] uppercase text-gray-500 dark:text-gray-400">Send exactly</p>
                        <p className="font-mono font-black text-3xl text-monero-orange leading-none mt-1">{order.amount_xmr} XMR</p>
                        <p className={`font-mono text-[10px] font-bold uppercase mt-2 ${status.color}`}>{status.text}</p>
                    </div>

                    {!isTerminal && (
                        <>
                            <div className="p-4 flex justify-center">
                                <div className="p-2 bg-white border-2 border-black">
                                    <div ref={qrRef} className="w-[240px] h-[240px]" />
                                </div>
                            </div>

                            <div className="px-4 pb-3">
                                <p className="font-mono text-[10px] uppercase text-gray-500 dark:text-gray-400 mb-1">Payment address — click to copy</p>
                                <button onClick={copyAddress} className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-white p-2 font-mono text-[11px] break-all text-left hover:bg-monero-orange hover:text-white dark:hover:bg-monero-orange flex items-start gap-2">
                                    <span className="flex-1">{order.payment_address}</span>
                                    {copied ? <Check size={12} className="shrink-0 mt-0.5 text-green-500" /> : <Copy size={12} className="shrink-0 mt-0.5 opacity-60" />}
                                </button>
                            </div>

                            <div className="px-4 pb-4 text-center">
                                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                    Expires in <span className="font-bold text-monero-orange">{minutesLeft}m</span> · status polls every 6s
                                </p>
                            </div>
                        </>
                    )}

                    {order.status === 'paid' && (
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Check size={32} className="text-green-600" />
                            </div>
                            <p className="font-mono font-black uppercase text-sm">Payment received</p>
                            <p className="font-mono text-[10px] text-gray-500 mt-1">{order.confirmations} confirmation{order.confirmations === 1 ? '' : 's'}</p>
                            {order.redirect_url && (
                                <a href={order.redirect_url} className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-bold text-monero-orange hover:underline">
                                    Continue <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                    )}

                    {order.status === 'expired' && (
                        <div className="p-6 text-center">
                            <p className="font-mono text-sm uppercase text-gray-500">Order expired</p>
                            <p className="font-mono text-[10px] text-gray-400 mt-1">Ask the merchant to issue a new one.</p>
                        </div>
                    )}
                </div>

                <p className="font-mono text-[10px] text-gray-400 dark:text-gray-500 text-center mt-4">
                    GoXMR Pay is non-custodial. Funds go directly to the merchant's wallet.
                </p>
            </div>
        </PayLayout>
    );
};
