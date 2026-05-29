import React, { useState, useEffect } from 'react';
import { Store, Plus, Package, ShoppingCart, Check, Loader2, Trash2, Wrench, Settings, X, Lock, Eye, EyeOff } from 'lucide-react';
import { showToast } from './Toast';

interface StoreSectionProps {
    username: string;
    onOpenAddProduct: (editProduct?: any) => void;
}

interface StoreConfig {
    monero_address: string;
    auto_verify: boolean;
    store_name: string;
    store_bio: string;
    store_banner: string;
    has_pgp?: boolean;
    has_store_pgp?: boolean;
    pgp_public_key?: string | null;
    store_pgp_public_key?: string | null;
    stats: { products: number; sales: number };
}

interface Product {
    id: number;
    name: string;
    description: string;
    product_type: string;
    price_xmr: number;
    stock: number;
    sales: number;
    views: number;
    visibility: string;
    is_active: number;
    thumbnail_url: string;
    created_at: string;
}

interface Order {
    id: number;
    order_code: string;
    product_id: number;
    buyer_username: string;
    status: string;
    price_xmr: number;
    buyer_proof: string;
    created_at: string;
    product_type: string;
    encrypted_data?: string;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    paid: 'bg-green-100 text-green-800 border-green-300',
    processing: 'bg-blue-100 text-blue-800 border-blue-300',
    shipped: 'bg-purple-100 text-purple-800 border-purple-300',
    complete: 'bg-green-200 text-green-900 border-green-400',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
    expired: 'bg-gray-100 text-gray-600 border-gray-300',
    refunded: 'bg-orange-100 text-orange-800 border-orange-300',
};

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

