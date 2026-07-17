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
  | { type: 'close' }

/** Manifest `id` — required when the UI is a non-null origin (Pages). */
export const FIGMA_PLUGIN_ID = 'genvoice-icons-library'
