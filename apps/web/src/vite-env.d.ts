/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_TOKEN?: string
  readonly VITE_GITHUB_REPO?: string
  /** Linked package version baked in at Vite build time */
  readonly VITE_PACKAGE_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
