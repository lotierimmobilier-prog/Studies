import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front KITETUDIANT, indépendant du simulateur historique servi par
// vite.config.ts. Même dépôt, même node_modules, deux applications.
export default defineConfig({
  root: 'kitetudiant/web',
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { outDir: '../../dist-kitetudiant', emptyOutDir: true },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
