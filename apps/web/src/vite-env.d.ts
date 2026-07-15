/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional local-only write token (`.env.local`). Must never be set in the
   * Pages CI build — browser admin uses a session PAT instead.
   */
  readonly VITE_GITHUB_TOKEN?: string
  /** owner/repo baked at build time (public). */
  readonly VITE_GITHUB_REPO?: string
  /** Linked package version baked in at Vite build time */
  readonly VITE_PACKAGE_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
