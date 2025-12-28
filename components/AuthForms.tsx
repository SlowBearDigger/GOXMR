import React, { useState, useEffect } from 'react';
import { Key, Shield, ArrowRight, Usb, Loader2, CheckCircle2, Cpu, Lock, AlertCircle, Check, Fingerprint, AlertTriangle } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import * as openpgp from 'openpgp';
import { Modal } from './Modal';
import { AltchaWidget } from './AltchaWidget';
const InputGroup = ({ label, type = "text", placeholder }) => (
    <div className="flex flex-col gap-1 mb-4">
        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{label}</label>
        <input
            type={type}
            placeholder={placeholder}
            className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
        />
    </div>
);
const StatusScreen = ({ icon, title, subtitle, animate = false }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-300">
        <div className={`mb-4 ${animate ? 'animate-spin-slow' : 'animate-bounce'} dark:text-white`}>
            {icon}
        </div>
        <h3 className="font-mono font-bold text-xl uppercase tracking-widest mb-2 dark:text-white">{title}</h3>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400 typewriter-text">{subtitle}</p>
        {animate && <div className="w-16 h-1 bg-gray-200 dark:bg-zinc-800 mt-6 overflow-hidden"><div className="w-full h-full bg-monero-orange animate-progress-indeterminate"></div></div>}
    </div>
);
interface AuthFormProps {
    onSuccess: (username: string) => void;
    initialUsername?: string;
}
export const RegisterForm = ({ onSuccess, initialUsername = '' }) => {
    const [status, setStatus] = useState('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(initialUsername);
    const [repeatPassword, setRepeatPassword] = useState('');
    const [recoveryPassword, setRecoveryPassword] = useState('');
    const [isAvailable, setIsAvailable] = useState(null);
    const [isChecking, setIsChecking] = useState(false);
    const [usePgp, setUsePgp] = useState(false);
    const [pgpPublicKey, setPgpPublicKey] = useState('');
    const [pgpError, setPgpError] = useState('');
    const [altchaPayload, setAltchaPayload] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'error'
    });
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));
    const showAlert = (title, message, type = 'error') => setAlertConfig({ isOpen: true, title, message, type: type as any });
    useEffect(() => {
        if (!username || username.length < 3) {
            setIsAvailable(null);
            return;
        }
        let intervalId: NodeJS.Timeout;
        const checkAvailability = async () => {
            setIsChecking(true);
            try {
                const res = await fetch(`/api/check-username/${encodeURIComponent(username)}`);
                if (!res.ok) {
                    setIsAvailable(false);
                    return;
                }
                const data = await res.json();
                setIsAvailable(data.available);
            } catch (err) {
                console.error("Availability check failed", err);
                setIsAvailable(false);
            } finally {
                setIsChecking(false);
            }
        };
        const timeoutId = setTimeout(() => {
            checkAvailability();
            intervalId = setInterval(checkAvailability, 5000);
        }, 500);
        return () => {
            clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [username]);

    const validatePgpKey = async (key: string) => {
        if (!key) return;
        try {
            await openpgp.readKey({ armoredKey: key });
            setPgpError('');
        } catch (err) {
            setPgpError('Invalid PGP Public Key format (Armored required)');
        }
    };
    const handleRegister = async () => {
        if (isAvailable !== true || isChecking) return;
        if (password !== repeatPassword) {
            showAlert("Start Error", "Passwords do not match");
            return;
        }
        setStatus('registering');
        setErrorMsg('');
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password: usePgp ? null : password,
                    recovery_password: recoveryPassword,
                    pgp_public_key: usePgp ? pgpPublicKey : null,
                    altcha: altchaPayload
                })
            });
            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error("Non-JSON response:", text);
                throw new Error("Server communication error. Please try again.");
            }
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            localStorage.setItem('goxmr_token', data.token);
            localStorage.setItem('goxmr_user', data.username);
            setStatus('redirecting');
            setTimeout(() => onSuccess(data.username), 1500);
        } catch (err) {
            setStatus('idle');
            showAlert("Registration Failed", err.message || "Failed to connect to identity server");
        }
    };
    if (status === 'registering') {
        return <StatusScreen icon={<Loader2 size={48} />} title="Encrypted Handshake" subtitle="Generating Cryptographic Keys..." animate={true} />;
    }
    if (status === 'redirecting') {
        return <StatusScreen icon={<CheckCircle2 size={48} className="text-green-600" />} title="Identity Established" subtitle="Redirecting to Dashboard..." />;
    }
    const strength = Math.min(
        (password.length > 6 ? 1 : 0) +
        (password.length > 10 ? 1 : 0) +
        (/[A-Z]/.test(password) ? 1 : 0) +
        (/[0-9]/.test(password) ? 1 : 0),
        4);
    const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500'];
    const strengthLabels = ['WEAK', 'FAIR', 'GOOD', 'STRONG'];
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
            <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-600 shrink-0" size={24} />
                        <p className="text-sm font-bold dark:text-white">{alertConfig.message}</p>
                    </div>
                    <button onClick={closeAlert} className="w-full bg-black dark:bg-white text-white dark:text-black py-2 px-4 uppercase font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                        Close
                    </button>
                </div>
            </Modal>
            { }
            <div style={{ display: 'none' }} aria-hidden="true">
                <input type="text" name="website_id_verify" tabIndex={-1} autoComplete="off" />
                <input type="checkbox" name="_bot_check" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-2 text-xs mb-4 dark:text-blue-300">
                <span className="font-bold">NOTE:</span> Your username is your handle (goxmr.click/user).
            </div>

            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setUsePgp(false)}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all border-b-2 ${!usePgp ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 dark:text-zinc-600'}`}
                >
                    Standard Access
                </button>
                <button
                    onClick={() => setUsePgp(true)}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all border-b-2 ${usePgp ? 'border-monero-orange text-monero-orange' : 'border-transparent text-gray-400 dark:text-zinc-600'}`}
                >
                    Sovereign PGP
                </button>
            </div>
            <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Desired Username</label>
                <div className="relative">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="satoshi_v2"
                        className={`border-2 p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full transition-colors bg-white dark:bg-zinc-900 dark:text-white ${isAvailable === true ? 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-900/10' :
                            isAvailable === false ? 'border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-900/10' : 'border-black dark:border-white'
                            }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isChecking ? (
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : isAvailable === true ? (
                            <Check size={16} className="text-green-600" />
                        ) : isAvailable === false ? (
                            <AlertCircle size={16} className="text-red-600" />
                        ) : null}
                    </div>
                </div>
                {isAvailable === false && <p className="text-[10px] text-red-600 font-bold uppercase mt-1">Username already taken or invalid</p>}
                {isAvailable === true && <p className="text-[10px] text-green-600 font-bold uppercase mt-1">Identity Available</p>}
            </div>

            {usePgp ? (
                <div className="animate-in fade-in duration-300">
                    <div className="flex flex-col gap-1 mb-4">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">PGP Public Key (Armored)</label>
                        <textarea
                            value={pgpPublicKey}
                            onChange={(e) => {
                                setPgpPublicKey(e.target.value);
                                validatePgpKey(e.target.value);
                            }}
                            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK----- ..."
                            className={`border-2 p-2 font-mono text-[10px] outline-none h-32 focus:bg-gray-50 dark:focus:bg-zinc-800 w-full transition-colors bg-white dark:bg-zinc-900 dark:text-white ${pgpError ? 'border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-900/10' : pgpPublicKey ? 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-900/10' : 'border-black dark:border-white'}`}
                        />
                        {pgpError && <p className="text-[10px] text-red-600 font-bold uppercase mt-1">{pgpError}</p>}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-1 mb-4">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Master Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 w-full bg-white dark:bg-zinc-900 dark:text-white"
                        />
                        <div className="flex mt-1 h-1 gap-1">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`flex-1 transition-colors ${i < strength ? strengthColors[strength - 1] : 'bg-gray-200 dark:bg-zinc-800'}`}></div>
                            ))}
                        </div>
                        <div className="text-[10px] text-right text-gray-400 dark:text-zinc-500">{strengthLabels[Math.max(0, strength - 1)]}</div>
                    </div>
                    <div className="flex flex-col gap-1 mb-4">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Repeat Master Password</label>
                        <input
                            type="password"
                            value={repeatPassword}
                            onChange={(e) => setRepeatPassword(e.target.value)}
                            className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                        />
                    </div>
                </>
            )
            }
            <div className="border-t-2 border-dashed border-gray-300 dark:border-zinc-700 my-4 pt-4">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-monero-orange" />
                    <span className="font-bold text-xs uppercase dark:text-white">Sovereign Recovery</span>
                </div>
                <div className="flex flex-col gap-1 mb-4">
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Secondary Password (Backup)</label>
                    <input
                        type="password"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        placeholder="Used if you forget Master"
                        className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                    />
                </div>
            </div>

            <AltchaWidget onVerify={setAltchaPayload} />

            <button
                onClick={handleRegister}
                disabled={isAvailable !== true || isChecking || !username || (usePgp ? (!pgpPublicKey || !!pgpError) : !password) || status === 'registering' || !altchaPayload}
                className={`w-full font-bold py-3 uppercase transition-colors flex justify-center items-center gap-2 ${isAvailable !== true || isChecking || !username || (usePgp ? (!pgpPublicKey || !!pgpError) : !password) || status === 'registering' ? 'bg-gray-300 dark:bg-zinc-800 cursor-not-allowed text-gray-500 dark:text-zinc-600' : 'bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white'
                    }`}
            >
                {status === 'registering' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                ) : isChecking ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                ) : isAvailable === false ? (
                    "Username Taken"
                ) : (
                    <>Create Account <ArrowRight size={16} /></>
                )}
            </button>
        </div >
    );
};
export const LoginForm = ({ onSuccess }) => {
    const [mode, setMode] = useState('default');
    const [status, setStatus] = useState('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [recoveryPassword, setRecoveryPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [pgpChallenge, setPgpChallenge] = useState('');
    const [pgpSignature, setPgpSignature] = useState('');
    const [altchaPayload, setAltchaPayload] = useState<string | null>(null);
    const [recoveryStatus, setRecoveryStatus] = useState('idle');
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'error'
    });
    const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));
    const showAlert = (title, message, type = 'error') => setAlertConfig({ isOpen: true, title, message, type: type as any });
    const handleLogin = async (type, attachmentType = undefined) => {
        if (type === 'standard') {
            setStatus('authenticating');
            setErrorMsg('');
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, altcha: altchaPayload })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Login failed');
                localStorage.setItem('goxmr_token', data.token);
                localStorage.setItem('goxmr_user', data.username);
                setStatus('redirecting');
                setTimeout(() => onSuccess(data.username), 1500);
            } catch (err) {
                setStatus('idle');
                showAlert('Login Failed', err.message);
            }
        } else if (type === 'hardware') {
            setStatus('verifying_hardware');
            setErrorMsg('');
            try {
                const qs = new URLSearchParams();
                if (username) qs.append('username', username);
                if (attachmentType) qs.append('type', attachmentType);
                const resp = await fetch(`/api/webauthn/auth-options?${qs.toString()}`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to generate authentication options');
                if (data.error) throw new Error(data.error);
                const { options, challengeKey } = data;
                const authResp = await startAuthentication({ optionsJSON: options });
                const verificationResp = await fetch('/api/webauthn/auth-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        body: authResp,
                        username,
                        challengeKey: challengeKey
                    })
                });
                const verificationJSON = await verificationResp.json();
                if (verificationJSON.verified) {
                    localStorage.setItem('goxmr_token', verificationJSON.token);
                    localStorage.setItem('goxmr_user', verificationJSON.username);
                    setStatus('redirecting');
                    setTimeout(() => onSuccess(verificationJSON.username), 1500);
                } else {
                    throw new Error(verificationJSON.error || 'Verification failed');
                }
            } catch (err) {
                setStatus('idle');
                setMode('default');
                showAlert('Hardware Auth Failed', err.message);
            }
        } else if (type === 'pgp_challenge') {
            if (!username) {
                showAlert('Identity Required', 'Please enter your username to request a challenge.');
                return;
            }
            setStatus('requesting_challenge');
            try {
                const resp = await fetch('/api/pgp/challenge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Identity not configured for PGP');
                setPgpChallenge(data.challenge);
                setMode('pgp_sign');
                setStatus('idle');
            } catch (err) {
                setStatus('idle');
                showAlert('PGP Challenge Error', err.message);
            }
        } else if (type === 'pgp_verify') {
            if (!pgpSignature) {
                showAlert('Signature Missing', 'Please paste your PGP Clearsigned signature.');
                return;
            }
            setStatus('verifying_pgp');
            try {
                const resp = await fetch('/api/pgp/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, signature: pgpSignature })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Verification failed');
                localStorage.setItem('goxmr_token', data.token);
                localStorage.setItem('goxmr_user', data.username);
                setStatus('redirecting');
                setTimeout(() => onSuccess(data.username), 1500);
            } catch (err) {
                setStatus('idle');
                showAlert('PGP Verification Failed', err.message);
            }
        }
    };
    const handleRecovery = async () => {
        if (!username || !recoveryPassword || !newPassword) {
            showAlert('Form Error', "All fields are required for recovery.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showAlert('Form Error', "Passwords do not match.");
            return;
        }
        setRecoveryStatus('recovering');
        setErrorMsg('');
        try {
            const res = await fetch('/api/recover-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    recoveryPassword,
                    newPassword
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Recovery failed');
            setRecoveryStatus('success');
            setTimeout(() => {
                setMode('default');
                setRecoveryStatus('idle');
                setPassword('');
                showAlert('Recovery Success', 'Access restored. Please log in with your new password.', 'success');
            }, 3000);
        } catch (err) {
            setRecoveryStatus('idle');
            showAlert('Recovery Failed', err.message);
        }
    };
    if (status === 'authenticating') {
        return <StatusScreen icon={<Lock size={48} />} title="Verifying Credentials" subtitle="Hashing Password..." animate={true} />;
    }
    if (status === 'verifying_hardware') {
        return <StatusScreen icon={<Cpu size={48} />} title="Hardware Handshake" subtitle="Verifying FIDO2 Signature..." animate={true} />;
    }
    if (status === 'redirecting') {
        return <StatusScreen icon={<CheckCircle2 size={48} className="text-green-600" />} title="Access Granted" subtitle="Decryption Successful. Redirecting..." />;
    }
    if (status === 'requesting_challenge') {
        return <StatusScreen icon={<Shield size={48} />} title="Sovereign Handshake" subtitle="Requesting Encrypted Challenge..." animate={true} />;
    }
    if (status === 'verifying_pgp') {
        return <StatusScreen icon={<Cpu size={48} />} title="Verifying Signature" subtitle="Checking RSA/ECC Proof..." animate={true} />;
    }
    if (mode === 'hardware') {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in">
                <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-600 shrink-0" size={24} />
                            <p className="text-sm font-bold">{alertConfig.message}</p>
                        </div>
                        <button onClick={closeAlert} className="w-full bg-black text-white py-2 px-4 uppercase font-bold hover:bg-gray-800 transition-colors">
                            Close
                        </button>
                    </div>
                </Modal>
                <h3 className="font-bold text-lg mb-6 uppercase tracking-tight dark:text-white">Security Access</h3>
                <div className="flex flex-col gap-2 mb-4 w-full max-w-xs">
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Username (Optional)</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter if known"
                        className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-8 mb-8">
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className="w-20 h-20 border-2 border-black dark:border-white rounded-2xl flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-all hover:scale-105 active:scale-95 group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                            onClick={() => handleLogin('hardware', 'platform')}
                        >
                            <Fingerprint size={40} className="group-hover:text-monero-orange transition-colors dark:text-white" />
                        </div>
                        <span className="text-[10px] font-bold uppercase dark:text-white">Biometrics</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className="w-20 h-20 border-2 border-black dark:border-white rounded-2xl flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-all hover:scale-105 active:scale-95 group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                            onClick={() => handleLogin('hardware', 'cross-platform')}
                        >
                            <Usb size={40} className="group-hover:text-monero-orange transition-colors dark:text-white" />
                        </div>
                        <span className="text-[10px] font-bold uppercase dark:text-white">Security Key</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-6 max-w-[220px] font-medium leading-tight">
                    Select your preferred secure authentication method to verify your identity.
                </p>
                <button
                    onClick={() => setMode('default')}
                    className="text-[10px] font-bold border-b border-black dark:border-white hover:text-monero-orange hover:border-monero-orange transition-colors uppercase dark:text-white"
                >
                    Cancel Protocol
                </button>
            </div>
        );
    }
    if (mode === 'pgp_sign') {
        return (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
                <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-600 shrink-0" size={24} />
                            <p className="text-sm font-bold">{alertConfig.message}</p>
                        </div>
                        <button onClick={closeAlert} className="w-full bg-black text-white py-2 px-4 uppercase font-bold hover:bg-gray-800 transition-colors">
                            Close
                        </button>
                    </div>
                </Modal>
                <div className="bg-black dark:bg-zinc-950 text-green-500 p-3 font-mono text-[10px] mb-4 border-2 border-black dark:border-white overflow-hidden relative">
                    <div className="absolute top-1 right-2 animate-pulse text-[8px]">COMMAND_ACTIVE</div>
                    <div className="mb-2 uppercase text-gray-500 dark:text-zinc-600 text-[8px]">Challenge String / Sign with Private Key:</div>
                    <div className="break-all select-all cursor-copy hover:border-green-500 transition-colors border border-transparent p-1">{pgpChallenge}</div>
                </div>

                <div className="flex flex-col gap-1 mb-6">
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">PGP Signed Message (Cleartext)</label>
                    <textarea
                        value={pgpSignature}
                        onChange={(e) => setPgpSignature(e.target.value)}
                        placeholder="-----BEGIN PGP SIGNED MESSAGE----- ..."
                        className="border-2 border-black dark:border-white p-2 font-mono text-[10px] outline-none h-32 focus:bg-gray-50 dark:focus:bg-zinc-800 w-full bg-white dark:bg-zinc-900 dark:text-white"
                    />
                </div>

                <button onClick={() => handleLogin('pgp_verify')} className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors flex justify-center items-center gap-2 mb-3">
                    Verify Proof <ArrowRight size={16} />
                </button>
                <button onClick={() => { setMode('default'); setPgpChallenge(''); }} className="w-full py-2 text-xs font-bold uppercase text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white">
                    Back to Terminal
                </button>
            </div>
        );
    }
    if (mode === 'recovery') {
        return (
            <div className="animate-in slide-in-from-right duration-200">
                <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            {alertConfig.type === 'success' && <Check className="text-green-600 shrink-0" size={24} />}
                            {alertConfig.type === 'error' && <AlertTriangle className="text-red-600 shrink-0" size={24} />}
                            <p className="text-sm font-bold dark:text-white">{alertConfig.message}</p>
                        </div>
                        <button onClick={closeAlert} className="w-full bg-black dark:bg-white text-white dark:text-black py-2 px-4 uppercase font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                            Close
                        </button>
                    </div>
                </Modal>
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-2 text-xs mb-4 dark:text-red-300">
                    <span className="font-bold uppercase tracking-tighter">RECOVERY PROTOCOL:</span> Reset Master access.
                </div>
                {recoveryStatus === 'success' && (
                    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 mb-4 text-[10px] font-bold">
                        ACCESS RESTORED. Returning to login...
                    </div>
                )}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Secondary Password</label>
                        <input
                            type="password"
                            value={recoveryPassword}
                            onChange={(e) => setRecoveryPassword(e.target.value)}
                            placeholder="Your recovery phrase"
                            className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">New Master</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 w-full bg-white dark:bg-zinc-900 dark:text-white"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Confirm New</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 w-full bg-white dark:bg-zinc-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleRecovery}
                        disabled={recoveryStatus === 'recovering' || recoveryStatus === 'success'}
                        className="w-full bg-red-600 text-white font-bold py-3 uppercase hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                        {recoveryStatus === 'recovering' ? <><Loader2 className="animate-spin" size={16} /> Verifying...</> : 'Restore Access'}
                    </button>
                    <button onClick={() => setMode('default')} className="w-full py-2 text-xs font-bold uppercase text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white">
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="animate-in slide-in-from-left duration-200">
            <Modal isOpen={alertConfig.isOpen} onClose={closeAlert} title={alertConfig.title}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-600 shrink-0" size={24} />
                        <p className="text-sm font-bold dark:text-white">{alertConfig.message}</p>
                    </div>
                    <button onClick={closeAlert} className="w-full bg-black dark:bg-white text-white dark:text-black py-2 px-4 uppercase font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                        Close
                    </button>
                </div>
            </Modal>
            { }
            <div style={{ display: 'none' }} aria-hidden="true">
                <input type="text" name="website_id_verify" tabIndex={-1} autoComplete="off" />
                <input type="checkbox" name="_bot_check" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 placeholder:text-gray-300 dark:placeholder:text-zinc-600 w-full bg-white dark:bg-zinc-900 dark:text-white"
                />
            </div>
            <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-2 border-black dark:border-white p-2 font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 w-full bg-white dark:bg-zinc-900 dark:text-white"
                />
            </div>
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setMode('recovery')} className="text-xs text-monero-orange font-bold hover:underline">
                    Forgot Password?
                </button>
            </div>

            <AltchaWidget onVerify={setAltchaPayload} />

            <button onClick={() => handleLogin('standard')} disabled={!altchaPayload || status === 'authenticating'} className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 uppercase hover:bg-monero-orange dark:hover:bg-monero-orange dark:hover:text-white transition-colors flex justify-center items-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed">
                Login <ArrowRight size={16} />
            </button>
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-zinc-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-zinc-600 text-xs">OR</span>
                <div className="flex-grow border-t border-gray-300 dark:border-zinc-700"></div>
            </div>
            <button onClick={() => setMode('hardware')} className="w-full border-2 border-black dark:border-white dark:text-white font-bold py-2 uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex justify-center items-center gap-2 text-xs mb-2">
                <Key size={14} /> Use Hardware Key
            </button>
            <button onClick={() => handleLogin('pgp_challenge')} className="w-full border-2 border-monero-orange font-bold py-2 uppercase hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors flex justify-center items-center gap-2 text-xs text-monero-orange">
                <Shield size={14} /> PGP Identity
            </button>
        </div >
    );
};