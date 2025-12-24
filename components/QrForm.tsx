import React, { useState } from 'react';
import type { ShapeType, CornerType, GradientType, Preset, CryptoType, CustomField } from '../types.ts';
import { Upload, ChevronDown, Check } from 'lucide-react';
interface QrFormProps {
    content: string; onContentChange: (v: string) => void;
    label: string; onLabelChange: (v: string) => void;
    message: string; onMessageChange: (v: string) => void;
    amount: string; onAmountChange: (v: string) => void;
    wallets: { id: number; currency: string; label: string; address: string }[];
    selectedWalletId: number | null;
    onWalletChange: (id: number) => void;
    logoUrl: string | null;
    onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    color: string; onColorChange: (v: string) => void;
    shape: ShapeType; onShapeChange: (v: ShapeType) => void;
    cornerType: CornerType; onCornerChange: (v: CornerType) => void;
    backgroundColor: string; onBackgroundColorChange: (v: string) => void;
    useGradient: boolean; onUseGradientChange: (v: boolean) => void;
    gradientColor: string; onGradientColorChange: (v: string) => void;
    gradientType: GradientType; onGradientTypeChange: (v: GradientType) => void;
    isLoading: boolean;
    isGenerated: boolean;
    onVerifyClick: () => void;
    presets: Preset[];
    onApplyPreset: (preset: Preset) => void;
    activePreset: string | null;
    cryptoOptions: { id: CryptoType; label: string; placeholder: string; supportsMessage: boolean; labelParam?: string }[];
    selectedCrypto: CryptoType;
    onCryptoChange: (crypto: CryptoType) => void;
    codeSnippet: string;
    qrSize: number; onQrSizeChange: (v: number) => void;
    onDetectAndSetCrypto: (text: string) => string | null;
    isDisposable: boolean; onIsDisposableChange: (v: boolean) => void;
    disposableTimeout: number; onDisposableTimeoutChange: (v: number) => void;
}
const AccordionSection: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => (
    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all mb-4">
        <button onClick={onToggle} className="w-full flex justify-between items-center p-3 text-left bg-black hover:bg-gray-900 text-white transition-colors">
            <span className="font-mono font-bold uppercase text-sm">{title}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>
        {isOpen && <div className="p-4 border-t-2 border-black font-mono">{children}</div>}
    </div>
);
export const QrForm: React.FC<QrFormProps> = (props) => {
    const [openSection, setOpenSection] = useState<number>(0);
    const [detectedCrypto, setDetectedCrypto] = useState<string | null>(null);
    const handleToggle = (index: number) => setOpenSection(openSection === index ? -1 : index);
    const {
        content, onContentChange, label, onLabelChange, message, onMessageChange, amount, onAmountChange,
        wallets, selectedWalletId, onWalletChange,
        onLogoChange, color, onColorChange, shape, onShapeChange, cornerType, onCornerChange,
        backgroundColor, onBackgroundColorChange, useGradient, onUseGradientChange, gradientColor, onGradientColorChange, gradientType, onGradientTypeChange,
        presets, onApplyPreset, activePreset, cryptoOptions, selectedCrypto, onCryptoChange,
        codeSnippet, qrSize, onQrSizeChange, onDetectAndSetCrypto, onVerifyClick,
        isDisposable, onIsDisposableChange, disposableTimeout, onDisposableTimeoutChange
    } = props;
    const currentCrypto = cryptoOptions.find(c => c.id === selectedCrypto);
    const isCustom = selectedCrypto === 'custom';
    const handleAutodetectChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const detected = onDetectAndSetCrypto(text);
        setDetectedCrypto(detected);
        onContentChange(text);
    };
    const shapeOptions: { id: ShapeType; label: string }[] = [
        { id: 'square', label: 'Squares' }, { id: 'dots', label: 'Dots' }, { id: 'rounded', label: 'Rounded' },
        { id: 'extra-rounded', label: 'Extra' }, { id: 'classy', label: 'Classy' }, { id: 'classy-rounded', label: 'Classy R.' }
    ];
    const cornerOptions: { id: CornerType; label: string }[] = [
        { id: 'square', label: 'Square' }, { id: 'dot', label: 'Dot' }, { id: 'extra-rounded', label: 'Rounded' }
    ];
    const gradOptions: { id: GradientType; label: string }[] = [
        { id: 'linear', label: 'Linear' }, { id: 'radial', label: 'Radial' }
    ];
    return (
        <div className="w-full space-y-4">
            { }
            <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 font-mono">
                <h2 className="font-bold text-lg border-b-2 border-black pb-2 mb-4 uppercase flex items-center gap-2">
                    <div className="w-3 h-3 bg-monero-orange"></div> 1. Source & Content
                </h2>
                <div className="flex flex-col gap-4">
                    { }
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Wallet</label>
                        <div className="grid grid-cols-1 gap-2">
                            {wallets.map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => onWalletChange(w.id)}
                                    className={`text-left p-3 border-2 transition-all flex items-center gap-3 ${selectedWalletId === w.id
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white text-black border-gray-200 hover:border-black'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px] font-bold ${w.currency === 'XMR' ? 'text-monero-orange' : 'text-yellow-500'}`}>
                                        {w.currency[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold uppercase">{w.label}</div>
                                        <div className="text-[10px] opacity-60 truncate">{w.address}</div>
                                    </div>
                                    {selectedWalletId === w.id && <Check size={16} className="text-monero-orange" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Manual Override / Content</label>
                        <textarea
                            value={content}
                            onChange={handleAutodetectChange}
                            className="w-full border-2 border-black p-3 text-sm h-16 font-mono outline-none focus:bg-gray-50 bg-gray-100"
                            placeholder={currentCrypto?.placeholder}
                        />
                        {detectedCrypto && (
                            <div className="mt-1 text-xs font-bold text-green-700">
                                DETECTED: {detectedCrypto.toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            { }
            <AccordionSection title="2. Design & Branding" isOpen={openSection === 0} onToggle={() => handleToggle(0)}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Quick Presets</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {presets.map(p => (
                                <button key={p.name} onClick={() => onApplyPreset(p)} className={`p-2 text-xs border-2 font-bold transition-all ${activePreset === p.name ? 'bg-monero-orange text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-gray-100 text-gray-500 border-transparent hover:border-gray-300'}`}>
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="border border-gray-200 p-4 space-y-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-gray-800">Dot Colors</label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <span className="text-xs text-gray-500">Use Gradient</span>
                                <input type="checkbox" checked={useGradient} onChange={(e) => onUseGradientChange(e.target.checked)} className="accent-monero-orange" />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase text-gray-400 mb-1">Primary Color</label>
                                <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="h-8 w-full cursor-pointer border-2 border-black p-0.5 bg-white" />
                            </div>
                            <div className={`transition-opacity duration-300 ${useGradient ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                <label className="block text-[10px] uppercase text-gray-400 mb-1">Gradient End</label>
                                <input type="color" value={gradientColor} onChange={(e) => onGradientColorChange(e.target.value)} className="h-8 w-full cursor-pointer border-2 border-black p-0.5 bg-white" disabled={!useGradient} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Background</label>
                        <div className="flex items-center space-x-3 p-2 border-2 border-black bg-white">
                            <input type="color" value={backgroundColor} onChange={(e) => onBackgroundColorChange(e.target.value)} className="h-8 w-12 cursor-pointer border border-black bg-white p-0.5" />
                            <span className="text-xs font-mono font-bold uppercase">{backgroundColor}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Pattern Style</label>
                        <div className="grid grid-cols-3 gap-2">
                            {shapeOptions.map(s => (
                                <button key={s.id} onClick={() => onShapeChange(s.id)} className={`py-2 px-1 text-[10px] font-bold border-2 uppercase transition-all ${shape === s.id ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-200'}`}>{s.label}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Center Logo</label>
                        <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 hover:border-monero-orange hover:bg-orange-50 transition-colors cursor-pointer group relative overflow-hidden">
                            {props.logoUrl && (
                                <img src={props.logoUrl} className="absolute inset-0 w-full h-full object-contain opacity-30 group-hover:opacity-10" />
                            )}
                            <div className="z-10 flex items-center">
                                <Upload className="text-gray-400 group-hover:text-monero-orange" size={20} />
                                <span className="ml-2 text-xs font-bold text-gray-400 group-hover:text-monero-orange uppercase">
                                    {props.logoUrl ? 'Change Logo' : 'Upload Image'}
                                </span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={onLogoChange} />
                        </label>
                    </div>
                </div>
            </AccordionSection>
            <AccordionSection title="3. Developer Code" isOpen={openSection === 1} onToggle={() => handleToggle(1)}>
                <div className="bg-gray-100 p-4 border border-gray-300 text-xs font-mono overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{codeSnippet}</pre>
                </div>
            </AccordionSection>
        </div>
    );
};