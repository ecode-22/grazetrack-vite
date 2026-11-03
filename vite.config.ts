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
    }),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
})
