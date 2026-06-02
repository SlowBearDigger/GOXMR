// shared, health-aware pool of monerod endpoints.
//
// before this module the daemon list logic lived twice — once in
// monero_monitor._buildNodeList/_ensureDaemonConnection and once in
// pay/wallet_pool.buildNodeList — and the two had drifted (the monitor learned
// liveness via isConnectedToDaemon + sticky rotation, the pay pool only tried
// nodes in env order). both now consume this single source of truth.
//
// on top of dedupe + failover it adds:
//   - a background prober that hits GET /get_info on every node, recording
//     height, round-trip latency, and liveness, then deprioritizes nodes that
//     lag the chain tip or stop answering.
//   - a CORS probe (preflight OPTIONS) so we know which nodes a *browser* can
//     reach directly — that subset is what the client-side WASM scanner needs,
//     exposed via corsNodes(). most public nodes don't send CORS headers, so
//     this can't be assumed; it has to be measured.
//   - tls / onion tagging so callers can filter by reachability.
//
// tor: .onion nodes are tagged and, unless MONERO_TOR_PROXY is set, kept out of
// the default rotation (node's global fetch can't reach them without a SOCKS
// agent). full SOCKS wiring for the prober is the next slice — see urls().

const DEFAULT_NODE = 'https://xmr-node.cakewallet.com:18081';
const PROBE_INTERVAL_MS = Number(process.env.MONERO_NODE_PROBE_INTERVAL_MS) || 2 * 60 * 1000;
const PROBE_TIMEOUT_MS = Number(process.env.MONERO_NODE_PROBE_TIMEOUT_MS) || 8000;
const BEHIND_TIP_BLOCKS = Number(process.env.MONERO_NODE_BEHIND_TIP_BLOCKS) || 3;
const PROBE_ORIGIN = process.env.MONERO_NODE_PROBE_ORIGIN || 'https://goxmr.click';

// normalize a user-supplied node string to a canonical http(s) origin with no
// trailing slash. bare host or :443 -> https, any other explicit port -> http.
// (kept identical in spirit to the two prior implementations so existing env
// values keep resolving to the same url.)
function normalizeUrl(u) {
    u = (u || '').trim();
    if (!u) return null;
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = (u.includes(':443') || !u.includes(':')) ? ('https://' + u) : ('http://' + u);
    }
    return u.replace(/\/+$/, '');
}

