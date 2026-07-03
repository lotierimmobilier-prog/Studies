/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base du service de prix (vide = même origine via proxy). */
  readonly VITE_PRIX_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
