import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [
      'assets/brand/weirdmas-mark-180.png',
      'assets/brand/weirdmas-mark-192.png',
      'assets/brand/weirdmas-mark-512.png',
    ],
    manifest: {
      name: 'Weirdmas — December Illustration Challenge',
      short_name: 'Weirdmas',
      description: 'A daily December drawing ritual.',
      theme_color: '#0B1721',
      background_color: '#0B1721',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/assets/brand/weirdmas-mark-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/assets/brand/weirdmas-mark-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
  })],
});
