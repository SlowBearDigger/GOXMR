import React, { useEffect, useState } from 'react';
import { GalleryLightbox } from './GalleryEditor';

interface PublicGalleryImage {
    id: number;
    file_url: string;
    caption: string | null;
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

    if (!images.length) return null;

    return (
        <>
            <div className="max-w-3xl mx-auto mt-10 px-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono font-black uppercase text-xs tracking-wider text-black/70 dark:text-white/70">
                        Gallery
                    </h3>
                    <span className="font-mono text-[10px] text-black/40 dark:text-white/40 uppercase tracking-wider">
                        {images.length} {images.length === 1 ? 'image' : 'images'}
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img, i) => (
                        <button
                            key={img.id}
                            onClick={() => setLightboxIndex(i)}
                            className="group block aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden border-2 border-black/10 dark:border-white/10 hover:border-monero-orange transition-colors relative"
                            aria-label={img.caption || `Image ${i + 1}`}
                        >
                            <img
                                src={img.file_url}
                                alt={img.caption || ''}
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
                    onIndex={setLightboxIndex}
                />
            )}
        </>
    );
};
