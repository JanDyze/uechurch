import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['uec-logo.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'UEC Canubing II',
        short_name: 'UEC Church',
        description: 'United Evangelical Church Canubing II — church management app',
        theme_color: '#01779b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // FCM registers its own service worker — keep it out of the precache
        // The event PNGs exist for digest email and the notification tray,
        // never for the app itself, which draws Phosphor SVG components.
        // Precaching 44 images nothing in the app requests is pure payload.
        globIgnores: ['**/firebase-messaging-sw.js', 'icons/events/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    // Bind to all interfaces so `npm run dev` is reachable from phones on the
    // same Wi-Fi without needing the --host flag every time
    host: true,
    allowedHosts: [
      '84960e178ae6.ngrok-free.app',
      '.ngrok-free.app', // This allows all ngrok subdomains
      '.ngrok.io', // Also allow ngrok.io domains
      'localhost'
    ],
    proxy: {
      '/api/ai': {
        target: 'https://api-inference.huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add any headers if needed
          })
        }
      }
    }
  }
})
