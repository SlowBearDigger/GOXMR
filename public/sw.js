// Service worker kill-switch — see vite.config.ts comment.
// Browsers that installed the old vite-plugin-pwa worker keep running it across page
// loads until they refetch this path. This stub unregisters itself, deletes every
// cache, and reloads any open clients so the page falls back to a plain non-PWA state.
// Lives in public/ so vite copies it to dist/ on every build (otherwise --delete rsync
// wipes it and pre-existing browser SW installations stay stuck forever).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            await self.registration.unregister();
            const clients = await self.clients.matchAll({ type: 'window' });
            for (const c of clients) {
                try { c.navigate(c.url); } catch {}
            }
        } catch {}
    })());
});
self.addEventListener('fetch', () => {}); // no-op, never intercept
