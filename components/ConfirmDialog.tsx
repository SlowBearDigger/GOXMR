import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

// styled replacement for window.confirm.
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onCancel,
    onConfirm,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    {destructive && <AlertTriangle className="text-red-600 shrink-0" size={24} />}
                    <p className="font-mono text-sm font-bold dark:text-white whitespace-pre-wrap">{message}</p>
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="font-mono text-xs font-bold uppercase px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-black dark:hover:border-white transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`font-mono text-xs font-black uppercase px-4 py-2 border-2 transition-colors ${
                            destructive
                                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                                : 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white hover:bg-monero-orange hover:text-white'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
