import React, { useState, useRef } from 'react';
import { Shield, Lock, HardDrive, Download, Upload, Cpu, Activity, Check, AlertTriangle, Globe, Loader2, Usb, Fingerprint } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import type { Link, Wallet } from '../types.ts';
import { Modal } from './Modal';
interface SettingsProps {
    links: Link[];
    wallets: Wallet[];
    onRestore: (data: { links: Link[], wallets: Wallet[] }) => void;
    username: string;
    hasRecovery?: boolean;
    hasPgp?: boolean;
    pgpKey?: string;
}
export const Settings: React.FC<SettingsProps> = ({ links, wallets, onRestore, username, hasRecovery, hasPgp, pgpKey }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
    const [confirmRecovery, setConfirmRecovery] = useState('');
    const [passwordStatus, setPasswordStatus] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [destructionPass, setDestructionPass] = useState('');
    const [destructionRecovery, setDestructionRecovery] = useState('');
    const [isDestroying, setIsDestroying] = useState(false);
    const [destructionProgress, setDestructionProgress] = useState(0);
    const [showDestructionModal, setShowDestructionModal] = useState(false);
    const [pgpPublicKey, setPgpPublicKey] = useState('');
    const [isUpdatingPgp, setIsUpdatingPgp] = useState(false);
    const [pgpStatus, setPgpStatus] = useState('');
    const [isHardwareConnected, setIsHardwareConnected] = useState(false);
    const [hardwareStatus, setHardwareStatus] = useState('idle');
    const [regType, setRegType] = useState('any');
    const [authenticators, setAuthenticators] = useState([]);
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });
    const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });
    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertConfig({ isOpen: true, title, message, type });
    };
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));
    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm });
    };
    const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    React.useEffect(() => {
        const fetchAuths = async () => {
            try {
                const token = localStorage.getItem('goxmr_token');
                const res = await fetch('/api/me/authenticators', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAuthenticators(data);
                    setIsHardwareConnected(data.length > 0);
                    if (data.length > 0) setHardwareStatus('connected');
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchAuths();
    }, []);

    React.useEffect(() => {
        if (pgpKey) {
            setPgpPublicKey(pgpKey);
        }
    }, [pgpKey]);
    const handleDeleteAuthenticator = async (id) => {
        showConfirm('Revoke Access?', 'Are you sure you want to forget this security key? It will no longer be able to unlock your identity.', async () => {
            try {
                const token = localStorage.getItem('goxmr_token');
                await fetch(`/api/me/authenticators/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setAuthenticators(prev => prev.filter(a => a.id !== id));
                if (authenticators.length <= 1) {
                    setIsHardwareConnected(false);
                    setHardwareStatus('idle');
                }
                closeConfirm();
                showAlert('Revoked', 'Security key successfully removed.', 'success');
            } catch (e) {
                closeConfirm();
                showAlert('Error', 'Failed to delete key: ' + e.message, 'error');
            }
        });
    };
    const handleChangeCredentials = async () => {
        if (!currentPassword) {
            showAlert('Wait', "Current password required to verify identity.", 'error');
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            showAlert('Mismatch', "Primary passwords do not match.", 'error');
            return;
        }
        if (newRecoveryPassword && newRecoveryPassword !== confirmRecovery) {
            showAlert('Mismatch', "Secondary passwords do not match.", 'error');
            return;
        }
        setIsUpdating(true);
        setPasswordStatus('');
        try {
            const token = localStorage.getItem('goxmr_token');
            const res = await fetch('/api/me/security', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword: newPassword || undefined,
                    newRecoveryPassword: newRecoveryPassword || undefined
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');
            setPasswordStatus('success');
            setTimeout(() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setNewRecoveryPassword('');
                setConfirmRecovery('');
                setPasswordStatus('');
            }, 3000);
            showAlert('Success', 'Security protocols updated successfully.', 'success');
        } catch (err) {
            showAlert('Update Failed', err.message, 'error');
            setPasswordStatus('error');
        } finally {
            setIsUpdating(false);
        }
    };
    const handleDestroyAccount = async () => {
        if (!destructionPass || !destructionRecovery) {
            showAlert('Missing Credentials', "Both passwords required for total identity destruction.", 'error');
            return;
        }
        setIsDestroying(true);
        setDestructionProgress(10);
        try {
            const interval = setInterval(() => {
                setDestructionProgress(prev => Math.min(prev + 15, 90));
            }, 600);
            const token = localStorage.getItem('goxmr_token');
            const res = await fetch('/api/me', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    password: destructionPass,
                    recoveryPassword: destructionRecovery
                })
            });
            clearInterval(interval);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Destruction failed');
            setDestructionProgress(100);
            setTimeout(() => {
                showAlert('IDENTITY PURGED', 'Redirecting to void...', 'info');
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = '/';
                }, 2000);
            }, 1000);
        } catch (err) {
            setIsDestroying(false);
            setDestructionProgress(0);
            showAlert('Destruction Failed', err.message, 'error');
        }
    };
    const handleConnectHardware = async () => {
        setHardwareStatus('scanning');
        try {
            const token = localStorage.getItem('goxmr_token');
            const qs = regType !== 'any' ? `? attachment = ${regType}` : '';
            const resp = await fetch(`/api/webauthn/register-options${qs}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to generate registration options');
            if (data.error) throw new Error(data.error);
            const attResp = await startRegistration({ optionsJSON: data.options });
            const verificationResp = await fetch('/api/webauthn/register-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    body: attResp,
                    authenticatorAttachment: regType !== 'any' ? regType : undefined
                })
            });
            const verificationJSON = await verificationResp.json();
            if (verificationJSON.verified) {
                setHardwareStatus('connected');
                setIsHardwareConnected(true);
                const res = await fetch('/api/me/authenticators', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setAuthenticators(await res.json());
                showAlert('Access Granted', 'Hardware Key Registered Successfully!', 'success');
            } else {
                throw new Error(verificationJSON.error || 'Verification failed');
            }
        } catch (err) {
            setHardwareStatus('idle');
            showAlert('Registration Failed', err.message, 'error');
        }
    };
    const handleUpdatePgp = async () => {
        setIsUpdatingPgp(true);
        setPgpStatus('');
        try {
            const token = localStorage.getItem('goxmr_token');
            const res = await fetch('/api/me/pgp', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pgp_public_key: pgpPublicKey || null })
            });
            if (res.ok) {
                setPgpStatus('success');
                showAlert('Success', 'PGP Identity protocol updated.', 'success');
                setTimeout(() => setPgpStatus(''), 3000);
            } else {
                throw new Error('Failed to update PGP key');
            }
        } catch (err) {
            setPgpStatus('error');
            showAlert('Update Failed', err.message, 'error');
        } finally {
            setIsUpdatingPgp(false);
        }
    };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12 transition-colors duration-300">
            { }
            <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        {alertConfig.type === 'error' && <AlertTriangle className="text-red-600 shrink-0" size={24} />}
                        {alertConfig.type === 'success' && <Check className="text-green-600 shrink-0" size={24} />}
                        {alertConfig.type === 'info' && <Shield className="text-blue-600 dark:text-blue-400 shrink-0" size={24} />}
                        <p className="text-sm font-bold dark:text-white">{alertConfig.message}</p>
                    </div>
                    <button onClick={closeAlert} className="w-full bg-black dark:bg-white text-white dark:text-black py-2 px-4 uppercase font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                        Acknowledge
                    </button>
                </div>
            </Modal>
            { }
            <Modal isOpen={confirmConfig.isOpen} onClose={closeConfirm} title={confirmConfig.title}>
                <div className="flex flex-col gap-6">
                    <p className="text-sm font-bold dark:text-white">{confirmConfig.message}</p>
                    <div className="flex gap-4">
                        <button
                            onClick={confirmConfig.onConfirm}
                            className="flex-1 bg-red-600 text-white py-2 px-4 uppercase font-bold hover:bg-red-700 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                        >
                            Confirm
                        </button>
                        <button
                            onClick={closeConfirm}
                            className="flex-1 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white text-black dark:text-white py-2 px-4 uppercase font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
            <div className="lg:col-span-2 flex items-center gap-4 border-b-2 border-black dark:border-zinc-800 pb-4 mb-4">
                <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                    <Shield size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black font-mono uppercase dark:text-white">System Settings</h2>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">Security protocols and identity control.</p>
                </div>
            </div>
            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] p-6">
                <div className="flex items-center justify-between mb-6 border-b-2 border-dashed border-gray-200 dark:border-zinc-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Lock size={20} className="text-monero-orange" />
                        <h3 className="font-mono font-bold uppercase text-lg dark:text-white">Access Protocols</h3>
                    </div>
                    <div className="text-[8px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-800 px-1 border border-gray-100 dark:border-zinc-700">
                        CRYPT_AES_256_SALTED
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Identity Credentials</label>
                            {isUpdating && <Loader2 size={12} className="animate-spin text-monero-orange" />}
                        </div>
                        <input
                            type="password"
                            placeholder="Current Master Password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full border-2 border-black dark:border-white p-2 font-mono text-sm dark:bg-zinc-800 dark:text-white focus:bg-gray-50 dark:focus:bg-zinc-700 outline-none transition-colors"
                        />
                        <div className="border-l-2 border-black dark:border-white pl-4 py-2 space-y-3">
                            {!hasRecovery && (
                                <div className="bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500 p-2 text-[10px] font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2 mb-2 animate-pulse">
                                    <AlertTriangle size={12} /> WARNING: NO RECOVERY PASSWORD SET
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Master Key (Primary)</p>
                                <span className="text-[8px] font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1">ACTIVE_BY_DEFAULT</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="password"
                                    placeholder="New Master"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-zinc-700 p-2 font-mono text-sm dark:bg-zinc-800 dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm New"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-zinc-700 p-2 font-mono text-sm dark:bg-zinc-800 dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sovereign Recovery (Emergency)</p>
                                <span className="text-[8px] font-mono text-monero-orange bg-orange-50 dark:bg-orange-900/30 px-1 border border-monero-orange/30">STRICTLY_OFFLINE</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="password"
                                    placeholder="New Recovery"
                                    value={newRecoveryPassword}
                                    onChange={(e) => setNewRecoveryPassword(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-zinc-700 p-2 font-mono text-sm dark:bg-zinc-800 dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors shadow-inner"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm Recovery"
                                    value={confirmRecovery}
                                    onChange={(e) => setConfirmRecovery(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-zinc-700 p-2 font-mono text-sm dark:bg-zinc-800 dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors shadow-inner"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleChangeCredentials}
                            disabled={isUpdating}
                            className={`w-full py-3 font-mono font-bold text-xs uppercase border-2 border-black dark:border-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-y-[2px] active:shadow-none ${passwordStatus === 'success' ? 'bg-green-500 text-white border-green-700' :
                                passwordStatus === 'error' ? 'bg-red-500 text-white border-red-700' :
                                    'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-100'
                                }`}
                        >
                            {isUpdating ? 'Synchronizing...' :
                                passwordStatus === 'success' ? 'Protocol Updated' :
                                    passwordStatus === 'error' ? 'Verification Failed' : 'Update Security Protocols'}
                        </button>
                    </div>
                    <div className="pt-4 border-t-2 border-dashed border-gray-200 dark:border-zinc-800">
                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Hardware Security</label>
                        <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 overflow-hidden">
                            <div className="p-3 border-b border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Cpu size={24} className={isHardwareConnected ? 'text-green-500' : 'text-gray-400 dark:text-zinc-600'} />
                                    <div>
                                        <div className="text-xs font-bold uppercase dark:text-white">Hardware Security (FIDO2)</div>
                                        <div className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-mono">
                                            {hardwareStatus === 'connected' ? 'Secure Enclave Active' : 'Biometrics or Security Key'}
                                        </div>
                                    </div>
                                </div>
                                {hardwareStatus === 'connected' && <Check size={16} className="text-green-500" />}
                            </div>
                            <div className="p-3 bg-white dark:bg-zinc-900 space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Method Preference</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'any', label: 'Any', desc: 'Hardware or Biometric' },
                                            { id: 'platform', label: 'Biometrics', desc: 'TouchID / FaceID' },
                                            { id: 'cross-platform', label: 'Security Key', desc: 'YubiKey / Ledger' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setRegType(t.id)}
                                                className={`flex-1 py-1 px-2 border-2 text-[9px] font-bold uppercase transition-all ${regType === t.id ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white ring-1 ring-monero-orange' : 'bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 border-gray-100 dark:border-zinc-700'}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleConnectHardware}
                                    disabled={hardwareStatus === 'scanning'}
                                    className={`w-full py-2 font-mono font-bold text-[10px] uppercase border-2 border-black dark:border-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[1px] active:shadow-none ${hardwareStatus === 'scanning' ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400' : 'bg-white dark:bg-zinc-900 dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'}`}
                                >
                                    {hardwareStatus === 'scanning' ? <>Initializing...</> : <>Register Authenticator</>}
                                </button>
                                {authenticators.length > 0 && (
                                    <div className="pt-3 border-t border-gray-100 dark:border-zinc-700 flex flex-col gap-2">
                                        <p className="text-[9px] font-bold uppercase text-gray-400 dark:text-gray-500">Registered Authenticators</p>
                                        {authenticators.map(auth => (
                                            <div key={auth.id} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800 p-2 border border-gray-100 dark:border-zinc-700">
                                                <div className="flex items-center gap-2">
                                                    {auth.attachment === 'platform' ? <Fingerprint size={12} className="text-monero-orange" /> : <Shield size={10} className="text-gray-400 dark:text-zinc-500" />}
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold uppercase dark:text-white">
                                                            {auth.attachment === 'platform' ? 'Biometrics / Passkey' : 'Security Key'}
                                                        </span>
                                                        <span className="text-[8px] font-mono text-gray-400 dark:text-gray-500">{new Date(auth.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteAuthenticator(auth.id)} className="text-[8px] text-red-500 font-bold uppercase hover:underline">
                                                    FORGET
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t-2 border-dashed border-gray-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Sovereign PGP Identity</label>
                            {hasPgp && <span className="text-[8px] font-mono text-monero-orange bg-orange-50 dark:bg-orange-900/30 px-1 border border-monero-orange">PGP_LINKED</span>}
                        </div>
                        <div className="space-y-3">
                            <textarea
                                placeholder="Paste Armor-Encoded PGP Public Key"
                                value={pgpPublicKey}
                                onChange={(e) => setPgpPublicKey(e.target.value)}
                                className="w-full border-2 border-black dark:border-white p-2 font-mono text-[10px] h-24 dark:bg-zinc-800 dark:text-white focus:bg-gray-50 dark:focus:bg-zinc-700 outline-none transition-colors"
                            />
                            <button
                                onClick={handleUpdatePgp}
                                disabled={isUpdatingPgp}
                                className={`w-full py-2 font-mono font-bold text-[10px] uppercase border-2 border-black dark:border-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[1px] active:shadow-none ${pgpStatus === 'success' ? 'bg-green-500 text-white border-green-700' : 'bg-white dark:bg-zinc-900 dark:text-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'}`}
                            >
                                {isUpdatingPgp ? 'Updating Vault...' : pgpStatus === 'success' ? 'PGP Synchronized' : 'Update PGP Identity'}
                            </button>
                            <p className="text-[8px] text-gray-400 dark:text-gray-500 font-mono italic leading-tight">
                                * Linking a PGP key allows you to login by signing a server challenge. Highly recommended for air-gapped security.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-8 mt-8 border-t-4 border-double border-red-200 dark:border-red-900/50">
                <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-600 p-4">
                    <h4 className="font-mono font-black text-red-600 dark:text-red-500 uppercase text-xs mb-4 flex items-center gap-2">
                        <AlertTriangle size={14} className="animate-pulse" /> Critical: Identity Destruction Protocol
                    </h4>
                    {!showDestructionModal ? (
                        <div className="space-y-4">
                            <p className="font-mono text-[9px] text-red-700 dark:text-red-400 leading-tight">
                                This protocol will permanently purge your username and all associated cryptographic signatures from our systems.
                                <strong> This is non-reversible.</strong>
                            </p>
                            <button
                                onClick={() => setShowDestructionModal(true)}
                                className="w-full py-2 bg-red-600 text-white font-mono font-bold text-[10px] uppercase hover:bg-black dark:hover:bg-red-700 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                Initialize Self-Destruct Sequence
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <p className="text-[10px] font-mono text-red-800 dark:text-red-400 leading-tight">
                                Enter BOTH passwords to confirm total wipe of <strong>@{username}</strong>.
                                This action is irreversible. All data on our relay will be purged.
                            </p>
                            <input
                                type="password"
                                placeholder="Verify Master Password"
                                value={destructionPass}
                                onChange={(e) => setDestructionPass(e.target.value)}
                                className="w-full border-2 border-red-600 dark:border-red-800 p-2 font-mono text-[10px] bg-white dark:bg-zinc-900 dark:text-white outline-none"
                            />
                            <input
                                type="password"
                                placeholder="Verify Recovery Password"
                                value={destructionRecovery}
                                onChange={(e) => setDestructionRecovery(e.target.value)}
                                className="w-full border-2 border-red-600 dark:border-red-800 p-2 font-mono text-[10px] bg-white dark:bg-zinc-900 dark:text-white outline-none"
                            />
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-full bg-red-100 dark:bg-red-900/20 mt-2">
                                    <div
                                        className="h-full bg-red-600 transition-all duration-300"
                                        style={{ width: `${destructionProgress}%` }}
                                    ></div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDestroyAccount}
                                        disabled={isDestroying}
                                        className="flex-1 py-2 bg-red-600 text-white font-mono font-bold text-[10px] uppercase hover:bg-red-800 disabled:opacity-50"
                                    >
                                        {isDestroying ? `Purging Data (${destructionProgress}%)` : 'Execute Destruction'}
                                    </button>
                                    {!isDestroying && (
                                        <button
                                            onClick={() => setShowDestructionModal(false)}
                                            className="px-4 py-2 border-2 border-black dark:border-white font-mono font-bold text-[10px] uppercase dark:text-white"
                                        >
                                            Abort
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};