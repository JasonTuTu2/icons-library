/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Write token for browser → GitHub API (stage / dispatch).
   * Pages CI injects `ICON_BROWSER_TOKEN`; local optional via `.env.local`.
   */
  readonly VITE_GITHUB_TOKEN?: string
  /** owner/repo baked at build time (public). */
  readonly VITE_GITHUB_REPO?: string
  /** Auth API base URL (Cloudflare Worker). When set, login replaces Apply/Publish PATs. */
  readonly VITE_AUTH_API_URL?: string
  /** Linked package version baked in at Vite build time */
  readonly VITE_PACKAGE_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
