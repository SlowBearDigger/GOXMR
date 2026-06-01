import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';

interface PromptDialogProps {
    isOpen: boolean;
    title: string;
    label?: string;
    placeholder?: string;
    initialValue?: string;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: (value: string) => void;
}

// styled replacement for window.prompt — keeps focus and a11y inside the app
// design system instead of bouncing to the browser's native chrome.
export const PromptDialog: React.FC<PromptDialogProps> = ({
    isOpen,
    title,
    label,
    placeholder,
    initialValue = '',
    confirmLabel = 'Confirm',
    onCancel,
    onConfirm,
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    const handleConfirm = () => {
        onConfirm(value);
    };

    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title}>
            <div className="flex flex-col gap-4">
                {label && (
                    <label className="font-mono text-xs font-bold uppercase tracking-wider dark:text-white">
                        {label}
                    </label>
                )}
                <input
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-2 font-mono text-sm dark:text-white focus-visible:ring-2 focus-visible:ring-monero-orange outline-none"
                    autoFocus
                />
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="font-mono text-xs font-bold uppercase px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="bg-black dark:bg-white text-white dark:text-black font-mono text-xs font-black uppercase px-4 py-2 border-2 border-black dark:border-white hover:bg-monero-orange hover:text-white transition-colors"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
