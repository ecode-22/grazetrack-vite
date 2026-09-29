import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Rebuild the SW whenever app code changes so a farmer reopening the
      // app in the field always gets the newest cached shell, not a stale one.
      injectRegister: 'auto',
      manifest: {
        name: 'GrazingTrack',
        short_name: 'GrazingTrack',
        description: 'Rotational grazing management for farmers — offline-first.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b1f16',
        theme_color: '#2d6a4f',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // App shell precached automatically by the plugin; here we add a
        // runtime strategy so map tiles keep working with no connectivity
        // once a farmer has panned over an area at least once.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
})
