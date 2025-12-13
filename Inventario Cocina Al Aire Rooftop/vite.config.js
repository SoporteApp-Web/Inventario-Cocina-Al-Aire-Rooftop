import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Archivos para cachear en la PWA
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // Configuración del manifiesto de la PWA
      manifest: {
        name: 'Inventario Cocina Al Aire',
        short_name: 'Inventario',
        description: 'Aplicación para la gestión de inventario de la cocina Al Aire Rooftop.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png', // Icono para Android
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png', // Icono más grande
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png', // Icono "maskable" para formas adaptables en Android
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})