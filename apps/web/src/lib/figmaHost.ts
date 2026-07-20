const FIGMA_PARAM = 'gv-figma'
/** Allow any plugin id so Development imports receive messages from Pages. */
const FIGMA_PLUGIN_ID = '*'

let figmaHostMemory: boolean | undefined

function stripFigmaParam(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  if (url.searchParams.has(FIGMA_PARAM)) {
    url.searchParams.delete(FIGMA_PARAM)
    changed = true
  }
  const hashRaw = url.hash.replace(/^#/, '')
  if (hashRaw) {
    const hashParams = new URLSearchParams(hashRaw)
    if (hashParams.has(FIGMA_PARAM)) {
      hashParams.delete(FIGMA_PARAM)
      changed = true
      const next = hashParams.toString()
      url.hash = next ? `#${next}` : ''
    }
  }
  if (changed) {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
}

/**
 * Detect Figma plugin host (`?gv-figma=1` and/or embedded iframe).
 * Call once at startup; strips the query flag from the URL.
 */
export function consumeFigmaHostFlag(): boolean {
  if (typeof window === 'undefined') return false
  if (figmaHostMemory !== undefined) return figmaHostMemory

  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash.replace(/^#/, '')
  const hashParams = hash ? new URLSearchParams(hash) : null
  const fromQuery =
    params.get(FIGMA_PARAM) === '1' || hashParams?.get(FIGMA_PARAM) === '1'
  const embedded = window.parent !== window

  figmaHostMemory = fromQuery || embedded
  if (fromQuery) stripFigmaParam()
  return figmaHostMemory
}

export function isFigmaHost(): boolean {
  if (figmaHostMemory !== undefined) return figmaHostMemory
  return consumeFigmaHostFlag()
}

export type FigmaExportIcon = {
  id: string
  name: string
  /** SVG text, or base64 (no data: URL prefix) for images. */
  content: string
  /** Defaults to svg for older plugin builds. */
  kind?: 'svg' | 'image'
  format?: 'png' | 'jpg' | 'jpeg'
}

export type FigmaAssetFormat = 'svg' | 'png' | 'jpg'

export type FigmaPluginMessage =
  | { type: 'ready' }
  | { type: 'export-result'; icons: FigmaExportIcon[]; error?: string }
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

/** Ask the Figma main thread to export the current selection. */
export function requestFigmaExport(): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    {
      pluginMessage: { type: 'export-selection' },
      pluginId: FIGMA_PLUGIN_ID,
    },
    'https://www.figma.com',
  )
}

/** Re-export one node as SVG, PNG, or JPG (format override). */
export function requestFigmaReexport(
  nodeId: string,
  format: FigmaAssetFormat,
): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    {
      pluginMessage: { type: 'reexport-node', nodeId, format },
      pluginId: FIGMA_PLUGIN_ID,
    },
    'https://www.figma.com',
  )
}

/** Re-export many nodes (Apply-all format). */
export function requestFigmaReexportBatch(
  exports: Array<{ nodeId: string; format: FigmaAssetFormat }>,
): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    {
      pluginMessage: { type: 'reexport-nodes', exports },
      pluginId: FIGMA_PLUGIN_ID,
    },
    'https://www.figma.com',
  )
}

/** Tell the main thread the Pages UI is ready. */
export function notifyFigmaUiReady(): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    {
      pluginMessage: { type: 'ui-ready' },
      pluginId: FIGMA_PLUGIN_ID,
    },
    'https://www.figma.com',
  )
}

/** Open a URL in the system browser (via Figma when embedded). */
export function openExternalUrl(url: string): void {
  if (typeof window === 'undefined') return
  if (window.parent === window) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  parent.postMessage(
    {
      pluginMessage: { type: 'open-url', url },
      pluginId: FIGMA_PLUGIN_ID,
    },
    'https://www.figma.com',
  )
}

/** Full icon browser URL (main Pages app, not figma.html). */
export function fullIconBrowserUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${window.location.origin}${base}`
}

export function subscribeFigmaPluginMessages(
  listener: (msg: FigmaPluginMessage) => void,
): () => void {
  function onMessage(event: MessageEvent): void {
    const msg = event.data?.pluginMessage as FigmaPluginMessage | undefined
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return
    listener(msg)
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
