import React, { useEffect } from 'react';
import { X } from 'lucide-react';
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {}
            <div
                className="absolute inset-0 bg-white/80 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            {}
            <div className="relative w-full max-w-md bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col animate-in fade-in zoom-in duration-200">
                {}
                <div className="flex items-center justify-between border-b-2 border-black p-4 bg-gray-50">
                    <h2 className="font-mono font-bold uppercase text-lg tracking-wider">{title}</h2>
                    <button onClick={onClose} className="hover:bg-red-500 hover:text-white border border-transparent hover:border-black p-1 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                {}
                <div className="p-6 font-mono">
                    {children}
                </div>
            </div>
        </div>
    );
};
