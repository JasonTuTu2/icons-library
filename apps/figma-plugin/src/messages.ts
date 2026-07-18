export type FigmaExportKind = 'svg' | 'image'
export type FigmaImageFormat = 'png' | 'jpg'

export type FigmaExportIcon = {
  id: string
  name: string
  /** SVG text, or base64 (no data: URL prefix) for images. */
  content: string
  kind: FigmaExportKind
  /** Present when kind is image. */
  format?: FigmaImageFormat
}

export type PluginToUiMessage =
  | { type: 'ready' }
  | {
      type: 'export-result'
      icons: FigmaExportIcon[]
      error?: string
    }

export type UiToPluginMessage =
  | { type: 'ui-ready' }
  | { type: 'export-selection' }
  | { type: 'open-url'; url: string }
  | { type: 'close' }

/** Manifest `id` — required when the UI is a non-null origin (Pages). */
export const FIGMA_PLUGIN_ID = 'genvoice-icons-library'
