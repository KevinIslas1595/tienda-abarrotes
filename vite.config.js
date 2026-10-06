import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Modos:
//   npm run dev            -> prueba en la PC con la base de datos real
//   npm run dev:emulador   -> prueba en la PC con el emulador de Firebase (datos de mentira)
//   npm run build          -> página web para GitHub Pages (/tienda-abarrotes/)
//   npm run build:app      -> archivos para la app de Android (Capacitor)
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/tienda-abarrotes/' : '/',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Firebase va en su propio archivo: casi nunca cambia, así que el
        // teléfono lo conserva y solo baja lo nuevo de la app al actualizar.
        manualChunks: (id) => (id.includes('node_modules/@firebase/') || id.includes('node_modules/firebase/') ? 'firebase' : undefined),
      },
    },
    // Firebase (Auth + Firestore con modo sin internet) pesa ~550 KB por sí solo.
    chunkSizeWarningLimit: 650,
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Mi Tienda · Inventario y cobros',
        short_name: 'Mi Tienda',
        description: 'Inventario, cobros con escáner de código de barras y corte de caja para tienda de abarrotes.',
        lang: 'es-MX',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f5f4',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El lector ZXing (.wasm, ~1 MB) no se baja de entrada: Android ya trae
        // su propio lector. Solo se descarga (y se guarda) la primera vez que se usa.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'lector-codigos', expiration: { maxEntries: 2 } },
          },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
}));
