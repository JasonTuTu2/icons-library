import {
  buildStagingHandoffPayload,
  downloadStagingHandoffJson,
  encodeStagingHandoffParam,
  STAGING_HANDOFF_URL_MAX,
  type StagingHandoffPayload,
} from './stagingHandoff.js'
import type { IconUploadPayload } from './github.js'

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
  | {
      type: 'staging-result'
      ok: boolean
      payload?: StagingHandoffPayload
      error?: string
    }

function postToPlugin(pluginMessage: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    { pluginMessage, pluginId: FIGMA_PLUGIN_ID },
    'https://www.figma.com',
  )
}

function awaitStagingResult(
  timeoutMs = 8000,
): Promise<StagingHandoffPayload> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('Timed out waiting for Figma plugin staging.'))
    }, timeoutMs)

    function onMessage(event: MessageEvent): void {
      const msg = event.data?.pluginMessage as FigmaPluginMessage | undefined
      if (!msg || msg.type !== 'staging-result') return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (!msg.ok) {
        reject(new Error(msg.error || 'Plugin staging failed.'))
        return
      }
      resolve(msg.payload ?? { v: 1, icons: [], removals: [] })
    }

    window.addEventListener('message', onMessage)
  })
}

/** Ask the Figma main thread to export the current selection. */
export function requestFigmaExport(): void {
  postToPlugin({ type: 'export-selection' })
}

/** Re-export one node as SVG, PNG, or JPG (format override). */
export function requestFigmaReexport(
  nodeId: string,
  format: FigmaAssetFormat,
): void {
  postToPlugin({ type: 'reexport-node', nodeId, format })
}

/** Re-export many nodes (Apply-all format). */
export function requestFigmaReexportBatch(
  exports: Array<{ nodeId: string; format: FigmaAssetFormat }>,
): void {
  postToPlugin({ type: 'reexport-nodes', exports })
}

/** Tell the main thread the Pages UI is ready. */
export function notifyFigmaUiReady(): void {
  postToPlugin({ type: 'ui-ready' })
}

/** Open a URL in the system browser (via Figma when embedded). */
export function openExternalUrl(url: string): void {
  if (typeof window === 'undefined') return
  if (window.parent === window) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  postToPlugin({ type: 'open-url', url })
}

/** Stage icons into figma.clientStorage (plugin main thread). */
export async function stageIconsInPlugin(
  icons: IconUploadPayload[],
  removals: string[] = [],
): Promise<StagingHandoffPayload> {
  if (!isFigmaHost()) {
    throw new Error('Not running inside the Figma plugin.')
  }
  const wait = awaitStagingResult()
  postToPlugin({ type: 'stage-icons', icons, removals })
  return wait
}

/** Load the plugin clientStorage staging queue. */
export async function loadPluginStaging(): Promise<StagingHandoffPayload> {
  if (!isFigmaHost()) {
    return { v: 1, icons: [], removals: [] }
  }
  const wait = awaitStagingResult()
  postToPlugin({ type: 'load-staging' })
  return wait
}

/**
 * Open the full icon browser with the plugin staging queue.
 * Uses a URL handoff when small enough; otherwise downloads JSON and opens Upload.
 */
export async function openIconBrowserWithStaging(): Promise<string | null> {
  const payload = isFigmaHost()
    ? await loadPluginStaging()
    : await buildStagingHandoffPayload()

  if (payload.icons.length === 0 && payload.removals.length === 0) {
    openExternalUrl(fullIconBrowserUrl())
    return null
  }

  const encoded = encodeStagingHandoffParam(payload)
  const base = fullIconBrowserUrl()

  if (encoded.length <= STAGING_HANDOFF_URL_MAX) {
    const url = `${base}${base.includes('?') ? '&' : '?'}gv-staging=${encodeURIComponent(encoded)}&gv-upload=1`
    openExternalUrl(url)
    return null
  }

  downloadStagingHandoffJson(payload)
  openExternalUrl(
    `${base}${base.includes('?') ? '&' : '?'}gv-upload=1`,
  )
  return `Queue is too large for a link — downloaded gv-staging-handoff.json. Drop that file into Upload to import your staged icons.`
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
