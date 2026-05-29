// #4.1: client-side order history. Every order the buyer creates from this device is recorded
// in localStorage so they can find it again without an account. Server never learns the list —
// only one order_code per fetch when they ask to track. Opsec property: there is no buyer→orders
// index anywhere except in the buyer's own browser.

export type StoredOrder = {
    order_code: string;
    product_name: string;
    seller: string;
    price_xmr: number;
    created_at: string; // ISO
};

const KEY = 'goxmr_orders_v1';
const MAX = 200; // soft cap so localStorage doesn't grow forever

export function loadOrders(): StoredOrder[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function saveOrder(o: StoredOrder) {
    try {
        const list = loadOrders();
        // dedupe by code (re-saving the same order shouldn't add a row)
        const filtered = list.filter(x => x.order_code !== o.order_code);
        filtered.unshift(o);
        localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
    } catch { /* localStorage full or disabled — silently drop */ }
}

export function forgetOrder(orderCode: string) {
    try {
        const list = loadOrders().filter(o => o.order_code !== orderCode);
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
}

export function clearAllOrders() {
    try { localStorage.removeItem(KEY); } catch {}
}
