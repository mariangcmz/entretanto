import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    preact(),
    // PWA: se instala en el celular y abre sin señal (los datos ya vienen de la caché de Firestore).
    // autoUpdate: cada versión nueva se instala sola al abrir, para que la app nunca se quede vieja.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icono.svg'],
      manifest: {
        name: 'Entretanto',
        short_name: 'Entretanto',
        description: 'Cuánto te queda de verdad, hasta que vuelvas a cobrar.',
        lang: 'es-MX',
        start_url: '/',
        display: 'standalone',
        background_color: '#E4E0C6',
        theme_color: '#E4E0C6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // /__/auth es el login de Firebase Hosting: tiene que llegar al servidor, nunca a la app en caché.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
          handler: 'CacheFirst',
          options: { cacheName: 'fuentes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
})
