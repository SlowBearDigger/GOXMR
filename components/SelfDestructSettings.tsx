import React, { useEffect, useState } from 'react';
import { Loader2, Skull, Heart, Trash2, AlertTriangle } from 'lucide-react';
import { showToast } from './Toast';

// Self-destruct profile timer. Arm a future date — if the user does not heartbeat
// or disarm before then, the background sweeper wipes their data on the server.
// This is for dead-man / lost-device / persecution scenarios; not casual use.

const PRESET_DAYS = [
    { label: '7 days', val: 7 },
    { label: '30 days', val: 30 },
    { label: '90 days', val: 90 },
    { label: '180 days', val: 180 },
    { label: '365 days', val: 365 },
];

export const SelfDestructSettings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [targetAt, setTargetAt] = useState<string | null>(null);
    const [days, setDays] = useState(30);
    const [confirming, setConfirming] = useState(false);

    const apiFetch = (url: string, opts?: RequestInit) => {
        const token = localStorage.getItem('goxmr_token');
        return fetch(url, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                ...(opts?.headers || {}),
            },
        });
    };

    const load = async () => {
        setLoading(true);
        try {
            const r = await apiFetch('/api/me/self-destruct');
            if (r.ok) {
                const data = await r.json();
                setTargetAt(data.self_destruct_at || null);
            }
        } catch {}
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const arm = async () => {
        setBusy(true);
        try {
            const r = await apiFetch('/api/me/self-destruct', { method: 'PUT', body: JSON.stringify({ days }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Failed to arm');
            setTargetAt(data.self_destruct_at);
            setConfirming(false);
            showToast(`Timer armed for ${days} days`, 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
        setBusy(false);
    };

    const heartbeat = async () => {
        setBusy(true);
        try {
            const r = await apiFetch('/api/me/self-destruct/heartbeat', { method: 'POST', body: JSON.stringify({ days }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Failed to heartbeat');
            setTargetAt(data.self_destruct_at);
            showToast('Timer reset — still alive', 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
        setBusy(false);
    };

    const disarm = async () => {
        if (!confirm('Disarm the self-destruct timer? Your profile stays.')) return;
        setBusy(true);
        try {
            const r = await apiFetch('/api/me/self-destruct', { method: 'DELETE' });
            if (!r.ok) throw new Error('Failed to disarm');
            setTargetAt(null);
            showToast('Disarmed', 'info');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
        setBusy(false);
    };

    if (loading) return <div className="py-4 flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span className="font-mono text-xs">Loading timer…</span></div>;

    const armed = !!targetAt;
    const msLeft = armed ? new Date(targetAt!).getTime() - Date.now() : 0;
    const daysLeft = Math.floor(msLeft / 86400000);
    const hoursLeft = Math.floor((msLeft % 86400000) / 3600000);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <Skull size={16} className="text-monero-orange" />
                <h3 className="font-mono font-black uppercase text-sm dark:text-white">Self-Destruct Timer</h3>
            </div>
            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                If you don't heartbeat before the timer expires, your profile, links, store, products, DMs, and dead-man drops are wiped from the server. Your identity row is tombstoned. Use this for lost-device or persecution recovery — not casual paranoia.
            </p>

            {armed ? (
                <div className="border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20 p-3 space-y-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="font-mono text-xs">
                            <div className="font-black uppercase text-red-700 dark:text-red-300">Timer armed</div>
                            <div className="text-red-600 dark:text-red-400">{daysLeft}d {hoursLeft}h remaining — wipe at {new Date(targetAt!).toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={heartbeat}
                            disabled={busy}
                            className="font-mono text-[10px] font-black uppercase px-3 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                            <Heart size={11} /> Heartbeat ({days}d)
                        </button>
                        <button
                            onClick={disarm}
                            disabled={busy}
                            className="font-mono text-[10px] font-black uppercase px-3 py-2 border-2 border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                            <Trash2 size={11} /> Disarm
                        </button>
                    </div>
                </div>
            ) : confirming ? (
                <div className="border-2 border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-3">
                    <p className="font-mono text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
                        Arm timer? You'll need to heartbeat before <span className="font-black">{new Date(Date.now() + days * 86400 * 1000).toLocaleDateString()}</span> or your account is wiped automatically. This is irreversible after wipe.
                    </p>
                    <div className="flex gap-2">
                        <button onClick={arm} disabled={busy} className="font-mono text-[10px] font-black uppercase px-3 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <Skull size={11} />} Confirm Arm
                        </button>
                        <button onClick={() => setConfirming(false)} className="font-mono text-[10px] font-black uppercase px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase tracking-wider dark:text-white block mb-1">Timer length</label>
                        <div className="flex gap-1 flex-wrap">
                            {PRESET_DAYS.map(p => (
                                <button
                                    key={p.val}
                                    onClick={() => setDays(p.val)}
                                    className={`font-mono text-[10px] font-bold uppercase px-2 py-1.5 border-2 transition-colors ${days === p.val ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white dark:text-white'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <input
                                type="number"
                                min={1}
                                max={3650}
                                value={days}
                                onChange={e => setDays(Math.max(1, Math.min(3650, parseInt(e.target.value) || 1)))}
                                className="w-20 border-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-[10px] dark:text-white"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setConfirming(true)}
                        className="font-mono text-[10px] font-black uppercase px-3 py-2 border-2 border-red-500 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1"
                    >
                        <Skull size={11} /> Arm Timer
                    </button>
                </div>
            )}
        </div>
    );
};
