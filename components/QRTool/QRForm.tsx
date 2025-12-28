import React, { useState } from 'react';
import type { ShapeType, CornerType, GradientType, Preset, CryptoType, CustomField } from '../../types';
import { Upload, ChevronDown, Check, Zap, Settings, Code, Image as ImageIcon, Trash2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';

interface QrFormProps {
    content: string; onContentChange: (v: string) => void;
    label: string; onLabelChange: (v: string) => void;
    message: string; onMessageChange: (v: string) => void;
    amount: string; onAmountChange: (v: string) => void;

    businessName: string; onBusinessNameChange: (v: string) => void;
    invoiceNumber: string; onInvoiceNumberChange: (v: string) => void;
    invoiceNotes: string; onInvoiceNotesChange: (v: string) => void;
    customFields: CustomField[]; onCustomFieldsChange: (v: CustomField[]) => void;
    invoiceMode: boolean; onInvoiceModeChange: (v: boolean) => void;

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
    onRandomize: () => void;
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

const AccordionSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, icon, children, isOpen, onToggle }) => (
    <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all mb-4">
        <button onClick={onToggle} className="w-full flex justify-between items-center p-3 text-left bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2 font-mono font-black uppercase text-xs tracking-widest">
                {icon}
                {title}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && <div className="p-4 border-t-2 border-black dark:border-white animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
);

