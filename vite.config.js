import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Serves the api/ handlers the app cannot do without during `npm run dev`.
 *
 * In production everything in api/ is a Vercel function; locally there is only
 * Vite, so without this the public page at "/" would have nothing to load and
 * would fall back to the built-in defaults — precisely the thing it exists to
 * stop doing — and the song list could not search YouTube at all.
 *
 * Handlers are imported by file URL rather than through Vite: they are server
 * code that pulls in firebase-admin, and have no business going through the
 * browser pipeline. Restart the dev server after editing one.
 *
 * Deliberately absent: /api/notify and /api/email, which send real push and
 * real mail. Those stay Vercel-only so a local dev session cannot ring every
 * phone in the church.
 */
const DEV_API_ROUTES = {
  '/api/public': './api/public.js',
  '/api/youtube-search': './api/youtube-search.js',
  // Both bill Anthropic per call — a lookup runs a web search on top of the
  // tokens — so they cost real money here in a way the two above do not. They
  // are still local-friendly: neither writes anything or reaches the
  // congregation, which is what keeps /api/notify and /api/email out.
  '/api/song-lookup': './api/song-lookup.js',
  '/api/lyrics-structure': './api/lyrics-structure.js',
  '/api/enhance': './api/enhance.js',
}

/** Vercel's runtime hands the handler a parsed body; connect does not. */
const readJsonBody = (req) =>
  new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })

const apiDevServer = (env) => ({
  name: 'uec-api-dev',
  apply: 'serve',
  configureServer(server) {
    for (const [route, modulePath] of Object.entries(DEV_API_ROUTES)) {
      server.middlewares.use(route, async (req, res, next) => {
        // .env.local holds the service account and the API keys, but only
        // VITE_-prefixed names reach import.meta.env — the handlers read
        // process.env, the way they do on Vercel.
        for (const [key, value] of Object.entries(env)) {
          if (!(key in process.env)) process.env[key] = value
        }

        try {
          const url = new URL(req.originalUrl || req.url, 'http://localhost')
          req.query = Object.fromEntries(url.searchParams)
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.body = await readJsonBody(req)
          }
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (body) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }

          const handlerPath = fileURLToPath(new URL(modulePath, import.meta.url))
          const { default: handler } = await import(pathToFileURL(handlerPath).href)
          await handler(req, res)
        } catch (error) {
          next(error)
        }
      })
    }
  },
})

/**
 * package.json is the one place the app's version is written down; the app
 * reads it from here as __APP_VERSION__ so a phone running an old cached
 * build can say which one it is. Bump it in package.json, nowhere else.
 */
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    // '' as the prefix: every variable in .env.local, not just the VITE_ ones
    apiDevServer(loadEnv(mode, process.cwd(), '')),
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
    ]
  }
}))
