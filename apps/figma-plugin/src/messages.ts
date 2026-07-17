export type PluginToUiMessage =
  | { type: 'ready' }
  | {
      type: 'export-result'
      icons: Array<{ id: string; name: string; content: string }>
      error?: string
    }

export type UiToPluginMessage =
  | { type: 'ui-ready' }
  | { type: 'export-selection' }
  | { type: 'open-url'; url: string }
  | { type: 'close' }

declare const __ICON_BROWSER_URL__: string

export const ICON_BROWSER_URL: string = __ICON_BROWSER_URL__