function hostOf(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

class NodePool {
    constructor({ autoStart = true } = {}) {
        // url -> node record. insertion order is the env priority order, used as
        // the tie-break before any health data exists.
        this.nodes = new Map();
        this.tipHeight = 0;
        this._timer = null;

        this._seedFromEnv();

        const probingDisabled = process.env.MONERO_NODE_PROBE_DISABLED === '1';
        if (autoStart && !probingDisabled) this.start();
    }

    _seed(url, { cors = null } = {}) {
        const n = normalizeUrl(url);
        if (!n || this.nodes.has(n)) return;
        const host = hostOf(n);
        this.nodes.set(n, {
            url: n,
            tls: n.startsWith('https://'),
            onion: host.endsWith('.onion'),
            // null = not yet measured. operators can pre-assert cors for their
            // own node via MONERO_CORS_NODES so the WASM client can use it before
            // the first probe round lands.
            cors,
            healthy: null,
            height: 0,
            latencyMs: null,
            lagging: false,
            failCount: 0,
            lastChecked: null,
            lastError: null,
        });
    }

    _seedFromEnv() {
        const primary = (process.env.MONERO_WALLET_RPC_URL || process.env.MONERO_NODE_URL || '').trim();
        const fallbacks = (process.env.MONERO_NODE_FALLBACKS || '').split(/[,\s]+/).filter(Boolean);
        const corsPinned = (process.env.MONERO_CORS_NODES || '').split(/[,\s]+/).filter(Boolean);

        for (const u of [primary, ...fallbacks]) this._seed(u);
        for (const u of corsPinned) {
            const n = normalizeUrl(u);
            this._seed(u, { cors: true });
            if (n && this.nodes.has(n)) this.nodes.get(n).cors = true;
        }
        if (this.nodes.size === 0) this._seed(DEFAULT_NODE);
    }

    start() {
        if (this._timer) return;
        // kick an immediate round so health is fresh within seconds of boot,
        // then settle into the interval. unref so the prober never by itself
        // keeps the process (or a test harness) alive.
        this.probeAll().catch(() => {});
        this._timer = setInterval(() => this.probeAll().catch(() => {}), PROBE_INTERVAL_MS);
        if (typeof this._timer.unref === 'function') this._timer.unref();
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }

    // probe every reachable node, then recompute the chain tip and flag laggards.
    async probeAll() {
        const targets = [...this.nodes.values()].filter(n => !n.onion || this._torEnabled());
        await Promise.allSettled(targets.map(n => this._probeOne(n)));

        // chain tip = highest height any healthy node reported this round. a node
        // more than BEHIND_TIP_BLOCKS behind it is either still syncing or lying;
        // either way we don't want to scan against it.
        const heights = targets.filter(n => n.healthy && n.height > 0).map(n => n.height);
        this.tipHeight = heights.length ? Math.max(...heights) : this.tipHeight;
        for (const n of targets) {
            n.lagging = !!(n.healthy && this.tipHeight && (this.tipHeight - n.height) > BEHIND_TIP_BLOCKS);
        }
        return this.snapshot();
    }

    async _probeOne(node) {
        const started = Date.now();
        try {
            const res = await fetch(node.url + '/get_info', {
                method: 'GET',
                headers: { 'Origin': PROBE_ORIGIN, 'Accept': 'application/json' },
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
            node.latencyMs = Date.now() - started;
            const info = await res.json().catch(() => ({}));
            const height = Number(info.height || info.target_height || 0) || 0;
            const ok = res.ok && (info.status === 'OK' || height > 0);

            // CORS from the simple GET (some nodes echo ACAO on every response).
            const acaoSimple = res.headers.get('access-control-allow-origin');
            // authoritative CORS signal: the preflight a browser actually sends
            // before monero-ts's POST /json_rpc (content-type: application/json
            // is not a "simple" request, so it always preflights).
            const corsPreflight = await this._probeCors(node.url);
            const cors = corsPreflight || (!!acaoSimple);

            if (ok) {
                node.healthy = true;
                node.height = height;
                node.failCount = 0;
                node.lastError = null;
                if (cors) node.cors = true;
                else if (node.cors !== true) node.cors = false; // don't clobber an operator-pinned true
            } else {
                node.healthy = false;
                node.failCount++;
                node.lastError = `HTTP ${res.status}`;
            }
        } catch (err) {
            node.latencyMs = Date.now() - started;
            node.healthy = false;
            node.failCount++;
            node.lastError = err.name === 'TimeoutError' ? 'timeout' : (err.message || 'unreachable');
        } finally {
            node.lastChecked = new Date().toISOString();
        }
    }

    // send the exact preflight a browser would for monero-ts's daemon calls and
    // report whether the node would let the origin through.
    async _probeCors(url) {
        try {
            const res = await fetch(url + '/get_info', {
                method: 'OPTIONS',
                headers: {
                    'Origin': PROBE_ORIGIN,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type',
                },
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
            const acao = res.headers.get('access-control-allow-origin');
            if (!acao) return false;
            if (acao !== '*' && acao.toLowerCase() !== PROBE_ORIGIN.toLowerCase()) return false;
            const methods = (res.headers.get('access-control-allow-methods') || '').toUpperCase();
            // some nodes omit allow-methods but still serve cross-origin; accept
            // a bare ACAO match, prefer ones that explicitly allow POST.
            return methods === '' || methods.includes('POST');
        } catch {
            return false;
        }
    }

    _torEnabled() {
        return !!(process.env.MONERO_TOR_PROXY || '').trim();
    }

    // prioritized url list for the server-side wallet consumers' failover loops.
    // health-sorted: live + on-tip first (lowest latency wins), then untested,
    // then known-down as a last resort. onion nodes are excluded unless a tor
    // proxy is configured (the wallet lib, not this prober, dials them).
    urls() {
        const all = [...this.nodes.values()].filter(n => !n.onion || this._torEnabled());
        const order = [...this.nodes.keys()]; // env priority for tie-breaks
        const rank = (n) => {
            if (n.healthy === true) return n.lagging ? 1 : 0;
            if (n.healthy === null) return 2;
            return 3;
        };
        const sorted = all.slice().sort((a, b) => {
            const r = rank(a) - rank(b);
            if (r !== 0) return r;
            if (a.healthy === true && b.healthy === true) {
                if ((a.latencyMs ?? 1e9) !== (b.latencyMs ?? 1e9)) return (a.latencyMs ?? 1e9) - (b.latencyMs ?? 1e9);
            }
            return order.indexOf(a.url) - order.indexOf(b.url);
        });
        const urls = sorted.map(n => n.url);
        return urls.length ? urls : [DEFAULT_NODE];
    }

    best() {
        return this.urls()[0];
    }

    // browser-reachable subset for the client-side WASM scanner: healthy, https,
    // CORS-capable, non-onion. shape kept minimal — it's a public endpoint.
    corsNodes() {
        return [...this.nodes.values()]
            .filter(n => n.healthy === true && n.cors === true && n.tls && !n.onion && !n.lagging)
            .sort((a, b) => (a.latencyMs ?? 1e9) - (b.latencyMs ?? 1e9))
            .map(n => ({ url: n.url, height: n.height, latency_ms: n.latencyMs }));
    }

    // full metadata, for operator status views / debugging.
    snapshot() {
        return {
            tip_height: this.tipHeight,
            tor: this._torEnabled(),
            nodes: [...this.nodes.values()].map(n => ({ ...n })),
        };
    }

    // runtime feedback from consumers: a wallet that actually connected (or
    // failed) feeds that back so ordering reflects reality between probe rounds.
    markOk(url) {
        const n = this.nodes.get(normalizeUrl(url));
        if (n) { n.healthy = true; n.failCount = 0; n.lastChecked = new Date().toISOString(); }
    }

    markFail(url) {
        const n = this.nodes.get(normalizeUrl(url));
        if (n) { n.failCount++; if (n.failCount >= 2) n.healthy = false; n.lastChecked = new Date().toISOString(); }
    }
}

// singleton shared by every consumer; export the class too for isolated tests.
const nodePool = new NodePool();

module.exports = { nodePool, NodePool, normalizeUrl };
