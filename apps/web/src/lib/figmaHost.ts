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
  content: string
}

export type FigmaPluginMessage =
  | { type: 'ready' }
  | { type: 'export-result'; icons: FigmaExportIcon[]; error?: string }

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
