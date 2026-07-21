export type FigmaExportKind = 'svg' | 'image'
export type FigmaImageFormat = 'png' | 'jpg'
/** Designer-facing export format (dropdown in the plugin panel). */
export type FigmaAssetFormat = 'svg' | 'png' | 'jpg'

export type FigmaExportIcon = {
  id: string
  name: string
  /** SVG text, or base64 (no data: URL prefix) for images. */
  content: string
  kind: FigmaExportKind
  /** Present when kind is image. */
  format?: FigmaImageFormat
}

/** Staging queue persisted in figma.clientStorage (plugin main thread). */
export type PluginStagingPayload = {
  v: 1
  icons: Array<Record<string, unknown>>
  removals: string[]
}

export type UiToPluginMessage =
  | { type: 'ui-ready' }
  | { type: 'export-selection' }
  | {
      type: 'reexport-node'
      nodeId: string
      format: FigmaAssetFormat
    }
  | {
      type: 'reexport-nodes'
      exports: Array<{ nodeId: string; format: FigmaAssetFormat }>
    }
  | { type: 'open-url'; url: string }
  | {
      type: 'stage-icons'
      icons: Array<Record<string, unknown>>
      removals?: string[]
    }
  | { type: 'load-staging' }
  | { type: 'clear-staging' }
  | { type: 'open-icon-browser'; baseUrl: string }
  | { type: 'close' }

export type PluginToUiMessage =
  | { type: 'ready' }
  | {
      type: 'export-result'
      icons: FigmaExportIcon[]
      error?: string
    }
  | {
      type: 'reexport-result'
      icon?: FigmaExportIcon
      error?: string
    }
  | {
      type: 'reexport-batch-result'
      icons: FigmaExportIcon[]
      error?: string
    }
  | {
      type: 'staging-result'
      ok: boolean
      payload?: PluginStagingPayload
      error?: string
    }
  | {
      type: 'open-browser-done'
      url: string
      note?: string
      /** When the queue is too large for a URL, UI should download this JSON. */
      downloadPayload?: PluginStagingPayload
    }

/** Manifest `id` — required when the UI is a non-null origin (Pages). */
export const FIGMA_PLUGIN_ID = 'genvoice-icons-library'
