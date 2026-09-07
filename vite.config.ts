import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Suivi Chantier',
        short_name: 'Chantier',
        description: 'Suivi de chantier connecté, utilisable hors ligne.',
        theme_color: '#0b3b60',
        background_color: '#f6f8fa',
        display: 'standalone',
        icons: []
      },
      workbox: { navigateFallback: '/index.html' }
    })
  ]
})
