import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Suivi Chantier',
        short_name: 'Chantier',
        description: 'Suivi de chantier connecté, utilisable hors ligne.',
        theme_color: '#02457A',
        background_color: '#eaf0f6',
        display: 'standalone',
        icons: [
          { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: { navigateFallback: '/index.html' }
    })
  ],
  preview: {
    // Railway serves the built app via `vite preview` (see railway.toml).
    // Vite 7 validates the Host header and rejects unknown domains otherwise.
    allowedHosts: ['suivi-chantier-production-396f.up.railway.app']
  }
})
