import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let globalToastFn: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

/** Call from anywhere — no hook needed */
export const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    globalToastFn?.(message, type, duration);
};

const ICONS: Record<ToastType, React.FC<{ size?: number; className?: string }>> = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
};

const STYLES: Record<ToastType, string> = {
    success: 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    error: 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    info: 'border-monero-orange bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextIdRef = useRef(0);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = ++nextIdRef.current;
        setToasts(prev => [...prev, { id, message, type, duration }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    useEffect(() => {
        globalToastFn = addToast;
        return () => { globalToastFn = null; };
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-sm">
                {toasts.map(t => {
                    const Icon = ICONS[t.type];
                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto border-2 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] font-mono text-xs font-bold flex items-center gap-2 animate-slide-in ${STYLES[t.type]}`}
                        >
                            <Icon size={14} className="shrink-0" />
                            <span>{t.message}</span>
                            <button
                                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                                aria-label="Dismiss"
                                className="ml-auto opacity-50 hover:opacity-100 shrink-0 p-1"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
