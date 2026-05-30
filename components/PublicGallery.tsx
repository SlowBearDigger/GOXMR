import React, { useEffect, useState } from 'react';
import { GalleryLightbox } from './GalleryEditor';

interface PublicGalleryImage {
    id: number;
    file_url: string;
    caption: string | null;
    alt_text: string | null;
    views: number;
}

const VIEW_DEDUP_KEY = 'goxmr_gallery_views_v1';

function alreadyCounted(id: number): boolean {
    try {
        const raw = sessionStorage.getItem(VIEW_DEDUP_KEY);
        const set = new Set<number>(raw ? JSON.parse(raw) : []);
        return set.has(id);
    } catch { return false; }
}

function markCounted(id: number) {
    try {
        const raw = sessionStorage.getItem(VIEW_DEDUP_KEY);
        const arr: number[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(id)) {
            arr.push(id);
            sessionStorage.setItem(VIEW_DEDUP_KEY, JSON.stringify(arr.slice(-500)));
        }
    } catch {}
}

export const PublicGallery: React.FC<{ username: string }> = ({ username }) => {
    const [images, setImages] = useState<PublicGalleryImage[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!username) return;
        let cancelled = false;
        fetch(`/api/user/${encodeURIComponent(username)}/gallery`)
            .then(r => r.ok ? r.json() : { images: [] })
            .then(d => { if (!cancelled) setImages(d.images || []); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [username]);

    const openAt = (i: number) => {
        setLightboxIndex(i);
        const img = images[i];
        if (!img || alreadyCounted(img.id)) return;
        markCounted(img.id);
        // optimistic local bump
        setImages(prev => prev.map(p => p.id === img.id ? { ...p, views: (p.views || 0) + 1 } : p));
        fetch(`/api/user/${encodeURIComponent(username)}/gallery/${img.id}/view`, { method: 'POST' }).catch(() => {});
    };

    if (!images.length) return null;

    return (
        <>
            <div className="mt-6 mb-2">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono font-black uppercase text-xs tracking-wider text-black/70 dark:text-white/70">Gallery</h3>
                    <span className="font-mono text-[10px] text-black/40 dark:text-white/40 uppercase tracking-wider">
                        {images.length} {images.length === 1 ? 'image' : 'images'}
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {images.map((img, i) => (
                        <button
                            key={img.id}
                            onClick={() => openAt(i)}
                            className="group block aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden border-2 border-black/10 dark:border-white/10 hover:border-monero-orange transition-colors relative"
                            aria-label={img.alt_text || img.caption || `Image ${i + 1}`}
                        >
                            <img
                                src={img.file_url}
                                alt={img.alt_text || img.caption || ''}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {img.caption && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white font-mono text-[10px] line-clamp-2">{img.caption}</p>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            {lightboxIndex !== null && (
                <GalleryLightbox
                    images={images}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndex={openAt}
                />
            )}
        </>
    );
};
