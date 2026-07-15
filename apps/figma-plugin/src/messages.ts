export type PluginToUiMessage =
  | { type: 'ready'; token: string }
  | { type: 'token'; token: string }
  | {
      type: 'export-result'
      icons: Array<{ id: string; name: string; content: string }>
      error?: string
    }

export type UiToPluginMessage =
  | { type: 'ui-ready' }
  | { type: 'export-selection' }
  | { type: 'set-token'; token: string }
  | { type: 'clear-token' }
  | { type: 'close' }

declare const __GITHUB_REPO__: string

export const GITHUB_REPO: string = __GITHUB_REPO__
export const TOKEN_STORAGE_KEY = 'gv-icons-github-token'
