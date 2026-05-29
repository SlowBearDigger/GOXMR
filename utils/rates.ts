// 3E: lightweight client-side cache for /api/rates. Single shared in-memory promise so
// repeated callers don't fire duplicate fetches; localStorage backstops a stale value
// across page navigation. Cache TTL matches the server's 5min so we don't hammer it.

export type CurrencyCode = 'XMR' | 'BTC' | 'LTC' | 'ETH' | 'BCH' | 'SOL' | 'DOGE';
export type FiatCode = 'usd' | 'eur';
export type RatesMap = Partial<Record<CurrencyCode, Record<FiatCode, number>>>;

const STORAGE_KEY = 'goxmr_rates_v1';
const TTL_MS = 5 * 60 * 1000;

let inflight: Promise<RatesMap> | null = null;
let memCache: { rates: RatesMap; ts: number } | null = null;

function readStorage(): { rates: RatesMap; ts: number } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}
function writeStorage(rates: RatesMap) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rates, ts: Date.now() })); } catch {}
}

export async function fetchRates(): Promise<RatesMap> {
    const now = Date.now();
    if (memCache && now - memCache.ts < TTL_MS) return memCache.rates;
    if (inflight) return inflight;
    const stored = readStorage();
    if (stored && now - stored.ts < TTL_MS) {
        memCache = stored;
        return stored.rates;
    }
    inflight = (async () => {
        try {
            const r = await fetch('/api/rates');
            if (!r.ok) throw new Error('rates ' + r.status);
            const data = await r.json();
            const rates: RatesMap = data.rates || {};
            memCache = { rates, ts: Date.now() };
            writeStorage(rates);
            return rates;
        } catch {
            // fall back to stale storage if we have anything
            if (stored) return stored.rates;
            return {};
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** Convert an XMR amount to any other supported currency (crypto or fiat). */
export function convertFromXMR(amountXmr: number, target: CurrencyCode | FiatCode, rates: RatesMap): number | null {
    const xmr = rates.XMR;
    if (!xmr) return null;
    if (target === 'usd' || target === 'eur') {
        const v = xmr[target];
        return typeof v === 'number' ? amountXmr * v : null;
    }
    // crypto: convert via USD (target_per_usd = 1 / target.usd)
    const targetRates = rates[target as CurrencyCode];
    if (!targetRates?.usd || !xmr.usd) return null;
    return amountXmr * (xmr.usd / targetRates.usd);
}

export function formatFiat(amount: number, code: FiatCode): string {
    const sym = code === 'usd' ? '$' : '€';
    return `${sym}${amount.toFixed(2)}`;
}

export function formatCrypto(amount: number, code: CurrencyCode): string {
    // Pick decimals based on typical denominations
    const decimals = code === 'XMR' ? 4 : code === 'BTC' ? 8 : code === 'ETH' ? 6 : 4;
    return `${amount.toFixed(decimals)} ${code}`;
}
