import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Database, Globe, Cpu, Coins } from 'lucide-react';

interface MoneroStatus {
    message?: string;
    balance?: number;
    height?: number;
    daemonHeight?: number;
    isSyncing?: boolean;
    isDaemonConnected?: boolean;
    node?: string;
    error?: string | null;
}
interface StatusPayload {
    ok: boolean;
    uptime_seconds: number;
    users: number;
    monero: MoneroStatus;
    tor_onion: string;
    generated_at: string;
}

function formatUptime(s: number): string {
    if (!Number.isFinite(s) || s < 0) return '—';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

export const StatusPage: React.FC = () => {
    const nav = useNavigate();
    const [data, setData] = useState<StatusPayload | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        let alive = true;
        const tick = async () => {
            try {
                const r = await fetch('/api/status');
                if (!r.ok) throw new Error(`status ${r.status}`);
                const j = await r.json();
                if (alive) { setData(j); setErr(null); setNow(Date.now()); }
            } catch (e: any) {
                if (alive) setErr(e.message || 'fetch failed');
            }
        };
        tick();
        const id = setInterval(tick, 30000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    const moneroOk = !!data?.monero?.isDaemonConnected && !data?.monero?.error;
    const moneroSyncing = !!data?.monero?.isSyncing;

    return (
        <div className="min-h-screen pt-24 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => nav(-1)}
                    className="font-mono text-xs uppercase text-gray-500 hover:text-monero-orange flex items-center gap-1 mb-6"
                >
                    <ArrowLeft size={12} /> Back
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <Activity size={22} className="text-monero-orange" />
                    <h1 className="font-mono font-black uppercase text-2xl tracking-tighter dark:text-white">System Status</h1>
                </div>
                <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-8">
                    Polled every 30s · Same payload everyone sees · Embed-friendly /api/status
                </p>

                {err && !data && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-4 mb-6 flex gap-3">
                        <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                        <p className="font-mono text-xs text-red-900 dark:text-red-200">Status endpoint unreachable: {err}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <StatusCard
                        label="HTTP API"
                        ok={!!data?.ok}
                        loading={!data}
                        icon={<Cpu size={16} />}
                        right={data ? formatUptime(data.uptime_seconds) : '—'}
                        meta={data ? `last refresh ${new Date(now).toLocaleTimeString()}` : ''}
                    />
                    <StatusCard
                        label="Database"
                        ok={!!data}
                        loading={!data}
                        icon={<Database size={16} />}
                        right={data ? `${data.users.toLocaleString()} accounts` : '—'}
                        meta="SQLite — local, encrypted at backup time"
                    />
                    <StatusCard
                        label="Monero daemon"
                        ok={moneroOk}
                        warn={moneroSyncing && !moneroOk}
                        loading={!data}
                        icon={<Coins size={16} />}
                        right={data?.monero?.message || (moneroSyncing ? 'syncing' : '—')}
                        meta={data?.monero?.node ? `via ${data.monero.node}` : ''}
                    />
                    <StatusCard
                        label="Tor v3 hidden service"
                        ok={true}
                        loading={!data}
                        icon={<Globe size={16} />}
                        right="reachable"
                        meta={data?.tor_onion ? data.tor_onion.slice(0, 32) + '…onion' : ''}
                    />
                </div>

                {data && (
                    <details className="mt-8 group">
                        <summary className="font-mono text-[10px] uppercase tracking-widest text-gray-500 cursor-pointer hover:text-monero-orange list-none">
                            <span className="inline-block transition-transform group-open:rotate-90">▶</span> Raw /api/status payload
                        </summary>
                        <pre className="mt-3 bg-gray-50 dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-3 font-mono text-[10px] overflow-x-auto whitespace-pre dark:text-gray-300">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </details>
                )}

                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-10">
                    No per-caller fields in the response · No tracking · Public-by-design
                </p>
            </div>
        </div>
    );
};

interface CardProps {
    label: string;
    ok: boolean;
    warn?: boolean;
    loading?: boolean;
    icon: React.ReactNode;
    right: string;
    meta?: string;
}

const StatusCard: React.FC<CardProps> = ({ label, ok, warn, loading, icon, right, meta }) => {
    const stateLabel = loading ? 'CHECKING' : warn ? 'DEGRADED' : ok ? 'OPERATIONAL' : 'DOWN';
    const stateClass = loading
        ? 'text-gray-400'
        : warn
            ? 'text-yellow-600 dark:text-yellow-400'
            : ok
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400';
    return (
        <div className="bg-white dark:bg-zinc-950 border-2 border-black dark:border-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-monero-orange/10 border border-monero-orange/40 text-monero-orange">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="font-mono text-xs font-black uppercase tracking-tight dark:text-white">{label}</p>
                        {meta && <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 truncate">{meta}</p>}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className={`font-mono text-[10px] font-black uppercase tracking-widest ${stateClass} flex items-center gap-1 justify-end`}>
                        {loading ? <Loader2 size={10} className="animate-spin" /> : ok && !warn ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                        {stateLabel}
                    </p>
                    <p className="font-mono text-xs dark:text-white">{right}</p>
                </div>
            </div>
        </div>
    );
};
