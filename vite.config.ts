import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` : '/' en local, chemins relatifs ('./') pour un hébergement sous
// sous-dossier — injecté via VITE_BASE par le script de déploiement.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    proxy: {
      // En développement, redirige les appels API vers le serveur Node local.
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
