import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Loader2, GripVertical, X } from 'lucide-react';
import { showToast } from './Toast';

interface GalleryImage {
    id: number;
    file_url: string;
    caption: string | null;
    sort_order: number;
}

const apiFetch = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('goxmr_token');
    return fetch(url, {
        ...options,
        headers: {
            ...(options?.headers || {}),
            Authorization: 'Bearer ' + token,
        },
    });
};

export const GalleryEditor: React.FC = () => {
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [max, setMax] = useState(12);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragId, setDragId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        try {
            const r = await apiFetch('/api/me/gallery');
            const j = await r.json();
            if (r.ok) {
                setImages(j.images || []);
                setMax(j.max || 12);
            }
        } catch {}
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const onPickFile = () => fileInputRef.current?.click();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (images.length >= max) {
            showToast(`Gallery full. Max ${max} images. Delete one first.`, 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image too large (10MB max)', 'error');
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const r = await apiFetch('/api/me/gallery', { method: 'POST', body: fd });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Upload failed');
            setImages(prev => [...prev, j]);
            showToast('Added to gallery', 'success');
        } catch (err: any) {
            showToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
        }
    };

    const updateCaption = async (id: number, caption: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, caption } : img));
        try { await apiFetch(`/api/me/gallery/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) }); }
        catch { /* keep optimistic UI */ }
    };

    const deleteImage = async (id: number) => {
        if (!confirm('Remove this image from your gallery?')) return;
        const prev = images;
        setImages(images.filter(i => i.id !== id));
        try {
            const r = await apiFetch(`/api/me/gallery/${id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error();
            showToast('Removed', 'info', 1500);
        } catch {
            setImages(prev);
            showToast('Delete failed', 'error');
        }
    };

    // simple drag-to-reorder. on drop, persist the new sort_order for affected rows.
    const onDragStart = (id: number) => setDragId(id);
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDrop = async (targetId: number) => {
        if (dragId === null || dragId === targetId) return;
        const fromIdx = images.findIndex(i => i.id === dragId);
        const toIdx = images.findIndex(i => i.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return;
        const next = images.slice();
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        // re-stamp sort_order locally
        const stamped = next.map((img, i) => ({ ...img, sort_order: i }));
        setImages(stamped);
        setDragId(null);
        // persist (parallel)
        await Promise.allSettled(stamped.map(img =>
            apiFetch(`/api/me/gallery/${img.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: img.sort_order }) })
        ));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-monero-orange" />
                    <h3 className="font-mono font-black uppercase text-sm dark:text-white">Gallery</h3>
                    <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        {images.length}/{max} images
                    </span>
                </div>
                <button
                    onClick={onPickFile}
                    disabled={uploading || images.length >= max}
                    className="font-mono text-[10px] uppercase tracking-wider font-bold px-3 py-2 border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-monero-orange hover:border-monero-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {uploading ? 'Uploading...' : 'Add image'}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleUpload}
                />
            </div>

            <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Anything you upload shows on your public profile under your bio. Auto-converted to webp at 1600px max, except GIFs which keep their animation (5MB cap). Drag to reorder.
            </p>

            {loading ? (
                <div className="py-6 flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span className="font-mono text-xs">Loading...</span></div>
            ) : images.length === 0 ? (
                <button
                    onClick={onPickFile}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 py-12 hover:border-monero-orange hover:bg-monero-orange/5 transition-colors flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400"
                >
                    <ImageIcon size={24} />
                    <span className="font-mono text-[10px] uppercase tracking-widest">Add your first image</span>
                </button>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img) => (
                        <div
                            key={img.id}
                            draggable
                            onDragStart={() => onDragStart(img.id)}
                            onDragOver={onDragOver}
                            onDrop={() => onDrop(img.id)}
                            className={`border-2 border-black dark:border-white bg-white dark:bg-zinc-900 group relative ${dragId === img.id ? 'opacity-50' : ''}`}
                        >
                            <div className="relative aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                                <img
                                    src={img.file_url}
                                    alt={img.caption || 'gallery image'}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <button
                                    onClick={() => deleteImage(img.id)}
                                    title="Delete"
                                    className="absolute top-1 right-1 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                >
                                    <Trash2 size={12} />
                                </button>
                                <div className="absolute top-1 left-1 p-1 bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                                    <GripVertical size={12} />
                                </div>
                            </div>
                            <input
                                type="text"
                                value={img.caption || ''}
                                onChange={e => updateCaption(img.id, e.target.value)}
                                placeholder="Caption (optional)"
                                maxLength={280}
                                className="w-full border-t border-black/10 dark:border-white/10 bg-transparent p-2 font-mono text-[10px] dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-zinc-800"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Compact lightbox for the public profile gallery
interface LightboxProps {
    images: { file_url: string; caption: string | null }[];
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
    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 p-2 bg-white text-black hover:bg-monero-orange hover:text-white border-2 border-white"
                aria-label="Close"
            >
                <X size={18} />
            </button>
            <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                <img
                    src={images[index].file_url}
                    alt={images[index].caption || ''}
                    className="w-full max-h-[80vh] object-contain border-4 border-white"
                />
                {images[index].caption && (
                    <p className="text-white font-mono text-xs mt-3 text-center">{images[index].caption}</p>
                )}
                <div className="flex justify-center gap-2 mt-3">
                    <button onClick={() => onIndex((index - 1 + images.length) % images.length)} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 bg-white text-black hover:bg-monero-orange hover:text-white">← prev</button>
                    <span className="font-mono text-[10px] uppercase text-white/60 self-center">{index + 1} / {images.length}</span>
                    <button onClick={() => onIndex((index + 1) % images.length)} className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 bg-white text-black hover:bg-monero-orange hover:text-white">next →</button>
                </div>
            </div>
        </div>
    );
};
