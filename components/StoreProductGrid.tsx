import React, { useEffect, useState } from 'react';
import { Package, Lock, Monitor, Truck, Wrench } from 'lucide-react';
import { fetchRates, convertFromXMR, formatFiat, type RatesMap, type FiatCode } from '../utils/rates';
import { StarRating } from './StarRating';

interface Product {
    id: number;
    name: string;
    description: string;
    product_type: string;
    price_xmr: number;
    stock: number;
    sales: number;
    visibility: string;
    thumbnail_url: string;
    avg_rating?: number | null;
}

const TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    digital: Monitor,
    physical: Truck,
    service: Wrench,
};

interface StoreProductGridProps {
    products: Product[];
    onBuy: (product: Product) => void;
    accentColor?: string;
}

export const StoreProductGrid: React.FC<StoreProductGridProps> = ({ products, onBuy, accentColor }) => {
    const AC = accentColor || '#F26822';
    // 3E: shared fiat-display toggle for all cards. Persists across grid renders via localStorage.
    const [displayCurrency, setDisplayCurrency] = useState<'XMR' | FiatCode>(() => {
        try { return (localStorage.getItem('goxmr_display_currency') as any) || 'XMR'; } catch { return 'XMR'; }
    });
    const [rates, setRates] = useState<RatesMap>({});
    useEffect(() => {
        if (displayCurrency === 'XMR') return;
        fetchRates().then(setRates);
    }, [displayCurrency]);
    const cycleCurrency = () => {
        const order: Array<'XMR' | FiatCode> = ['XMR', 'usd', 'eur'];
        const next = order[(order.indexOf(displayCurrency) + 1) % order.length];
        setDisplayCurrency(next);
        try { localStorage.setItem('goxmr_display_currency', next); } catch {}
    };
    const renderPrice = (xmr: number) => {
        if (displayCurrency === 'XMR') return `${xmr} XMR`;
        const v = convertFromXMR(xmr, displayCurrency, rates);
        if (v === null) return `${xmr} XMR`; // rates not loaded yet — show XMR
        return formatFiat(v, displayCurrency);
    };

    if (products.length === 0) {
        return null; // PublicProfile renders its own "no products match" state below
    }

    return (
        <>
            {/* 3E: small inline toggle for the price display unit. Click cycles XMR → USD → EUR */}
            <div className="flex justify-end mb-2">
                <button
                    onClick={cycleCurrency}
                    className="font-mono text-[10px] font-bold uppercase px-2 py-1 border border-gray-300 hover:border-black bg-white"
                    title="Toggle price display"
                >
                    ⇄ {displayCurrency.toUpperCase()}
                </button>
            </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(product => {
                const isPgpLocked = product.visibility === 'pgp_only';
                const TypeIcon = TYPE_ICONS[product.product_type] || Package;

                return (
                    <div
                        key={product.id}
                        className="border-2 border-black bg-white/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                        onClick={() => !isPgpLocked && onBuy(product)}
                    >
                        {/* Thumbnail */}
                        {product.thumbnail_url ? (
                            <div className="h-32 border-b-2 border-black overflow-hidden">
                                <img src={product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="h-32 border-b-2 border-black bg-gray-50 flex items-center justify-center">
                                {isPgpLocked ? <Lock size={32} className="text-purple-400" /> : <TypeIcon size={32} className="text-gray-300" />}
                            </div>
                        )}

                        <div className="p-3">
                            {/* Badges */}
                            <div className="flex gap-1.5 mb-2">
                                <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 border border-black bg-gray-100">
                                    {product.product_type}
                                </span>
                                {isPgpLocked && (
                                    <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 border border-purple-500 bg-purple-100 text-purple-700 flex items-center gap-0.5">
                                        <Lock size={8} /> PGP-LOCKED
                                    </span>
                                )}
                                {product.stock === 0 && (
                                    <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 border border-red-400 bg-red-100 text-red-600">
                                        SOLD OUT
                                    </span>
                                )}
                            </div>

                            {/* Name */}
                            <h4 className="font-mono font-bold text-sm leading-tight mb-1 truncate">
                                {isPgpLocked ? '[PGP-ENCRYPTED]' : (product.name || 'Unnamed Product')}
                            </h4>

                            {/* Description */}
                            {!isPgpLocked && product.description && (
                                <p className="font-mono text-[10px] text-gray-500 line-clamp-2 mb-2">{product.description}</p>
                            )}

                            {/* Rating */}
                            {!isPgpLocked && typeof product.avg_rating === 'number' && product.avg_rating > 0 && (
                                <div className="flex items-center gap-1 mb-1">
                                    <StarRating value={product.avg_rating} size={11} />
                                    <span className="font-mono text-[10px] text-gray-500">{product.avg_rating.toFixed(1)}</span>
                                </div>
                            )}

                            {/* Price & Stats */}
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                                <span className="font-mono font-black text-sm" style={{ color: AC }}>
                                    {renderPrice(product.price_xmr)}
                                    {displayCurrency !== 'XMR' && (
                                        <span className="block text-[9px] text-gray-400 font-normal">{product.price_xmr} XMR</span>
                                    )}
                                </span>
                                <span className="font-mono text-[9px] text-gray-400">
                                    {product.sales > 0 ? `${product.sales} sold` : ''}
                                    {product.stock > 0 ? ` | ${product.stock} left` : product.stock === -1 ? '' : ''}
                                </span>
                            </div>

                            {/* Buy button */}
                            {!isPgpLocked && product.stock !== 0 && (
                                <button
                                    onClick={e => { e.stopPropagation(); onBuy(product); }}
                                    className="w-full mt-3 font-mono text-xs font-black uppercase py-2.5 border-2 border-black bg-black text-white hover:opacity-90 active:scale-[0.98] transition-all"
                                    style={{ backgroundColor: AC }}
                                >
                                    Buy Now
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
        </>
    );
};