export const StoreSection: React.FC<StoreSectionProps> = ({ username, onOpenAddProduct }) => {
    const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasStore, setHasStore] = useState(false);
    const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
    const [notifications, setNotifications] = useState({ pending: 0, paid: 0, total: 0 });

    // 3D: pagination + filters for the products tab
    const [productSearch, setProductSearch] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState<'' | 'physical' | 'digital' | 'service'>('');
    const [productOffset, setProductOffset] = useState(0);
    const [productTotal, setProductTotal] = useState(0);
    const PRODUCT_LIMIT = 12;

    // 3B: unlock state for decrypting buyer-submitted order data with the seller's PGP private key.
    // Private key + passphrase live in sessionStorage only — cleared on tab close, never sent to server.
    const [unlockOpen, setUnlockOpen] = useState(false);
    const [unlockPrivKey, setUnlockPrivKey] = useState('');
    const [unlockPassphrase, setUnlockPassphrase] = useState('');
    const [unlockError, setUnlockError] = useState('');
    const [unlockLoading, setUnlockLoading] = useState(false);
    const [unlockedKeyObj, setUnlockedKeyObj] = useState<any>(null);
    const [decryptedOrders, setDecryptedOrders] = useState<Record<number, { fields: Record<string,string>; submitted_at?: string } | { error: string }>>({});

    // Restore the unlocked private key from sessionStorage on mount so the seller doesn't
    // have to paste it again during the same tab session.
    useEffect(() => {
        const armored = sessionStorage.getItem('goxmr_pgp_priv');
        const passphrase = sessionStorage.getItem('goxmr_pgp_pass') || '';
        if (!armored) return;
        (async () => {
            try {
                const openpgp = await import('openpgp');
                let key = await openpgp.readPrivateKey({ armoredKey: armored });
                if (!key.isDecrypted()) {
                    key = await openpgp.decryptKey({ privateKey: key, passphrase });
                }
                setUnlockedKeyObj(key);
            } catch { sessionStorage.removeItem('goxmr_pgp_priv'); sessionStorage.removeItem('goxmr_pgp_pass'); }
        })();
    }, []);

    const handleUnlock = async () => {
        setUnlockError('');
        setUnlockLoading(true);
        try {
            const openpgp = await import('openpgp');
            let key = await openpgp.readPrivateKey({ armoredKey: unlockPrivKey });
            if (!key.isDecrypted()) {
                key = await openpgp.decryptKey({ privateKey: key, passphrase: unlockPassphrase });
            }
            setUnlockedKeyObj(key);
            sessionStorage.setItem('goxmr_pgp_priv', unlockPrivKey);
            if (unlockPassphrase) sessionStorage.setItem('goxmr_pgp_pass', unlockPassphrase);
            setUnlockOpen(false);
            setUnlockPrivKey('');
            setUnlockPassphrase('');
            showToast('Orders unlocked for this session', 'success');
        } catch (e: any) {
            setUnlockError(e?.message || 'Failed to unlock — wrong key or passphrase?');
        } finally {
            setUnlockLoading(false);
        }
    };

    const lockOrders = () => {
        setUnlockedKeyObj(null);
        setDecryptedOrders({});
        sessionStorage.removeItem('goxmr_pgp_priv');
        sessionStorage.removeItem('goxmr_pgp_pass');
        showToast('Locked', 'info');
    };

    const decryptOrder = async (order: Order) => {
        if (!unlockedKeyObj || !order.encrypted_data) return;
        // skip if it's the legacy '{}' placeholder
        if (order.encrypted_data === '{}' || !order.encrypted_data.includes('BEGIN PGP MESSAGE')) {
            setDecryptedOrders(prev => ({ ...prev, [order.id]: { fields: {} } }));
            return;
        }
        try {
            const openpgp = await import('openpgp');
            const message = await openpgp.readMessage({ armoredMessage: order.encrypted_data });
            const { data } = await openpgp.decrypt({ message, decryptionKeys: unlockedKeyObj });
            const parsed = JSON.parse(data as string);
            setDecryptedOrders(prev => ({ ...prev, [order.id]: { fields: parsed.fields || {}, submitted_at: parsed.submitted_at } }));
        } catch (e: any) {
            setDecryptedOrders(prev => ({ ...prev, [order.id]: { error: e?.message || 'decrypt failed' } }));
        }
    };

    // Setup form state
    const [setupForm, setSetupForm] = useState({ monero_address: '', store_name: '', store_bio: '' });
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupError, setSetupError] = useState('');

    // Settings (edit store) state
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        monero_address: '',
        store_name: '',
        store_bio: '',
        store_pgp_public_key: '',
        use_profile_pgp: true,
        // 3E: addresses for additional cryptos the seller accepts (excluding XMR, which lives in monero_address)
        payment_addresses: {} as Record<string, string>,
        // #4.4: explicit opt-in to appear on the public /market discovery feed
        marketplace_optin: false,
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsError, setSettingsError] = useState('');

    useEffect(() => {
        // Owner-Dashboard mounts this with an empty `username` while /api/me is in flight.
        // Skip the fetch until we have a real username — otherwise we hit /api/store/config/
        // with a placeholder and pollute logs with bogus 404s.
        if (!username) return;
        loadStore();
    }, [username]);

    // Auto-refresh orders every 60s when orders tab is active
    useEffect(() => {
        if (!hasStore || activeTab !== 'orders') return;
        const interval = setInterval(() => {
            loadOrders();
            loadNotifications();
        }, 60000);
        return () => clearInterval(interval);
    }, [hasStore, activeTab]);

    const loadStore = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/store/config/${username}`);
            if (res.ok) {
                const data = await res.json();
                setStoreConfig(data);
                setHasStore(true);
                await Promise.all([loadProducts(), loadOrders(), loadNotifications()]);
            } else {
                setHasStore(false);
            }
        } catch {
            setHasStore(false);
        }
        setLoading(false);
    };

    const loadProducts = async () => {
        try {
            // 3C: use apiFetch so the owner's auth token is sent — server uses it to include unlisted/pgp_only products
            // 3D: paginated/filterable
            const q = new URLSearchParams({
                active_only: 'false',
                limit: String(PRODUCT_LIMIT),
                offset: String(productOffset),
            });
            if (productSearch.trim()) q.set('search', productSearch.trim());
            if (productTypeFilter) q.set('product_type', productTypeFilter);
            const res = await apiFetch(`/api/store/products/${username}?${q.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
                setProductTotal(data.total || 0);
            }
        } catch { }
    };

    // 3D: re-fetch whenever any filter/page changes
    useEffect(() => {
        if (hasStore) loadProducts();
    }, [hasStore, productSearch, productTypeFilter, productOffset]);

    const loadOrders = async () => {
        try {
            const res = await apiFetch('/api/store/orders/mine?view=seller');
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
            }
        } catch { }
    };

    const loadNotifications = async () => {
        try {
            const res = await apiFetch('/api/store/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch { }
    };

    const handleSetup = async () => {
        if (!setupForm.monero_address) {
            setSetupError('Monero address is required');
            return;
        }
        setSetupLoading(true);
        setSetupError('');
        try {
            const res = await apiFetch('/api/store/setup', {
                method: 'POST',
                body: JSON.stringify(setupForm),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Store deployed successfully!', 'success');
                await loadStore();
            } else {
                setSetupError(data.error || 'Setup failed');
                showToast(data.error || 'Setup failed', 'error');
            }
        } catch {
            setSetupError('Network error');
            showToast('Network error. Check your connection.', 'error');
        }
        setSetupLoading(false);
    };

    const openSettings = () => {
        const hasStoreKey = !!storeConfig?.store_pgp_public_key;
        setSettingsForm({
            monero_address: storeConfig?.monero_address || '',
            store_name: storeConfig?.store_name || '',
            store_bio: storeConfig?.store_bio || '',
            store_pgp_public_key: storeConfig?.store_pgp_public_key || '',
            use_profile_pgp: !hasStoreKey,
            payment_addresses: (storeConfig as any)?.payment_addresses || {},
            marketplace_optin: !!(storeConfig as any)?.marketplace_optin,
        });
        setSettingsError('');
        setSettingsOpen(true);
    };

    const handleSaveSettings = async () => {
        const addr = settingsForm.monero_address.trim();
        if (addr && !/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(addr)) {
            setSettingsError('Invalid Monero address format');
            return;
        }
        // pgp: if "use profile" is selected, send null to clear store-specific key;
        // otherwise send the trimmed armored block (server validates format).
        let pgpPayload: string | null | undefined;
        if (settingsForm.use_profile_pgp) {
            pgpPayload = null;
        } else {
            const trimmed = settingsForm.store_pgp_public_key.trim();
            if (!trimmed) {
                setSettingsError('Paste a PGP public key or switch to "use profile key"');
                return;
            }
            if (!/^-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+-----END PGP PUBLIC KEY BLOCK-----\s*$/m.test(trimmed)) {
                setSettingsError('Invalid PGP public key (must be ASCII-armored)');
                return;
            }
            pgpPayload = trimmed;
        }
        setSettingsLoading(true);
        setSettingsError('');
        try {
            // 3E: only send non-empty addresses; server clears the column when this map is empty
            const cleanAddrs: Record<string, string> = {};
            for (const [k, v] of Object.entries(settingsForm.payment_addresses)) {
                if (typeof v === 'string' && v.trim()) cleanAddrs[k] = v.trim();
            }
            const res = await apiFetch('/api/store/config', {
                method: 'PUT',
                body: JSON.stringify({
                    monero_address: addr,
                    store_name: settingsForm.store_name,
                    store_bio: settingsForm.store_bio,
                    store_pgp_public_key: pgpPayload,
                    payment_addresses: cleanAddrs,
                    marketplace_optin: settingsForm.marketplace_optin,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Store settings updated', 'success');
                setSettingsOpen(false);
                await loadStore();
            } else {
                setSettingsError(data.error || 'Update failed');
                showToast(data.error || 'Update failed', 'error');
            }
        } catch {
            setSettingsError('Network error');
            showToast('Network error. Check your connection.', 'error');
        }
        setSettingsLoading(false);
    };

    const handleDeleteProduct = async (productId: number) => {
        if (!confirm('Deactivate this product?')) return;
        try {
            const res = await apiFetch(`/api/store/products/${productId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Product deactivated', 'success');
                await loadProducts();
            } else {
                showToast('Failed to deactivate product', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handleUpdateOrderStatus = async (orderId: number, status: string) => {
        try {
            const res = await apiFetch(`/api/store/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                showToast(`Order marked as ${status}`, 'success');
                await loadOrders();
                await loadNotifications();
            } else {
                showToast('Failed to update order', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" size={24} />
                <span className="ml-2 font-mono text-sm">Loading store...</span>
            </div>
        );
    }

    // ---- SETUP WIZARD ----
    if (!hasStore) {
        return (
            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <Store size={24} className="text-monero-orange" />
                    <h3 className="font-mono font-black text-lg uppercase tracking-tighter dark:text-white">Initialize Store</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-mono">
                    Set up your decentralized storefront. Payments go directly to your Monero wallet — GOXMR never touches your funds.
                </p>

                <div className="space-y-4 max-w-lg">
                    <div>
                        <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Monero Address *</label>
                        <input
                            type="text"
                            value={setupForm.monero_address}
                            onChange={e => setSetupForm(f => ({ ...f, monero_address: e.target.value }))}
                            placeholder="4... or 8..."
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">Buyers pay directly to this address. You control the keys.</p>
                    </div>
                    <div>
                        <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Store Name</label>
                        <input
                            type="text"
                            value={setupForm.store_name}
                            onChange={e => setSetupForm(f => ({ ...f, store_name: e.target.value }))}
                            placeholder="My Sovereign Store"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Store Bio</label>
                        <textarea
                            value={setupForm.store_bio}
                            onChange={e => setSetupForm(f => ({ ...f, store_bio: e.target.value }))}
                            placeholder="What do you sell?"
                            rows={2}
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white resize-none"
                        />
                    </div>

                    {setupError && <p className="text-red-500 text-xs font-mono">{setupError}</p>}

                    <button
                        onClick={handleSetup}
                        disabled={setupLoading}
                        className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange hover:text-white transition-colors flex items-center gap-2"
                    >
                        {setupLoading ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
                        Deploy Store
                    </button>
                </div>
            </div>
        );
    }

    // ---- ACTIVE STORE ----
    return (
        <div className="space-y-6">
            {/* Store Header */}
            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <h3 className="font-mono font-black text-lg uppercase tracking-tighter dark:text-white">
                            {storeConfig?.store_name || 'My Store'}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">{storeConfig?.store_bio || 'No description'}</p>
                        <div className="mt-2">
                            <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Payments to</span>
                            <p className="font-mono text-[10px] text-gray-600 dark:text-gray-300 break-all">
                                {storeConfig?.monero_address
                                    ? `${storeConfig.monero_address.slice(0, 12)}…${storeConfig.monero_address.slice(-8)}`
                                    : 'Not set'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-4 text-center">
                            <div>
                                <div className="font-mono font-black text-lg dark:text-white">{storeConfig?.stats.products || 0}</div>
                                <div className="font-mono text-[10px] text-gray-500 uppercase">Products</div>
                            </div>
                            <div>
                                <div className="font-mono font-black text-lg dark:text-white">{storeConfig?.stats.sales || 0}</div>
                                <div className="font-mono text-[10px] text-gray-500 uppercase">Sales</div>
                            </div>
                        </div>
                        <button
                            onClick={openSettings}
                            className="p-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:text-white transition-colors"
                            title="Store settings"
                            aria-label="Store settings"
                        >
                            <Settings size={16} className="dark:text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {settingsOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
                        <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-gray-50 dark:bg-zinc-800">
                            <h3 className="font-mono font-black uppercase text-lg tracking-tighter dark:text-white">Store Settings</h3>
                            <button onClick={() => setSettingsOpen(false)} aria-label="Close" className="p-1.5 hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-black dark:hover:border-white dark:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Monero Address *</label>
                                <input
                                    type="text"
                                    value={settingsForm.monero_address}
                                    onChange={e => setSettingsForm(f => ({ ...f, monero_address: e.target.value }))}
                                    placeholder="4... or 8..."
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">Buyers pay directly to this address. Double-check it — a wrong address means lost funds.</p>
                            </div>
                            <div>
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Store Name</label>
                                <input
                                    type="text"
                                    value={settingsForm.store_name}
                                    onChange={e => setSettingsForm(f => ({ ...f, store_name: e.target.value }))}
                                    placeholder="My Sovereign Store"
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Store Bio</label>
                                <textarea
                                    value={settingsForm.store_bio}
                                    onChange={e => setSettingsForm(f => ({ ...f, store_bio: e.target.value }))}
                                    placeholder="What do you sell?"
                                    rows={2}
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white resize-none"
                                />
                            </div>

                            {/* 3E: optional addresses for other cryptos. Direct payment, no middleman. */}
                            <div className="border-t-2 border-dashed border-gray-300 dark:border-zinc-700 pt-4">
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-2">Accepted Cryptos (Optional)</label>
                                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                    Add an address for each crypto you also accept. Payments go directly to these addresses — no swap, no middleman. <span className="text-monero-orange">Trade-off:</span> non-XMR addresses are reused per order (less privacy than XMR sub-addresses).
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {(['BTC', 'LTC', 'ETH', 'BCH', 'SOL', 'DOGE'] as const).map(code => (
                                        <div key={code} className="flex items-center gap-2">
                                            <span className="font-mono text-[10px] font-bold uppercase w-10 dark:text-white">{code}</span>
                                            <input
                                                type="text"
                                                value={settingsForm.payment_addresses[code] || ''}
                                                onChange={e => setSettingsForm(f => ({ ...f, payment_addresses: { ...f.payment_addresses, [code]: e.target.value } }))}
                                                placeholder={
                                                    code === 'BTC' ? 'bc1… or 1… / 3…'
                                                  : code === 'LTC' ? 'ltc1… or L… / M…'
                                                  : code === 'ETH' ? '0x…'
                                                  : code === 'BCH' ? 'bitcoincash:q… or q…/p…'
                                                  : code === 'SOL' ? 'base58 address'
                                                  : 'D…'
                                                }
                                                className="flex-1 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-1.5 font-mono text-[10px] dark:text-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* #4.4: marketplace opt-in. Default off; only the seller chooses to be discoverable. */}
                            <div className="border-t-2 border-dashed border-gray-300 dark:border-zinc-700 pt-4">
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-2">Marketplace</label>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.marketplace_optin}
                                        onChange={e => setSettingsForm(f => ({ ...f, marketplace_optin: e.target.checked }))}
                                        className="mt-0.5 accent-monero-orange"
                                    />
                                    <span className="font-mono text-xs dark:text-white">
                                        List my store in the public marketplace
                                        <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                                            Default is OFF. Direct links to your store keep working either way — this only controls whether you appear on <code className="bg-gray-100 dark:bg-zinc-800 px-1">/market</code>.
                                        </span>
                                    </span>
                                </label>
                            </div>

                            <div className="border-t-2 border-dashed border-gray-300 dark:border-zinc-700 pt-4">
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-2">Store PGP Key</label>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mb-3 leading-relaxed">
                                    Used to encrypt order notifications and (soon) buyer-submitted data. Public key only — safe to expose.
                                </p>
                                <div className="space-y-2 mb-3">
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="pgp_mode"
                                            checked={settingsForm.use_profile_pgp}
                                            onChange={() => setSettingsForm(f => ({ ...f, use_profile_pgp: true }))}
                                            className="mt-0.5 accent-monero-orange"
                                        />
                                        <span className="font-mono text-xs dark:text-white">
                                            Use my profile PGP key
                                            <span className="block text-[10px] text-gray-400 dark:text-gray-500">Same key configured in account settings.</span>
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="pgp_mode"
                                            checked={!settingsForm.use_profile_pgp}
                                            onChange={() => setSettingsForm(f => ({ ...f, use_profile_pgp: false }))}
                                            className="mt-0.5 accent-monero-orange"
                                        />
                                        <span className="font-mono text-xs dark:text-white">
                                            Use a different key for this store
                                            <span className="block text-[10px] text-gray-400 dark:text-gray-500">Isolate store opsec from your main identity.</span>
                                        </span>
                                    </label>
                                </div>
                                {!settingsForm.use_profile_pgp && (
                                    <textarea
                                        value={settingsForm.store_pgp_public_key}
                                        onChange={e => setSettingsForm(f => ({ ...f, store_pgp_public_key: e.target.value }))}
                                        placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
                                        rows={6}
                                        className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[10px] dark:text-white resize-none"
                                    />
                                )}
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-mono">
                                    Active: <span className="font-bold dark:text-gray-300">
                                        {settingsForm.use_profile_pgp
                                            ? (storeConfig?.pgp_public_key && !storeConfig?.has_store_pgp ? 'profile key' : (storeConfig?.has_store_pgp ? 'profile key (after save)' : 'none — set one in Account Settings'))
                                            : (settingsForm.store_pgp_public_key.trim() ? 'store-specific key' : 'no key — orders will be unencrypted')}
                                    </span>
                                </p>
                            </div>

                            {settingsError && <p className="text-red-500 text-xs font-mono">{settingsError}</p>}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={settingsLoading}
                                    className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange hover:text-white transition-colors flex items-center gap-2"
                                >
                                    {settingsLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => setSettingsOpen(false)}
                                    className="font-mono text-xs font-black uppercase px-6 py-3 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Orders Modal (3B) */}
            {unlockOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUnlockOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
                        <div className="flex items-center justify-between border-b-2 border-black dark:border-white p-4 bg-gray-50 dark:bg-zinc-800">
                            <h3 className="font-mono font-black uppercase text-lg tracking-tighter dark:text-white flex items-center gap-2"><Lock size={16} /> Unlock Orders</h3>
                            <button onClick={() => setUnlockOpen(false)} aria-label="Close" className="p-1.5 hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-black dark:hover:border-white dark:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="font-mono text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                Paste your PGP <span className="font-bold">private</span> key. It stays in this browser tab's memory and <span className="font-bold">never</span> leaves your device — verify in DevTools → Network: no request carries it.
                            </p>
                            <div>
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">PGP Private Key</label>
                                <textarea
                                    value={unlockPrivKey}
                                    onChange={e => setUnlockPrivKey(e.target.value)}
                                    placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----&#10;...&#10;-----END PGP PRIVATE KEY BLOCK-----"
                                    rows={7}
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[10px] dark:text-white resize-none"
                                />
                            </div>
                            <div>
                                <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white block mb-1">Passphrase (if any)</label>
                                <input
                                    type="password"
                                    value={unlockPassphrase}
                                    onChange={e => setUnlockPassphrase(e.target.value)}
                                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white"
                                />
                            </div>
                            {unlockError && <p className="text-red-500 text-xs font-mono">{unlockError}</p>}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleUnlock}
                                    disabled={unlockLoading || !unlockPrivKey.trim()}
                                    className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-6 py-3 border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(242,104,34,1)] hover:bg-monero-orange hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {unlockLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                    Unlock
                                </button>
                                <button
                                    onClick={() => setUnlockOpen(false)}
                                    className="font-mono text-xs font-black uppercase px-6 py-3 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`font-mono text-xs font-black uppercase px-4 py-2 border-2 transition-colors ${activeTab === 'products' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white'}`}
                >
                    <Package size={12} className="inline mr-1" /> Products ({products.length})
                </button>
                <button
                    onClick={() => { setActiveTab('orders'); loadOrders(); }}
                    className={`font-mono text-xs font-black uppercase px-4 py-2 border-2 transition-colors relative ${activeTab === 'orders' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white'}`}
                >
                    <ShoppingCart size={12} className="inline mr-1" /> Orders ({orders.length})
                    {notifications.total > 0 && (
                        <span className="absolute -top-2 -right-2 bg-monero-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.total}</span>
                    )}
                </button>
            </div>

            {/* Products Tab */}
            {activeTab === 'products' && (
                <div className="space-y-3">
                    <button
                        onClick={() => onOpenAddProduct()}
                        className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 p-4 font-mono text-xs uppercase text-gray-500 hover:border-monero-orange hover:text-monero-orange transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={14} /> Add Product
                    </button>

                    {/* 3D: search + type chips (always shown so the seller can find products even when none are listed in the current view) */}
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                        <input
                            type="search"
                            value={productSearch}
                            onChange={e => { setProductOffset(0); setProductSearch(e.target.value); }}
                            placeholder="Search by name or description…"
                            className="flex-1 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-xs dark:text-white placeholder:text-gray-400"
                        />
                        <div className="flex gap-1 flex-wrap">
                            {(['', 'physical', 'digital', 'service'] as const).map(t => (
                                <button
                                    key={t || 'all'}
                                    onClick={() => { setProductOffset(0); setProductTypeFilter(t); }}
                                    className={`font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 transition-colors ${productTypeFilter === t ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white'}`}
                                >
                                    {t || 'all'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {products.map(product => (
                        <div key={product.id} className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {product.thumbnail_url && (
                                    <img src={product.thumbnail_url} alt="" className="w-10 h-10 object-cover border border-black dark:border-white" />
                                )}
                                <div className="min-w-0">
                                    <div className="font-mono font-bold text-sm dark:text-white truncate">{product.name || 'Unnamed'}</div>
                                    <div className="flex gap-2 mt-1">
                                        <span className="font-mono text-[10px] bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 uppercase dark:text-gray-300">{product.product_type}</span>
                                        <span className="font-mono text-[10px] text-monero-orange font-bold">{product.price_xmr} XMR</span>
                                        {product.visibility === 'pgp_only' && (
                                            <span className="font-mono text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1.5 py-0.5">PGP</span>
                                        )}
                                        <span className="font-mono text-[10px] text-gray-400">
                                            {product.stock === -1 ? 'Unlimited' : `${product.stock} left`} | {product.sales} sold | {product.views} views
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 ml-2">
                                <button
                                    onClick={() => onOpenAddProduct(product)}
                                    className="p-2 border border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                    title="Edit"
                                >
                                    <Wrench size={12} className="dark:text-white" />
                                </button>
                                <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="p-2 border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Deactivate"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {products.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-700">
                            <Package size={32} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                            <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {productSearch || productTypeFilter ? 'No matching products' : 'No products yet'}
                            </p>
                            <p className="font-mono text-[10px] text-gray-400 dark:text-zinc-500">
                                {productSearch || productTypeFilter ? 'Try a different search or clear filters' : 'Click "Add Product" above to list your first item'}
                            </p>
                        </div>
                    )}

                    {/* 3D: pagination — only if there's more than one page */}
                    {productTotal > PRODUCT_LIMIT && (
                        <div className="flex items-center justify-between gap-2">
                            <button
                                disabled={productOffset === 0}
                                onClick={() => setProductOffset(o => Math.max(0, o - PRODUCT_LIMIT))}
                                className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                            >
                                ← Prev
                            </button>
                            <span className="font-mono text-[10px] text-gray-600 dark:text-gray-400">
                                {productOffset + 1}–{Math.min(productOffset + PRODUCT_LIMIT, productTotal)} of {productTotal}
                            </span>
                            <button
                                disabled={productOffset + PRODUCT_LIMIT >= productTotal}
                                onClick={() => setProductOffset(o => o + PRODUCT_LIMIT)}
                                className="font-mono text-[10px] font-bold uppercase px-3 py-2 border-2 border-black dark:border-white dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="space-y-3">
                    {/* Unlock-orders bar — controls client-side decryption of buyer-submitted fields */}
                    <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Lock size={14} className={unlockedKeyObj ? 'text-green-600' : 'text-gray-400'} />
                            <div>
                                <div className="font-mono text-[10px] font-bold uppercase dark:text-white">
                                    {unlockedKeyObj ? 'Orders unlocked (session)' : 'Orders locked'}
                                </div>
                                <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                    {unlockedKeyObj ? 'Buyer fields decrypt in your browser only.' : 'Paste your PGP private key to decrypt buyer info.'}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => unlockedKeyObj ? lockOrders() : setUnlockOpen(true)}
                            className="font-mono text-[10px] font-black uppercase px-3 py-1.5 border-2 border-black dark:border-white hover:bg-monero-orange hover:border-monero-orange hover:text-white transition-colors dark:text-white"
                        >
                            {unlockedKeyObj ? 'Lock' : 'Unlock orders'}
                        </button>
                    </div>
                    {orders.map(order => {
                        let proof = null;
                        try { proof = order.buyer_proof ? JSON.parse(order.buyer_proof) : null; } catch { }
                        const decrypted = decryptedOrders[order.id];
                        const hasEncryptedPayload = !!order.encrypted_data && order.encrypted_data.includes('BEGIN PGP MESSAGE');
                        return (
                            <div key={order.id} className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-mono font-bold text-sm dark:text-white">{order.order_code}</div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-1">
                                            {order.buyer_username ? `Buyer: ${order.buyer_username}` : 'Anonymous buyer'}
                                            {' | '}{new Date(order.created_at).toLocaleDateString()}
                                            {' | '}{order.price_xmr} XMR
                                        </div>
                                    </div>
                                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 border ${STATUS_COLORS[order.status] || 'bg-gray-100 border-gray-300'}`}>
                                        {order.status}
                                    </span>
                                </div>

                                {/* Buyer-submitted form (3B): encrypted at rest, decrypted client-side */}
                                {hasEncryptedPayload && (
                                    <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/40">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-mono text-[10px] text-purple-700 dark:text-purple-300 uppercase flex items-center gap-1">
                                                <Lock size={10} /> Buyer Info (PGP)
                                            </div>
                                            {!decrypted && (
                                                <button
                                                    onClick={() => decryptOrder(order)}
                                                    disabled={!unlockedKeyObj}
                                                    className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-purple-400 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title={!unlockedKeyObj ? 'Unlock orders first' : ''}
                                                >
                                                    <Eye size={10} className="inline" /> Decrypt
                                                </button>
                                            )}
                                        </div>
                                        {decrypted && 'error' in decrypted && (
                                            <div className="font-mono text-[10px] text-red-500">Decrypt failed: {decrypted.error}</div>
                                        )}
                                        {decrypted && 'fields' in decrypted && (
                                            <div className="space-y-1">
                                                {Object.keys(decrypted.fields).length === 0 && (
                                                    <div className="font-mono text-[10px] text-gray-500 italic">No fields submitted</div>
                                                )}
                                                {Object.entries(decrypted.fields).map(([k, v]) => (
                                                    <div key={k} className="font-mono text-[10px] dark:text-gray-200">
                                                        <span className="text-gray-500">{k}:</span> <span className="whitespace-pre-wrap break-words">{String(v)}</span>
                                                    </div>
                                                ))}
                                                {decrypted.submitted_at && (
                                                    <div className="font-mono text-[10px] text-gray-400 italic mt-1">submitted: {new Date(decrypted.submitted_at).toLocaleString()}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Buyer proof */}
                                {proof && (
                                    <div className="mt-3 p-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                                        <div className="font-mono text-[10px] text-gray-500 uppercase mb-1">Payment Proof</div>
                                        <div className="font-mono text-xs dark:text-gray-300 break-all">TXID: {proof.txid}</div>
                                        {proof.tx_key && <div className="font-mono text-xs dark:text-gray-300 break-all">TX Key: {proof.tx_key}</div>}
                                    </div>
                                )}

                                {/* Status actions */}
                                {order.status === 'pending' && proof && (
                                    <div className="mt-3 flex gap-2 flex-wrap">
                                        {proof.tx_key && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await apiFetch('/api/store/verify-payment', {
                                                            method: 'POST',
                                                            body: JSON.stringify({
                                                                txid: proof.txid,
                                                                tx_key: proof.tx_key,
                                                                address: storeConfig?.monero_address,
                                                                expected_amount: order.price_xmr
                                                            })
                                                        });
                                                        const data = await res.json();
                                                        if (data.verified) {
                                                            showToast(`Payment verified on-chain: ${data.received_xmr} XMR, ${data.confirmations} confirmations`, 'success', 5000);
                                                            await handleUpdateOrderStatus(order.id, 'paid');
                                                        } else {
                                                            showToast(`Verification failed: received ${data.received_xmr || '0'} XMR`, 'warning', 5000);
                                                        }
                                                    } catch {
                                                        showToast('On-chain verification failed', 'error');
                                                    }
                                                }}
                                                className="bg-blue-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-1.5 hover:bg-blue-700 transition-colors flex items-center gap-1"
                                            >
                                                Verify On-Chain
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleUpdateOrderStatus(order.id, 'paid')}
                                            className="bg-green-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-1.5 hover:bg-green-700 transition-colors flex items-center gap-1"
                                        >
                                            <Check size={10} /> Mark Paid Manually
                                        </button>
                                    </div>
                                )}
                                {order.status === 'paid' && (
                                    <div className="mt-3 flex gap-2 flex-wrap">
                                        <button onClick={() => handleUpdateOrderStatus(order.id, 'processing')} className="bg-blue-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-2.5 hover:bg-blue-700 transition-colors">Processing</button>
                                        <button onClick={() => handleUpdateOrderStatus(order.id, 'shipped')} className="bg-purple-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-2.5 hover:bg-purple-700 transition-colors">Shipped</button>
                                        <button onClick={() => { if (confirm('Mark this order as complete? This cannot be undone.')) handleUpdateOrderStatus(order.id, 'complete'); }} className="bg-green-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-2.5 hover:bg-green-700 transition-colors">Complete</button>
                                    </div>
                                )}
                                {(order.status === 'processing' || order.status === 'shipped') && (
                                    <button onClick={() => { if (confirm('Mark this order as complete? This cannot be undone.')) handleUpdateOrderStatus(order.id, 'complete'); }} className="mt-3 bg-green-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-2.5 hover:bg-green-700 transition-colors">
                                        Mark Complete
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {orders.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-700">
                            <ShoppingCart size={32} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                            <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-1">No orders yet</p>
                            <p className="font-mono text-[10px] text-gray-400 dark:text-zinc-500">Orders will appear here when buyers purchase from your store</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
