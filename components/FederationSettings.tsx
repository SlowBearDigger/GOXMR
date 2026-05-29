import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, Globe, Copy, AlertTriangle, ShieldCheck, ExternalLink, RefreshCw, Coins, Zap, Lock, AtSign } from 'lucide-react';
import { showToast } from './Toast';

const DOMAIN = (typeof window !== 'undefined' && window.location.host.replace(/^[^.]+\./, '')) || 'goxmr.click';
// strip per-user subdomain if we're rendering this on https://<user>.goxmr.click
const ROOT_DOMAIN = DOMAIN.includes('goxmr.click') ? 'goxmr.click' : DOMAIN;

interface Wallet { id: number; label: string; address: string }
interface FederationStatus {
    username: string;
    domain: string;
    openalias: { active: boolean; handle: string; selected_wallet_id: number | null; wallets: Wallet[] };
    nostr: { active: boolean; pubkey: string | null; handle: string };
    mastodon: { active: boolean; external_handle: string | null; handle: string };
    pgp: { active: boolean; fingerprint_hint: string | null };
}

type VerifyState = 'idle' | 'loading' | 'ok' | 'fail';

export const FederationSettings: React.FC<{ username: string }> = ({ username }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<FederationStatus | null>(null);
    const [nostrInput, setNostrInput] = useState('');
    const [mastodonInput, setMastodonInput] = useState('');
    const [selectedWalletId, setSelectedWalletId] = useState<number | 'auto'>('auto');
    const [verify, setVerify] = useState<Record<string, VerifyState>>({});

    const fetchStatus = useCallback(async () => {
        const token = localStorage.getItem('goxmr_token');
        try {
            const r = await fetch('/api/me/federation', { headers: { Authorization: 'Bearer ' + token } });
            if (!r.ok) return;
            const data: FederationStatus = await r.json();
            setStatus(data);
            setNostrInput(data.nostr.pubkey || '');
            setMastodonInput(data.mastodon.external_handle || '');
            setSelectedWalletId(data.openalias.selected_wallet_id ?? 'auto');
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const saveNostrMastodon = async () => {
        const errors: string[] = [];
        const n = nostrInput.trim();
        const m = mastodonInput.trim().replace(/^@/, '');
        if (n && !/^([a-f0-9]{64}|npub1[a-z0-9]{50,62})$/i.test(n)) errors.push('Nostr key must be 64 hex chars or npub1…');
        if (m && !/^[a-z0-9_.-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(m)) errors.push('Mastodon handle must look like name@instance.tld');
        if (errors.length) { showToast(errors[0], 'error'); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('goxmr_token');
            const r = await fetch('/api/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ nostr_pubkey: n || null, mastodon_handle: m || null }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Save failed');
            showToast('Identity updated', 'success');
            fetchStatus();
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const saveOpenAlias = async (id: number | 'auto') => {
        setSelectedWalletId(id);
        setSaving(true);
        try {
            const token = localStorage.getItem('goxmr_token');
            const r = await fetch('/api/me/openalias', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ wallet_id: id === 'auto' ? null : id }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Save failed');
            showToast('OpenAlias wallet updated. DNS propagates in a minute.', 'success');
            fetchStatus();
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const copyText = (s: string) => { navigator.clipboard.writeText(s); showToast('Copied: ' + s, 'info', 1500); };

    // Hit the public .well-known endpoint and assert the expected shape.
    const verifyOne = async (kind: 'openalias' | 'nostr' | 'mastodon') => {
        setVerify(v => ({ ...v, [kind]: 'loading' }));
        try {
            const lname = username.toLowerCase();
            if (kind === 'openalias') {
                // No client-side DNS, so probe via dns.google DoH.
                const r = await fetch(`https://dns.google/resolve?name=${lname}.${ROOT_DOMAIN}&type=TXT&do=1`);
                const j = await r.json();
                const txt = (j.Answer || []).find((a: any) => /oa1:xmr/i.test(a.data));
                setVerify(v => ({ ...v, openalias: txt ? 'ok' : 'fail' }));
            } else if (kind === 'nostr') {
                const r = await fetch(`/.well-known/nostr.json?name=${encodeURIComponent(lname)}`);
                const j = await r.json();
                setVerify(v => ({ ...v, nostr: j.names && j.names[lname] ? 'ok' : 'fail' }));
            } else if (kind === 'mastodon') {
                const r = await fetch(`/.well-known/webfinger?resource=${encodeURIComponent('acct:' + lname + '@' + ROOT_DOMAIN)}`);
                const j = await r.json();
                const hasSelf = (j.links || []).some((l: any) => l.rel === 'self' && /activity\+json/i.test(l.type || ''));
                setVerify(v => ({ ...v, mastodon: hasSelf ? 'ok' : 'fail' }));
            }
        } catch { setVerify(v => ({ ...v, [kind]: 'fail' })); }
    };

    if (loading) return <div className="py-4 flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span className="font-mono text-xs">Loading federation…</span></div>;
    if (!status) return null;

    const lname = username.toLowerCase();
    const oaHandle = `${lname}@${ROOT_DOMAIN}`;
    const profileSubdomain = `https://${lname}.${ROOT_DOMAIN}`;

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white flex items-center gap-2">
                        <Globe size={16} className="text-monero-orange" /> Federated Identity
                    </h3>
                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        One handle <span className="font-bold text-monero-orange">{oaHandle}</span> across XMR, Nostr, Mastodon, PGP.
                    </p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="font-mono text-[10px] uppercase tracking-wider text-gray-500 hover:text-monero-orange flex items-center gap-1"
                    title="Refresh status"
                >
                    <RefreshCw size={11} /> Refresh
                </button>
            </div>

            {/* OPENALIAS */}
            <SurfaceCard
                icon={<Coins size={14} />}
                title="OpenAlias (Monero)"
                active={status.openalias.active}
                verifyState={verify.openalias}
                onVerify={() => verifyOne('openalias')}
                handle={oaHandle}
                onCopy={() => copyText(oaHandle)}
            >
                {status.openalias.wallets.length === 0 ? (
                    <p className="font-mono text-[11px] text-amber-700 dark:text-amber-300">
                        No XMR wallets yet. Add one in <span className="font-bold">03_TREASURY</span> to publish your OpenAlias.
                    </p>
                ) : (
                    <>
                        <label className="font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                            Which XMR wallet should resolve when someone sends to {oaHandle}?
                        </label>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="oa-wallet"
                                    checked={selectedWalletId === 'auto'}
                                    onChange={() => saveOpenAlias('auto')}
                                    className="accent-monero-orange"
                                />
                                <span className="font-mono text-[11px] dark:text-white">
                                    Auto — first XMR wallet
                                    <span className="text-gray-500"> ({status.openalias.wallets[0]?.address.slice(0, 10)}…{status.openalias.wallets[0]?.address.slice(-6)})</span>
                                </span>
                            </label>
                            {status.openalias.wallets.map(w => (
                                <label key={w.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="oa-wallet"
                                        checked={selectedWalletId === w.id}
                                        onChange={() => saveOpenAlias(w.id)}
                                        className="accent-monero-orange"
                                    />
                                    <span className="font-mono text-[11px] dark:text-white">
                                        {w.label || 'Wallet ' + w.id}
                                        <span className="text-gray-500"> ({w.address.slice(0, 10)}…{w.address.slice(-6)})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </>
                )}
            </SurfaceCard>

            {/* NOSTR */}
            <SurfaceCard
                icon={<Zap size={14} />}
                title="Nostr (NIP-05)"
                active={status.nostr.active}
                verifyState={verify.nostr}
                onVerify={() => verifyOne('nostr')}
                handle={oaHandle}
                onCopy={() => copyText(oaHandle)}
            >
                <label className="font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                    Your Nostr pubkey
                </label>
                <input
                    type="text"
                    value={nostrInput}
                    onChange={e => setNostrInput(e.target.value)}
                    placeholder="npub1… or 64 hex chars"
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[11px] dark:text-white"
                    autoComplete="off"
                />
                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Damus, Amethyst, Snort, Iris will verify <span className="font-bold">{oaHandle}</span> against this key.
                </p>
            </SurfaceCard>

            {/* MASTODON */}
            <SurfaceCard
                icon={<AtSign size={14} />}
                title="Mastodon (WebFinger alias)"
                active={status.mastodon.active}
                verifyState={verify.mastodon}
                onVerify={() => verifyOne('mastodon')}
                handle={'@' + oaHandle}
                onCopy={() => copyText('@' + oaHandle)}
            >
                <label className="font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                    Your real Mastodon / Pleroma handle
                </label>
                <input
                    type="text"
                    value={mastodonInput}
                    onChange={e => setMastodonInput(e.target.value)}
                    placeholder="name@instance.tld"
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-[11px] dark:text-white"
                    autoComplete="off"
                />
                <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Searching <span className="font-bold">@{oaHandle}</span> in any Mastodon instance will redirect to your real account.
                </p>
            </SurfaceCard>

            {/* PGP — read-only summary, link to the section that edits it */}
            <SurfaceCard
                icon={<Lock size={14} />}
                title="PGP public key"
                active={status.pgp.active}
                handle={profileSubdomain + '/pgp'}
            >
                <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                    {status.pgp.active
                        ? 'A public key is published. Encrypted contact-form messages and PGP-encrypted email notifications are enabled.'
                        : 'No PGP key yet. Add one in the “Sovereign PGP Identity” block above to enable encrypted notifications and PGP login.'}
                </p>
            </SurfaceCard>

            {(nostrInput !== (status.nostr.pubkey || '') || mastodonInput !== (status.mastodon.external_handle || '')) && (
                <button
                    onClick={saveNostrMastodon}
                    disabled={saving}
                    className="font-mono text-xs font-black uppercase px-4 py-2 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save Nostr + Mastodon
                </button>
            )}
        </div>
    );
};

// One status card per federated surface. Common chrome: status badge,
// handle to copy, Verify button (when applicable), and a slot for the
// per-surface config form.
interface SurfaceCardProps {
    icon: React.ReactNode;
    title: string;
    active: boolean;
    verifyState?: VerifyState;
    onVerify?: () => void;
    handle: string;
    onCopy?: () => void;
    children: React.ReactNode;
}

const SurfaceCard: React.FC<SurfaceCardProps> = ({ icon, title, active, verifyState, onVerify, handle, onCopy, children }) => {
    const verifyLabel = verifyState === 'loading'
        ? 'CHECKING'
        : verifyState === 'ok'
            ? 'PASS'
            : verifyState === 'fail'
                ? 'FAIL'
                : 'VERIFY LIVE';
    const verifyClass = verifyState === 'loading'
        ? 'text-gray-400'
        : verifyState === 'ok'
            ? 'text-green-600 dark:text-green-400 border-green-500'
            : verifyState === 'fail'
                ? 'text-red-600 dark:text-red-400 border-red-500'
                : 'text-gray-700 dark:text-gray-300 border-black dark:border-white hover:border-monero-orange hover:text-monero-orange';
    return (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-3">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 border ${active ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/15' : 'border-gray-300 dark:border-zinc-700 text-gray-400'}`}>
                        {icon}
                    </div>
                    <div>
                        <p className="font-mono text-[11px] font-black uppercase dark:text-white">{title}</p>
                        <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                            {active ? <span className="text-green-600 dark:text-green-400">● ACTIVE</span> : <span className="text-gray-400">○ INACTIVE</span>}
                            <span className="ml-2 truncate">{handle}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {onCopy && (
                        <button
                            onClick={onCopy}
                            className="p-1.5 border border-black dark:border-white text-gray-700 dark:text-gray-300 hover:bg-monero-orange hover:text-white hover:border-monero-orange transition-colors"
                            title="Copy handle"
                        >
                            <Copy size={11} />
                        </button>
                    )}
                    {onVerify && (
                        <button
                            onClick={onVerify}
                            className={`font-mono text-[9px] font-black uppercase tracking-widest px-2 py-1.5 border ${verifyClass} transition-colors flex items-center gap-1`}
                        >
                            {verifyState === 'loading' ? <Loader2 size={10} className="animate-spin" /> : verifyState === 'ok' ? <ShieldCheck size={10} /> : verifyState === 'fail' ? <AlertTriangle size={10} /> : <ExternalLink size={10} />}
                            {verifyLabel}
                        </button>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};
