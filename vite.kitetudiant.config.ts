import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front KITETUDIANT, indépendant du simulateur historique servi par
// vite.config.ts. Même dépôt, même node_modules, deux applications.
export default defineConfig({
  root: 'kitetudiant/web',
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: '../../dist-kitetudiant',
    emptyOutDir: true,
    // La console d'administration est une entrée séparée : son code ne part
    // pas dans le paquet servi aux élèves, et nginx peut la protéger à part.
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'kitetudiant/web/index.html'),
        admin: resolve(import.meta.dirname, 'kitetudiant/web/admin.html'),
      },
    },
  },
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
