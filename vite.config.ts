import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En développement, /api est relayé vers le serveur de prix (server/index.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.PRIX_API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
