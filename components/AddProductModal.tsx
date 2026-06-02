import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Package, X, Plus, Trash2, Globe, FileText, Link as LinkIcon, Lock, Image as ImageIcon, Loader2, Edit } from 'lucide-react';
import { useModalChrome } from '../hooks/useModalChrome';
// API calls use raw fetch with manual token attachment

interface AddProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    username: string;
    initialProduct?: any;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess, username, initialProduct }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const modalContentRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useModalChrome({ isOpen, onClose, contentRef: modalContentRef });

    // Product Basic Info
    const [productType, setProductType] = useState<'physical' | 'digital' | 'service'>('digital');
    const [category, setCategory] = useState('');
    const [priceXmr, setPriceXmr] = useState('');
    const [stock, setStock] = useState('-1'); // -1 for unlimited

    // Encrypted Product Details
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');

    // Visibility — 3C adds 'unlisted' (off-listing, PIN-gated)
    const [visibility, setVisibility] = useState<'public' | 'pgp_only' | 'unlisted'>('public');

    // 3C: access PIN (sent in plaintext to the server once, bcrypt-hashed there; never echoed back)
    const [accessCode, setAccessCode] = useState('');
    const [clearAccessCode, setClearAccessCode] = useState(false);
    const hadAccessCode = !!initialProduct?.has_access_code;

    // Password for encryption (inline, not window.prompt)
    const [encryptionPassword, setEncryptionPassword] = useState('');

    // Digital Content
    const [digitalContent, setDigitalContent] = useState<any[]>([]);

    // Buyer Form Fields (3B): what the buyer must submit at checkout. Values get PGP-encrypted client-side
    // with the seller's effective pubkey and stored as ciphertext in order.encrypted_data.
    type FormField = { key: string; label: string; type: 'text' | 'textarea' | 'email'; required: boolean };
    const [buyerFormFields, setBuyerFormFields] = useState<FormField[]>([]);
    const applyFormTemplate = (kind: 'digital' | 'physical' | 'service') => {
        if (kind === 'digital') {
            setBuyerFormFields([
                { key: 'contact', label: 'Contact (email or Nostr npub)', type: 'text', required: true },
                { key: 'notes', label: 'Notes (optional)', type: 'textarea', required: false },
            ]);
        } else if (kind === 'physical') {
            setBuyerFormFields([
                { key: 'name', label: 'Recipient Name', type: 'text', required: true },
                { key: 'address', label: 'Shipping Address', type: 'textarea', required: true },
                { key: 'contact', label: 'Contact (email or Nostr)', type: 'text', required: true },
            ]);
        } else {
            setBuyerFormFields([
                { key: 'contact', label: 'Contact (email or Nostr)', type: 'text', required: true },
                { key: 'brief', label: 'Project brief / requirements', type: 'textarea', required: true },
            ]);
        }
    };
    const addFormField = () => setBuyerFormFields(prev => [...prev, { key: '', label: '', type: 'text', required: false }]);
    const removeFormField = (i: number) => setBuyerFormFields(prev => prev.filter((_, idx) => idx !== i));
    const updateFormField = (i: number, patch: Partial<FormField>) => setBuyerFormFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

    const addDigitalContent = () => {
        setDigitalContent([...digitalContent, {
            content_type: 'text',
            encrypted_content: '',
            file_name: '',
            file_size: 0,
            download_limit: -1
        }]);
    };

    const removeDigitalContent = (index: number) => {
        setDigitalContent(digitalContent.filter((_, i) => i !== index));
    };

    const updateDigitalContent = (index: number, updates: any) => {
        const newContent = [...digitalContent];
        newContent[index] = { ...newContent[index], ...updates };
        setDigitalContent(newContent);
    };

    React.useEffect(() => {
        if (initialProduct && isOpen) {
            setProductType(initialProduct.product_type);
            setCategory(initialProduct.category || '');
            setPriceXmr(initialProduct.price_xmr.toString());
            setStock(initialProduct.stock.toString());
            setName(initialProduct.name || '');
            setDescription(initialProduct.description || '');
            setThumbnailUrl(initialProduct.thumbnail_url || '');
            // For digital content, we'd need another API call to get the IDs 
            // or pass them in initialProduct. For now we just reset it.
            setDigitalContent([]);
            // prefill buyer form fields if present
            try {
                if (initialProduct.buyer_form_fields) {
                    const parsed = typeof initialProduct.buyer_form_fields === 'string'
                        ? JSON.parse(initialProduct.buyer_form_fields)
                        : initialProduct.buyer_form_fields;
                    if (Array.isArray(parsed)) setBuyerFormFields(parsed);
                } else {
                    setBuyerFormFields([]);
                }
            } catch { setBuyerFormFields([]); }
        } else if (!isOpen) {
            // Reset form when closing
            setStep(1);
            setProductType('digital');
            setCategory('');
            setPriceXmr('');
            setStock('-1');
            setName('');
            setDescription('');
            setThumbnailUrl('');
            setDigitalContent([]);
            setEncryptionPassword('');
            setBuyerFormFields([]);
            setVisibility('public');
            setAccessCode('');
            setClearAccessCode(false);
        }
    }, [initialProduct, isOpen]);

    React.useEffect(() => {
        if (initialProduct?.visibility === 'unlisted' || initialProduct?.visibility === 'pgp_only') {
            setVisibility(initialProduct.visibility);
        }
    }, [initialProduct]);

    const handleSubmit = async () => {
        if (!name || !priceXmr) {
            setError('Name and Price are required');
            return;
        }
        // Encryption password is now optional. We only require it when the seller is
        // also attaching digital downloads — those file payloads need encryption-at-rest
        // because the server is the storage layer. For plain physical/service listings
        // the seller can publish without any password.
        if (digitalContent.length > 0 && !encryptionPassword) {
            setError('Password is required to encrypt the digital file payload');
            return;
        }
        if (visibility === 'unlisted' && !hadAccessCode && (!accessCode || accessCode.length < 4)) {
            setError('Unlisted products require an access PIN (4+ chars)');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('goxmr_token');
            const password = encryptionPassword;

            // 1. Encrypt the "hidden" product details only when the seller chose to.
            // Without a password we skip the extra privacy layer; the plaintext name +
            // description + thumbnail already render the product publicly, and the server
            // just stores an empty encrypted_data column.
            let encrypted_data: string | null = null;
            if (password) {
                const { encryptData } = await import('../utils/crypto');
                encrypted_data = await encryptData({
                    name,
                    description,
                    images: [] // Full res images could be here
                }, password);
            }

            // 2. Encrypt digital content (only reachable if password is set, see guard above)
            let encrypted_digital_content: typeof digitalContent = digitalContent;
            if (digitalContent.length > 0 && password) {
                const { encryptData } = await import('../utils/crypto');
                encrypted_digital_content = await Promise.all(digitalContent.map(async (content) => {
                    const encrypted = await encryptData(content.encrypted_content, password);
                    return {
                        ...content,
                        encrypted_content: encrypted
                    };
                }));
            }

            const url = initialProduct ? `/api/store/products/${initialProduct.id}` : '/api/store/products';
            const method = initialProduct ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    product_type: productType,
                    encrypted_data,
                    name,
                    description,
                    thumbnail_url: thumbnailUrl,
                    category,
                    price_xmr: parseFloat(priceXmr),
                    stock: parseInt(stock),
                    visibility,
                    digital_content: encrypted_digital_content,
                    // send null on edit when seller cleared all fields, so the server clears the column
                    buyer_form_fields: buyerFormFields.length ? buyerFormFields : (initialProduct ? null : undefined),
                    // 3C: send PIN only if user typed one; on edit, send null to explicitly clear; otherwise leave alone
                    access_code: accessCode
                        ? accessCode
                        : (initialProduct && clearAccessCode ? null : undefined)
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create product');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={onClose}
        >
            <div
                ref={modalContentRef}
                tabIndex={-1}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative outline-none"
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 border-2 border-transparent hover:border-black dark:hover:border-white transition-all"
                >
                    <X size={24} className="dark:text-white" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-monero-orange p-3 border-2 border-black">
                        <Package size={24} className="text-white" />
                    </div>
                    <h2 id={titleId} className="text-2xl font-black font-mono uppercase dark:text-white">Add New Product</h2>
                </div>

                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Product Type</span>
                            <select
                                value={productType}
                                onChange={(e: any) => setProductType(e.target.value)}
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white"
                            >
                                <option value="digital">Digital Download</option>
                                <option value="physical">Physical Good</option>
                                <option value="service">Service / Work</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Category</span>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="E.g. Software, Art, Gear"
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                    </div>

                    {/* Visibility */}
                    <div>
                        <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Visibility</span>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setVisibility('public')}
                                className={`flex-1 min-w-[100px] p-3 border-2 font-mono text-xs font-bold uppercase transition-colors ${visibility === 'public' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                Public
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility('unlisted')}
                                className={`flex-1 min-w-[100px] p-3 border-2 font-mono text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1 ${visibility === 'unlisted' ? 'bg-monero-orange text-white border-monero-orange' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                <Lock size={12} /> Unlisted
                            </button>
                            <button
                                type="button"
                                onClick={() => setVisibility('pgp_only')}
                                className={`flex-1 min-w-[100px] p-3 border-2 font-mono text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1 ${visibility === 'pgp_only' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                <Lock size={12} /> PGP-Only
                            </button>
                        </div>
                        {visibility === 'unlisted' && (
                            <div className="mt-3 space-y-2">
                                <p className="font-mono text-[10px] text-monero-orange leading-relaxed">
                                    Hidden from your public listing. Buyers need a PIN to view or order. 5 wrong attempts = 1h lockout per IP.
                                </p>
                                {hadAccessCode && !clearAccessCode && (
                                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">A PIN is already set. Leave the field empty to keep it, or type a new one to replace it.</p>
                                )}
                                <label className="block">
                                    <span className="font-mono text-[10px] font-bold uppercase mb-1 block dark:text-white">
                                        Access PIN {!hadAccessCode && <span className="text-monero-orange">*</span>}
                                    </span>
                                    <input
                                        type="text"
                                        value={accessCode}
                                        onChange={e => setAccessCode(e.target.value)}
                                        placeholder={hadAccessCode ? 'Leave empty to keep current PIN' : '4–128 chars, share with buyers out-of-band'}
                                        className="w-full p-2 border-2 border-black dark:border-white font-mono text-xs bg-white dark:bg-zinc-800 dark:text-white"
                                        autoComplete="off"
                                    />
                                </label>
                                {hadAccessCode && (
                                    <label className="flex items-center gap-2 font-mono text-[10px] dark:text-white">
                                        <input type="checkbox" checked={clearAccessCode} onChange={e => { setClearAccessCode(e.target.checked); if (e.target.checked) setAccessCode(''); }} className="accent-monero-orange" />
                                        Remove the PIN (anyone with the link can buy)
                                    </label>
                                )}
                            </div>
                        )}
                        {visibility === 'pgp_only' && (
                            <p className="font-mono text-[10px] text-purple-500 mt-1">Name and description will be encrypted with your PGP key. Only holders of the corresponding key can view this product.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Price (XMR) *</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={priceXmr}
                                    onChange={(e) => setPriceXmr(e.target.value)}
                                    placeholder="0.05"
                                    className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white pl-12"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-monero-orange">ɱ</span>
                            </div>
                        </label>
                        <label className="block">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Stock / Inventory</span>
                            <input
                                type="number"
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                placeholder="-1 for unlimited"
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                    </div>

                    <div className="border-t-2 border-black dark:border-white pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock size={16} className="text-monero-orange" />
                            <span className="font-mono text-xs font-bold uppercase dark:text-white">Encrypted Details (Private)</span>
                        </div>

                        <label className="block mb-4">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Product Name *</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Awesome Digital Art Pack"
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white"
                            />
                        </label>

                        <label className="block mb-4">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Description</span>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                placeholder="Describe your product. This will be encrypted on our servers."
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white resize-none"
                            />
                        </label>

                        <label className="block mb-4">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">Public Thumbnail URL</span>
                            <div className="flex gap-2">
                                <div className="p-3 border-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-800 shrink-0">
                                    <ImageIcon size={20} className="text-gray-400" />
                                </div>
                                <input
                                    type="url"
                                    value={thumbnailUrl}
                                    onChange={(e) => setThumbnailUrl(e.target.value)}
                                    placeholder="https://i.imgur.com/example.jpg"
                                    className="flex-1 p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white text-sm"
                                />
                            </div>
                            <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase italic">Note: Thumbnails are public. Do not use sensitive images here.</p>
                        </label>
                    </div>

                    {/* Digital Content Section */}
                    {productType === 'digital' && (
                        <div className="border-t-2 border-black dark:border-white pt-6">
                            <div className="flex bg-black dark:bg-white text-white dark:text-black p-2 font-mono font-bold text-[10px] uppercase justify-between items-center mb-4">
                                <span>Digital Content (Encrypted Assets)</span>
                                <button
                                    onClick={addDigitalContent}
                                    className="bg-monero-orange text-white px-2 py-0.5 hover:bg-white hover:text-black transition-all border border-black"
                                >
                                    <Plus size={12} className="inline mr-1" /> Add Asset
                                </button>
                            </div>

                            <div className="space-y-4">
                                {digitalContent.map((content, idx) => (
                                    <div key={idx} className="border-2 border-black dark:border-white p-4 space-y-4 relative bg-gray-50 dark:bg-zinc-800/50">
                                        <button
                                            onClick={() => removeDigitalContent(idx)}
                                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                        <div className="grid grid-cols-2 gap-4">
                                            <label className="block">
                                                <span className="font-mono text-[10px] font-bold uppercase mb-1 block">Content Type</span>
                                                <select
                                                    value={content.content_type}
                                                    onChange={(e) => updateDigitalContent(idx, { content_type: e.target.value })}
                                                    className="w-full p-2 border-2 border-black dark:border-white font-mono text-xs dark:bg-zinc-800 dark:text-white"
                                                >
                                                    <option value="link">External Link</option>
                                                    <option value="code">License Code</option>
                                                    <option value="text">Raw Text/Secret</option>
                                                    <option value="file">File (Remote URL)</option>
                                                </select>
                                            </label>
                                            <label className="block">
                                                <span className="font-mono text-[10px] font-bold uppercase mb-1 block">Download Limit</span>
                                                <input
                                                    type="number"
                                                    value={content.download_limit}
                                                    onChange={(e) => updateDigitalContent(idx, { download_limit: parseInt(e.target.value) })}
                                                    className="w-full p-2 border-2 border-black dark:border-white font-mono text-xs dark:bg-zinc-800 dark:text-white"
                                                />
                                            </label>
                                        </div>

                                        <label className="block">
                                            <span className="font-mono text-[10px] font-bold uppercase mb-1 block">Content / Asset *</span>
                                            <textarea
                                                value={content.encrypted_content}
                                                onChange={(e) => updateDigitalContent(idx, { encrypted_content: e.target.value })}
                                                placeholder={content.content_type === 'link' ? 'https://megasync.com/...' : 'Your license key or secret text...'}
                                                className="w-full p-2 border-2 border-black dark:border-white font-mono text-xs h-20 dark:bg-zinc-800 dark:text-white"
                                            />
                                        </label>
                                    </div>
                                ))}

                                {digitalContent.length === 0 && (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-zinc-700">
                                        <p className="font-mono text-xs text-gray-400 uppercase italic">No digital content added yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Buyer Form Fields (3B) */}
                    <div className="border-t-2 border-black dark:border-white pt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock size={16} className="text-monero-orange" />
                            <span className="font-mono text-xs font-bold uppercase dark:text-white">Required From Buyer (PGP-Encrypted)</span>
                        </div>
                        <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                            Fields the buyer fills at checkout. Values are PGP-encrypted client-side with your store key before submit — only you decrypt them. Leave empty for an anonymous order.
                        </p>
                        <div className="flex gap-2 mb-3 flex-wrap">
                            <button type="button" onClick={() => applyFormTemplate('digital')} className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-gray-300 dark:border-zinc-700 hover:border-black dark:hover:border-white dark:text-white">Digital template</button>
                            <button type="button" onClick={() => applyFormTemplate('physical')} className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-gray-300 dark:border-zinc-700 hover:border-black dark:hover:border-white dark:text-white">Physical template</button>
                            <button type="button" onClick={() => applyFormTemplate('service')} className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-gray-300 dark:border-zinc-700 hover:border-black dark:hover:border-white dark:text-white">Service template</button>
                            <button type="button" onClick={addFormField} className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-monero-orange text-monero-orange hover:bg-monero-orange hover:text-white"><Plus size={10} className="inline" /> Add field</button>
                            {buyerFormFields.length > 0 && (
                                <button type="button" onClick={() => setBuyerFormFields([])} className="font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-gray-300 dark:border-zinc-700 text-gray-500 hover:text-red-500 hover:border-red-500">Clear all</button>
                            )}
                        </div>
                        {buyerFormFields.length === 0 && (
                            <div className="text-center py-4 border-2 border-dashed border-gray-300 dark:border-zinc-700">
                                <p className="font-mono text-[10px] text-gray-400 uppercase italic">No fields configured — orders will be anonymous</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            {buyerFormFields.map((field, idx) => (
                                <div key={idx} className="border-2 border-black dark:border-white p-3 bg-gray-50 dark:bg-zinc-800/50 relative">
                                    <button type="button" onClick={() => removeFormField(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500" aria-label="Remove field">
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="grid grid-cols-12 gap-2 pr-6">
                                        <input type="text" value={field.key} onChange={e => updateFormField(idx, { key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })} placeholder="key" className="col-span-3 p-1.5 border-2 border-black dark:border-white font-mono text-[10px] dark:bg-zinc-800 dark:text-white" />
                                        <input type="text" value={field.label} onChange={e => updateFormField(idx, { label: e.target.value })} placeholder="Label shown to buyer" className="col-span-5 p-1.5 border-2 border-black dark:border-white font-mono text-[10px] dark:bg-zinc-800 dark:text-white" />
                                        <select value={field.type} onChange={e => updateFormField(idx, { type: e.target.value as any })} className="col-span-2 p-1.5 border-2 border-black dark:border-white font-mono text-[10px] dark:bg-zinc-800 dark:text-white">
                                            <option value="text">text</option>
                                            <option value="textarea">multiline</option>
                                            <option value="email">email</option>
                                        </select>
                                        <label className="col-span-2 flex items-center gap-1 font-mono text-[10px] dark:text-white">
                                            <input type="checkbox" checked={field.required} onChange={e => updateFormField(idx, { required: e.target.checked })} className="accent-monero-orange" />
                                            required
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Encryption Password — optional unless attaching digital files */}
                    <div className="border-t-2 border-black dark:border-white pt-6">
                        <label className="block">
                            <span className="font-mono text-xs font-bold uppercase mb-2 block dark:text-white">
                                Encryption Password{' '}
                                <span className="text-gray-500 dark:text-gray-400 normal-case">
                                    ({digitalContent.length > 0 ? 'required for digital files' : 'optional'})
                                </span>
                            </span>
                            <input
                                type="password"
                                value={encryptionPassword}
                                onChange={(e) => setEncryptionPassword(e.target.value)}
                                placeholder={digitalContent.length > 0 ? 'Required — encrypts the file payload' : 'Leave empty to skip the privacy layer'}
                                className="w-full p-3 border-2 border-black dark:border-white font-mono bg-white dark:bg-zinc-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-monero-orange outline-none"
                            />
                            <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-1 uppercase">
                                {digitalContent.length > 0
                                    ? 'Required to encrypt digital downloads before storing'
                                    : 'Optional — only needed if you want to hide details behind a password layer'}
                            </p>
                        </label>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-4 text-red-700 dark:text-red-300 font-mono text-xs">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-6 border-t-2 border-black dark:border-white">
                        <button
                            onClick={onClose}
                            className="flex-1 p-4 border-4 border-black dark:border-white font-mono font-bold uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all dark:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 bg-monero-orange text-white p-4 border-4 border-black dark:border-white font-mono font-bold uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-1 hover:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    ENCRYPTING...
                                </>
                            ) : (
                                <>
                                    {initialProduct ? <Edit size={18} /> : <Plus size={18} />}
                                    {initialProduct ? 'Update Product' : 'Add Product'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