export const QrForm: React.FC<QrFormProps> = (props) => {
    const [openSection, setOpenSection] = useState<number>(0);
    const [detectedCrypto, setDetectedCrypto] = useState<string | null>(null);

    const handleToggle = (index: number) => setOpenSection(openSection === index ? -1 : index);

    const {
        content, onContentChange, label, onLabelChange, message, onMessageChange, amount, onAmountChange,
        businessName, onBusinessNameChange, invoiceNumber, onInvoiceNumberChange, invoiceNotes, onInvoiceNotesChange,
        customFields, onCustomFieldsChange, invoiceMode, onInvoiceModeChange,
        onLogoChange, color, onColorChange, shape, onShapeChange, cornerType, onCornerChange,
        backgroundColor, onBackgroundColorChange, useGradient, onUseGradientChange, gradientColor, onGradientColorChange, gradientType, onGradientTypeChange,
        presets, onApplyPreset, onRandomize, activePreset, cryptoOptions, selectedCrypto, onCryptoChange,
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

    const addCustomField = () => {
        onCustomFieldsChange([...customFields, { id: Math.random().toString(36).substr(2, 9), label: '', value: '' }]);
    };

    const updateCustomField = (id: string, key: 'label' | 'value', value: string) => {
        const newFields = customFields.map(f => f.id === id ? { ...f, [key]: value } : f);
        onCustomFieldsChange(newFields);
    };

    const removeCustomField = (id: string) => {
        onCustomFieldsChange(customFields.filter(f => f.id !== id));
    };

    const shapeOptions: { id: ShapeType; label: string }[] = [
        { id: 'square', label: 'SQUARES' }, { id: 'dots', label: 'DOTS' }, { id: 'rounded', label: 'ROUNDED' },
        { id: 'extra-rounded', label: 'EXTRA' }, { id: 'classy', label: 'CLASSY' }, { id: 'classy-rounded', label: 'CLASSY R.' }
    ];
    const cornerOptions: { id: CornerType; label: string }[] = [
        { id: 'square', label: 'SQUARE' }, { id: 'dot', label: 'DOT' }, { id: 'extra-rounded', label: 'ROUNDED' }
    ];
    const gradOptions: { id: GradientType; label: string }[] = [
        { id: 'linear', label: 'LINEAR' }, { id: 'radial', label: 'RADIAL' }
    ];

    return (
        <div className="w-full flex flex-col gap-4 font-mono">
            {/* 1. SOURCE & CONTENT */}
            <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-4">
                <h2 className="font-black text-sm border-b-2 border-black dark:border-zinc-800 pb-2 mb-4 uppercase flex items-center gap-2 dark:text-white">
                    <div className="w-3 h-3 bg-monero-orange"></div> 01. CONTENT_FORGE
                </h2>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        {cryptoOptions.map(c => (
                            <button
                                key={c.id}
                                onClick={() => onCryptoChange(c.id)}
                                className={`px-3 py-1 text-[10px] font-bold border-2 transition-all uppercase ${selectedCrypto === c.id ? 'bg-monero-orange text-white border-black' : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:border-black dark:hover:border-white'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">{isCustom ? 'INPUT_RAW' : 'TARGET_ADDRESS'}</label>
                        <textarea
                            value={content}
                            onChange={handleAutodetectChange}
                            className="w-full border-2 border-black dark:border-white p-3 text-xs h-24 font-mono font-bold outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 bg-gray-100 dark:bg-zinc-900 dark:text-white"
                            placeholder={currentCrypto?.placeholder}
                        />

                        <div className="flex justify-between items-center h-6">
                            {detectedCrypto && (
                                <span className="text-[10px] font-black bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 border border-green-700/20 uppercase">
                                    DETECTED: {detectedCrypto}
                                </span>
                            )}
                            {!isCustom && content && (
                                <button
                                    onClick={onVerifyClick}
                                    className="ml-auto flex items-center gap-1.5 text-[10px] font-black text-red-600 dark:text-red-400 hover:underline border-2 border-red-600/20 px-2 py-0.5"
                                >
                                    <ShieldCheck size={12} /> VERIFY_STRING
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={`p-4 border-2 transition-all ${invoiceMode ? 'border-monero-orange bg-monero-orange/5' : 'border-black dark:border-white opacity-50'}`}>
                        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => onInvoiceModeChange(!invoiceMode)}>
                            <span className="text-xs font-black uppercase flex items-center gap-2 dark:text-white">
                                <Zap size={14} className={invoiceMode ? 'text-monero-orange' : ''} />
                                INVOICE_OVERLAY
                            </span>
                            <div className={`w-10 h-5 border-2 border-black dark:border-white relative transition-colors ${invoiceMode ? 'bg-monero-orange' : 'bg-gray-200 dark:bg-zinc-800'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 border-2 border-black dark:border-white bg-white transition-all ${invoiceMode ? 'right-0.5' : 'left-0.5'}`}></div>
                            </div>
                        </div>

                        {invoiceMode && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">TOTAL_VALUE</label>
                                        <input type="text" value={amount} onChange={(e) => onAmountChange(e.target.value)} className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white" placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">SEQ_NUMBER</label>
                                        <input type="text" value={invoiceNumber} onChange={(e) => onInvoiceNumberChange(e.target.value)} className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white" placeholder="#001" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">ENTITY_IDENTIFIER</label>
                                    <input type="text" value={businessName} onChange={(e) => onBusinessNameChange(e.target.value)} className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-white dark:bg-zinc-800 dark:text-white" placeholder="MY_NODE_STORE" />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">MANIFEST_ITEMS</label>
                                    <div className="space-y-2">
                                        {customFields.map(field => (
                                            <div key={field.id} className="flex gap-2 items-center">
                                                <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} className="flex-1 border-2 border-black dark:border-white p-2 text-[10px] font-bold bg-white dark:bg-zinc-800 dark:text-white" placeholder="DESCRIPTION" />
                                                <input type="text" value={field.value} onChange={(e) => updateCustomField(field.id, 'value', e.target.value)} className="w-24 border-2 border-black dark:border-white p-2 text-[10px] font-black text-right bg-white dark:bg-zinc-800 dark:text-white" placeholder="PRICE" />
                                                <button onClick={() => removeCustomField(field.id)} className="text-red-600 hover:bg-red-50 p-1"><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                        <button onClick={addCustomField} className="w-full py-2 text-[10px] font-black border-2 border-dotted border-black dark:border-white hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 dark:text-white transition-all">
                                            <Plus size={12} /> ADD_ITEM_ENTRY
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">TERMINAL_NOTES</label>
                                    <textarea value={invoiceNotes} onChange={(e) => onInvoiceNotesChange(e.target.value)} className="w-full border-2 border-black dark:border-white p-2 text-xs h-12 resize-none font-bold bg-white dark:bg-zinc-800 dark:text-white" placeholder="TRANSMISSION NOTES..." />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. DESIGN accordion */}
            <AccordionSection title="02. STYLE_ENGINE" icon={<Settings size={14} />} isOpen={openSection === 0} onToggle={() => handleToggle(0)}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">QUICK_PRESETS</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {presets.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => onApplyPreset(p)}
                                    className={`p-2 text-[10px] font-bold border-2 uppercase transition-all ${activePreset === p.name ? 'bg-monero-orange text-white border-black' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-transparent hover:border-black dark:hover:border-white'}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border-2 border-black dark:border-zinc-700 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase dark:text-white">DOT_MATRIX</label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">GRADIENT</span>
                                    <input type="checkbox" checked={useGradient} onChange={(e) => onUseGradientChange(e.target.checked)} className="accent-monero-orange" />
                                </label>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-4">
                                    <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="h-8 flex-1 cursor-pointer border-2 border-black dark:border-white p-0.5 bg-white" />
                                    {useGradient && <input type="color" value={gradientColor} onChange={(e) => onGradientColorChange(e.target.value)} className="h-8 flex-1 cursor-pointer border-2 border-black dark:border-white p-0.5 bg-white" />}
                                </div>
                                {useGradient && (
                                    <div className="flex gap-2">
                                        {gradOptions.map(o => (
                                            <button key={o.id} onClick={() => onGradientTypeChange(o.id)} className={`flex-1 py-1 text-[8px] font-black border-2 uppercase transition-all ${gradientType === o.id ? 'bg-black text-white' : 'border-black/10'}`}>{o.label}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-2 border-black dark:border-zinc-700 p-4 space-y-4">
                            <label className="block text-[10px] font-black uppercase dark:text-white">BACKGROUND_LAYER</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={backgroundColor} onChange={(e) => onBackgroundColorChange(e.target.value)} className="h-8 w-16 cursor-pointer border-2 border-black p-0.5 bg-white" />
                                <span className="text-[10px] font-black font-mono uppercase bg-black text-white px-2 py-1">{backgroundColor}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-gray-500">PATTERN_STYLE</label>
                            <div className="grid grid-cols-3 gap-1">
                                {shapeOptions.map(s => (
                                    <button key={s.id} onClick={() => onShapeChange(s.id)} className={`py-2 text-[8px] font-black border-2 uppercase transition-all ${shape === s.id ? 'bg-black dark:bg-white text-white dark:text-black border-black' : 'border-black/5 text-gray-400'}`}>{s.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-gray-500">CORNER_TYPE</label>
                            <div className="grid grid-cols-3 gap-1">
                                {cornerOptions.map(c => (
                                    <button key={c.id} onClick={() => onCornerChange(c.id)} className={`py-2 text-[8px] font-black border-2 uppercase transition-all ${cornerType === c.id ? 'bg-black dark:bg-white text-white dark:text-black border-black' : 'border-black/5 text-gray-400'}`}>{c.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-gray-500">LOGO_OVERLAY</label>
                            <label className="flex items-center justify-center p-4 border-2 border-dashed border-black dark:border-white hover:bg-monero-orange/5 transition-colors cursor-pointer group">
                                <ImageIcon className="text-gray-400 group-hover:text-monero-orange transition-colors" size={20} />
                                <span className="ml-2 text-[10px] font-black uppercase text-gray-400 group-hover:text-black dark:group-hover:text-white">UPLOAD_ASSET</span>
                                <input type="file" className="hidden" accept="image/*" onChange={onLogoChange} />
                            </label>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                                <span>RESOLUTION</span>
                                <span className="text-black dark:text-white">{qrSize}PX</span>
                            </div>
                            <input type="range" min="200" max="800" step="50" value={qrSize} onChange={(e) => onQrSizeChange(Number(e.target.value))} className="w-full accent-monero-orange" />
                        </div>
                    </div>

                    <div className="pt-4 border-t-2 border-black dark:border-zinc-800">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={isDisposable} onChange={(e) => onIsDisposableChange(e.target.checked)} className="w-4 h-4 accent-red-600" />
                                <span className="text-xs font-black uppercase group-hover:text-red-600 transition-colors dark:text-white">AUTO_DESTRUCT_PROTOCOL</span>
                            </div>
                            {isDisposable && (
                                <div className="flex items-center bg-black text-white px-2 py-1">
                                    <input type="number" min="10" max="300" value={disposableTimeout} onChange={(e) => onDisposableTimeoutChange(parseInt(e.target.value))} className="bg-transparent text-right w-12 text-xs font-bold outline-none" />
                                    <span className="text-[10px] font-black ml-1 text-monero-orange">SEC</span>
                                </div>
                            )}
                        </label>
                    </div>
                </div>
            </AccordionSection>

            {/* 3. CODE accordion */}
            <AccordionSection title="03. SOURCE_SNIPPET" icon={<Code size={14} />} isOpen={openSection === 1} onToggle={() => handleToggle(1)}>
                <div className="bg-zinc-900 text-green-400 p-4 border-2 border-black text-[10px] font-mono overflow-auto max-h-48 scrollbar-hide">
                    <pre className="whitespace-pre-wrap leading-relaxed">{codeSnippet}</pre>
                </div>
            </AccordionSection>

            {/* RANDOMIZE */}
            <div className="pt-2">
                <button onClick={onRandomize} className="w-full py-4 text-xs font-black uppercase border-4 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 dark:text-white">
                    <RefreshCw size={14} className="text-monero-orange" /> RANDOMIZE_ALGORITHM
                </button>
            </div>
        </div>
    );
};
