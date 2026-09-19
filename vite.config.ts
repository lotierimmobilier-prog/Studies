import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` : '/' en local, chemins relatifs ('./') pour GitHub Pages (sous-dossier
// du dépôt) — injecté via VITE_BASE par le workflow de déploiement.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
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
