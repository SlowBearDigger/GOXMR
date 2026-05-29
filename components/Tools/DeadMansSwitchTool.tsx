import React, { useState, useEffect } from 'react';
import { Clock, Heart, Trash2, AlertTriangle, Loader2, Check, Lock, Shield } from 'lucide-react';
import { showToast } from '../Toast';

interface DeadMansSwitchToolProps {
    isLoggedIn: boolean;
    isPremium: boolean;
}

interface Switch {
    id: number;
    encryption_method: string;
    recipient_code: string;
    heartbeat_interval_days: number;
    last_heartbeat: string;
    next_trigger_at: string;
    is_active: number;
    is_triggered: number;
    triggered_drop_code: string;
    created_at: string;
}

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

// Client-side AES encryption (same as DropsTool)
const encryptAES = async (text: string, pass: string) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.deriveKey(
        // OWASP 2024 baseline for PBKDF2-SHA256 (read-side has a 100k fallback for legacy data)
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
};

export const DeadMansSwitchTool: React.FC<DeadMansSwitchToolProps> = ({ isLoggedIn, isPremium }) => {
    const [switches, setSwitches] = useState<Switch[]>([]);
    const [loading, setLoading] = useState(false);

    // Create form
    const [content, setContent] = useState('');
    const [password, setPassword] = useState('');
    const [interval, setInterval_] = useState('30');
    const [recipientCode, setRecipientCode] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isLoggedIn) loadSwitches();
    }, [isLoggedIn]);

    const loadSwitches = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/me/deadman');
            if (res.ok) {
                const data = await res.json();
                setSwitches(data.switches || []);
            }
        } catch { }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!content) {
            showToast('Content is required', 'warning');
            return;
        }
        if (!password || password.length < 8) {
            showToast('Password must be at least 8 characters', 'warning');
            return;
        }
        setCreating(true);
        try {
            const encrypted = await encryptAES(content, password);
            const res = await apiFetch('/api/tools/deadman', {
                method: 'POST',
                body: JSON.stringify({
                    encrypted_content: encrypted,
                    encryption_method: 'AES',
                    heartbeat_interval_days: parseInt(interval),
                    recipient_code: recipientCode || undefined
                })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Dead Man\'s Switch armed', 'success');
                setContent('');
                setPassword('');
                setRecipientCode('');
                await loadSwitches();
            } else {
                showToast(data.error || 'Failed to create switch', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
        setCreating(false);
    };

    const handleHeartbeat = async (id: number) => {
        try {
            const res = await apiFetch(`/api/tools/deadman/${id}/heartbeat`, { method: 'PUT' });
            if (res.ok) {
                showToast('Heartbeat recorded — timer reset', 'success');
                await loadSwitches();
            } else {
                showToast('Failed to record heartbeat', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handleDeactivate = async (id: number) => {
        try {
            const res = await apiFetch(`/api/tools/deadman/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Switch deactivated', 'success');
                await loadSwitches();
            }
        } catch { }
    };

    const getCountdown = (nextTrigger: string) => {
        const diff = new Date(nextTrigger).getTime() - Date.now();
        if (diff <= 0) return 'TRIGGERING...';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h remaining`;
    };

    if (!isLoggedIn) {
        return (
            <div className="text-center py-12">
                <Lock size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="font-mono text-sm text-gray-500">Login required to use Dead Man's Switch</p>
            </div>
        );
    }

    if (!isPremium) {
        return (
            <div className="text-center py-12">
                <Shield size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="font-mono text-sm text-gray-500">Dead Man's Switch requires Premium status</p>
                <p className="font-mono text-[10px] text-gray-400 mt-1">Upgrade to access scheduled encrypted releases</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Create new switch */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-zinc-900">
                <h3 className="font-mono font-black text-sm uppercase mb-4 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-500" /> Arm New Switch
                </h3>

                <div className="space-y-3">
                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">Secret Content</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="This message will be released if you fail to check in..."
                            rows={4}
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">Encryption Password *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Strong password..."
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">Heartbeat Interval</label>
                            <select
                                value={interval}
                                onChange={e => setInterval_(e.target.value)}
                                className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white"
                            >
                                <option value="7">7 days</option>
                                <option value="14">14 days</option>
                                <option value="30">30 days</option>
                                <option value="60">60 days</option>
                                <option value="90">90 days</option>
                                <option value="180">180 days</option>
                                <option value="365">365 days</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">Recipient (Optional)</label>
                        <input
                            type="text"
                            value={recipientCode}
                            onChange={e => setRecipientCode(e.target.value)}
                            placeholder="Username or note for who should receive this"
                            className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-800 p-2 font-mono text-xs dark:text-white"
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={creating || !content || !password}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase py-2.5 border-2 border-black dark:border-white hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {creating ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                        Arm Switch
                    </button>
                </div>
            </div>

            {/* Active switches */}
            {loading ? (
                <div className="text-center py-8">
                    <Loader2 size={20} className="animate-spin mx-auto" />
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Active = armed AND not yet triggered. Once triggered the entry shows below
                        in the "triggered" section instead so we don't render the same id twice. */}
                    {switches.filter(s => s.is_active && !s.is_triggered).map(sw => (
                        <div key={sw.id} className="border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-mono font-bold text-sm dark:text-white flex items-center gap-2">
                                        <Clock size={14} className="text-yellow-600" />
                                        {getCountdown(sw.next_trigger_at)}
                                    </div>
                                    <div className="font-mono text-[10px] text-gray-500 mt-1">
                                        Every {sw.heartbeat_interval_days} days | {sw.encryption_method} encrypted
                                        {sw.recipient_code && ` | To: ${sw.recipient_code}`}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleHeartbeat(sw.id)}
                                        className="bg-green-600 text-white font-mono text-[10px] font-bold uppercase px-3 py-2.5 hover:bg-green-700 transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-green-400"
                                    >
                                        <Heart size={12} /> Heartbeat
                                    </button>
                                    <button
                                        onClick={() => handleDeactivate(sw.id)}
                                        aria-label="Deactivate switch"
                                        className="p-2.5 border border-red-400 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Triggered switches */}
                    {switches.filter(s => s.is_triggered).map(sw => (
                        <div key={sw.id} className="border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 p-4">
                            <div className="font-mono font-bold text-sm text-red-700 dark:text-red-400">TRIGGERED</div>
                            <div className="font-mono text-[10px] text-gray-500 mt-1">
                                Drop code: <span className="font-bold">{sw.triggered_drop_code}</span>
                                {' | '}Triggered on {new Date(sw.next_trigger_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}

                    {switches.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-zinc-700">
                            <Clock size={32} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-mono text-sm text-gray-500">No switches armed</p>
                            <p className="font-mono text-[10px] text-gray-400">Create your first Dead Man's Switch above</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
