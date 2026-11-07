import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['assets/brand/weirdmas-mark.svg'],
    manifest: {
      name: 'Weirdmas — December Illustration Challenge',
      short_name: 'Weirdmas',
      description: 'A daily December drawing ritual.',
      theme_color: '#0B1721',
      background_color: '#0B1721',
      display: 'standalone',
      start_url: '/',
      icons: [{ src: '/assets/brand/weirdmas-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
  })],
});
