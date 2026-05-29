import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Loader2, GripVertical, X, Eye, EyeOff, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { showToast } from './Toast';

type Visibility = 'public' | 'unlisted' | 'private';

interface GalleryImage {
    id: number;
    file_url: string;
    caption: string | null;
    alt_text: string | null;
    visibility: Visibility;
    sort_order: number;
    views: number;
}

const apiFetch = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('goxmr_token');
    return fetch(url, {
        ...options,
        headers: { ...(options?.headers || {}), Authorization: 'Bearer ' + token },
    });
};

const VIS_META: Record<Visibility, { label: string; icon: React.ReactNode; hint: string; color: string }> = {
    public:   { label: 'Public',   icon: <Eye size={10} />,    hint: 'Shows on your profile grid',                  color: 'text-green-700 dark:text-green-300' },
    unlisted: { label: 'Unlisted', icon: <LinkIcon size={10}/>, hint: 'Not on profile, but anyone with the link sees', color: 'text-amber-700 dark:text-amber-300' },
    private:  { label: 'Private',  icon: <EyeOff size={10} />, hint: 'Only you in this dashboard',                  color: 'text-red-700 dark:text-red-300' },
};

export const GalleryEditor: React.FC = () => {
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [max, setMax] = useState(12);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragId, setDragId] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        try {
            const r = await apiFetch('/api/me/gallery');
            const j = await r.json();
            if (r.ok) { setImages(j.images || []); setMax(j.max || 12); }
        } catch {}
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const onPickFiles = () => fileInputRef.current?.click();

    const uploadFiles = async (files: FileList | File[]) => {
        const list = Array.from(files);
        if (!list.length) return;
        const remaining = max - images.length;
        if (remaining <= 0) {
            showToast(`Gallery full (${max} max). Delete some first.`, 'error');
            return;
        }
        const chunk = list.slice(0, remaining);
        if (chunk.length < list.length) {
            showToast(`Only ${chunk.length} of ${list.length} uploaded — quota cap reached.`, 'info');
        }
        const oversize = chunk.find(f => f.size > 10 * 1024 * 1024);
        if (oversize) {
            showToast(`"${oversize.name}" too large (10MB max).`, 'error');
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            for (const f of chunk) fd.append('images', f);
            const r = await apiFetch('/api/me/gallery', { method: 'POST', body: fd });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Upload failed');
            setImages(prev => [...prev, ...(j.created || [])]);
            showToast(`Added ${j.count} ${j.count === 1 ? 'image' : 'images'}`, 'success');
        } catch (err: any) {
            showToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
        }
    };

    const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        e.target.value = '';
        if (files) await uploadFiles(files);
    };

    // drag-drop on the whole editor area for bulk upload
    const onDropFiles = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer?.files;
        if (files && files.length) await uploadFiles(files);
    };

    const patchImage = (id: number, patch: Partial<GalleryImage>) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img));
    };

    const persistField = async (id: number, body: any) => {
        try {
            await apiFetch(`/api/me/gallery/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch { /* optimistic */ }
    };

    const deleteImage = async (id: number) => {
        if (!confirm('Remove this image from your gallery?')) return;
        const prev = images;
        setImages(images.filter(i => i.id !== id));
        try {
            const r = await apiFetch(`/api/me/gallery/${id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error();
            showToast('Removed', 'info', 1500);
        } catch { setImages(prev); showToast('Delete failed', 'error'); }
    };

    const onDragStart = (id: number) => setDragId(id);
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDropCard = async (targetId: number) => {
        if (dragId === null || dragId === targetId) return;
        const fromIdx = images.findIndex(i => i.id === dragId);
        const toIdx = images.findIndex(i => i.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return;
        const next = images.slice();
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        const stamped = next.map((img, i) => ({ ...img, sort_order: i }));
        setImages(stamped);
        setDragId(null);
        await Promise.allSettled(stamped.map(img => persistField(img.id, { sort_order: img.sort_order })));
    };

    const remaining = max - images.length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-monero-orange" />
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white">Gallery</h3>
                    <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{images.length}/{max} images</span>
                </div>
                <button
                    onClick={onPickFiles}
                    disabled={uploading || remaining <= 0}
                    className="font-mono text-[10px] uppercase tracking-wider font-bold px-3 py-2 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {uploading ? 'Uploading...' : remaining > 0 ? `Add (${remaining} left)` : 'Full'}
                </button>
                <input
                    type="file" ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden" onChange={onFileInputChange}
                />
            </div>

            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                EXIF stripped server-side. Auto-converted to webp at 1600px max (GIFs keep their animation, 5MB cap). Drag-drop files anywhere in this box for bulk upload. Drag a card to reorder.
            </p>

            <div
                onDragEnter={() => setDragOver(true)}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropFiles}
                className={`relative ${dragOver ? 'ring-2 ring-monero-orange ring-offset-2 dark:ring-offset-zinc-900' : ''}`}
            >
                {loading ? (
                    <div className="py-6 flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span className="font-mono text-xs">Loading...</span></div>
                ) : images.length === 0 ? (
                    <button
                        onClick={onPickFiles} disabled={uploading}
                        className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 py-12 hover:border-monero-orange hover:bg-monero-orange/5 transition-colors flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400"
                    >
                        <ImageIcon size={24} />
                        <span className="font-mono text-[10px] uppercase tracking-widest">Drop files here or click to add</span>
                    </button>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {images.map((img) => {
                            const vm = VIS_META[img.visibility];
                            return (
                                <div
                                    key={img.id}
                                    draggable
                                    onDragStart={() => onDragStart(img.id)}
                                    onDragOver={onDragOver}
                                    onDrop={() => onDropCard(img.id)}
                                    className={`border-2 border-black dark:border-white bg-white dark:bg-zinc-900 group relative ${dragId === img.id ? 'opacity-50' : ''}`}
                                >
                                    <div className="relative aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                                        <img src={img.file_url} alt={img.alt_text || img.caption || 'gallery image'} className="w-full h-full object-cover" loading="lazy" />
                                        <button onClick={() => deleteImage(img.id)} title="Delete" className="absolute top-1 right-1 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                                            <Trash2 size={12} />
                                        </button>
                                        <div className="absolute top-1 left-1 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"><GripVertical size={12} /></div>
                                        {/* visibility + views overlay (always visible) */}
                                        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/70 ${vm.color} font-mono text-[9px] uppercase tracking-wider`} title={vm.hint}>
                                                {vm.icon} {vm.label}
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-black/70 text-white/80 font-mono text-[9px]" title="Anonymous view count">
                                                {img.views} {img.views === 1 ? 'view' : 'views'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="border-t border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10">
                                        <input
                                            type="text" value={img.caption || ''}
                                            onChange={e => patchImage(img.id, { caption: e.target.value })}
                                            onBlur={() => persistField(img.id, { caption: img.caption })}
                                            placeholder="Caption (optional, public)" maxLength={280}
                                            className="w-full bg-transparent p-2 font-mono text-[10px] dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800"
                                        />
                                        <input
                                            type="text" value={img.alt_text || ''}
                                            onChange={e => patchImage(img.id, { alt_text: e.target.value })}
                                            onBlur={() => persistField(img.id, { alt_text: img.alt_text })}
                                            placeholder="Alt text (for screen readers)" maxLength={280}
                                            className="w-full bg-transparent p-2 font-mono text-[10px] dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 text-gray-700 dark:text-gray-300"
                                        />
                                        <div className="relative">
                                            <select
                                                value={img.visibility}
                                                onChange={e => {
                                                    const v = e.target.value as Visibility;
                                                    patchImage(img.id, { visibility: v });
                                                    persistField(img.id, { visibility: v });
                                                }}
                                                className="w-full appearance-none bg-transparent p-2 pr-7 font-mono text-[10px] uppercase tracking-wider dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800 cursor-pointer"
                                            >
                                                <option value="public">Public on profile</option>
                                                <option value="unlisted">Unlisted (link only)</option>
                                                <option value="private">Private (dashboard only)</option>
                                            </select>
                                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {dragOver && (
                    <div className="absolute inset-0 bg-monero-orange/10 border-2 border-dashed border-monero-orange flex items-center justify-center pointer-events-none">
                        <p className="font-mono text-xs uppercase tracking-widest text-monero-orange font-black">Drop to upload</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Compact lightbox for the public profile gallery (re-exported for PublicGallery)
interface LightboxImg { file_url: string; caption: string | null; alt_text?: string | null; views?: number; id?: number }
interface LightboxProps {
    images: LightboxImg[];
    index: number;
    onClose: () => void;
    onIndex: (i: number) => void;
}

export const GalleryLightbox: React.FC<LightboxProps> = ({ images, index, onClose, onIndex }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
            if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [index, images.length, onClose, onIndex]);

    if (!images[index]) return null;
    const img = images[index];
    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 right-4 p-2 bg-white text-black hover:bg-monero-orange hover:text-white border-2 border-white" aria-label="Close">
                <X size={18} />
            </button>
            <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                <img src={img.file_url} alt={img.alt_text || img.caption || ''} className="w-full max-h-[80vh] object-contain border-4 border-white" />
                {img.caption && (<p className="text-white font-mono text-xs mt-3 text-center">{img.caption}</p>)}
                <div className="flex justify-center gap-2 mt-3">
                    <button onClick={() => onIndex((index - 1 + images.length) % images.length)} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 bg-white text-black hover:bg-monero-orange hover:text-white">← prev</button>
                    <span className="font-mono text-[10px] uppercase text-white/60 self-center">{index + 1} / {images.length}{typeof img.views === 'number' ? ` · ${img.views} views` : ''}</span>
                    <button onClick={() => onIndex((index + 1) % images.length)} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 bg-white text-black hover:bg-monero-orange hover:text-white">next →</button>
                </div>
            </div>
        </div>
    );
};
