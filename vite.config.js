import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
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
