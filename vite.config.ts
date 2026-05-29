import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VitePWA intentionally removed: nothing in the app actually consumes PWA features,
// but the plugin auto-registered a service worker + manifest on every page load,
// which made Brave/Firefox prompt "Access other apps and services on this device"
// (PWA install / protocol handler permission). The site is meant to be a plain web
// surface — no installable app, no offline mode. If we ever need offline support,
// re-add with registerType: 'prompt' and a manual user-gated registration call.

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    }
});
