import {
  buildStagingHandoffPayload,
  downloadStagingHandoffJson,
  encodeStagingHandoffParam,
  STAGING_HANDOFF_URL_MAX,
  type StagingHandoffPayload,
} from './stagingHandoff.js'
import type { IconUploadPayload } from './github.js'

const FIGMA_PARAM = 'gv-figma'
/** Must match apps/figma-plugin/manifest.json `id` (required for external UI). */
const FIGMA_PLUGIN_ID = 'genvoice-icons-library'

let figmaHostMemory: boolean | undefined
let cachedPluginStaging: StagingHandoffPayload | null = null

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
  | {
      type: 'open-browser-done'
      url: string
      note?: string
      downloadPayload?: StagingHandoffPayload
    }

function postToPlugin(pluginMessage: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    { pluginMessage, pluginId: FIGMA_PLUGIN_ID },
    'https://www.figma.com',
  )
}

function pluginPayloadFromHandoff(
  payload: StagingHandoffPayload,
): Array<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(payload.icons)) as Array<
    Record<string, unknown>
  >
}

function handoffFromPluginPayload(raw: StagingHandoffPayload): StagingHandoffPayload {
  return {
    v: 1,
    icons: raw.icons as IconUploadPayload[],
    removals: raw.removals,
  }
}

function awaitPluginMessage<T extends FigmaPluginMessage['type']>(
  type: T,
  timeoutMs = 15000,
): Promise<Extract<FigmaPluginMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(
        new Error(
          type === 'staging-result'
            ? 'Timed out waiting for Figma plugin staging. Re-import the GenVoice Icons plugin (Development) from apps/figma-plugin/dist.'
            : 'Timed out waiting for the Figma plugin.',
        ),
      )
    }, timeoutMs)

    function onMessage(event: MessageEvent): void {
      const msg = event.data?.pluginMessage as FigmaPluginMessage | undefined
      if (!msg || msg.type !== type) return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      resolve(msg as Extract<FigmaPluginMessage, { type: T }>)
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
  const wait = awaitPluginMessage('staging-result')
  postToPlugin({
    type: 'stage-icons',
    icons: pluginPayloadFromHandoff({ v: 1, icons, removals }),
    removals,
  })
  const msg = await wait
  if (!msg.ok) {
    throw new Error(msg.error || 'Plugin staging failed.')
  }
  const payload = handoffFromPluginPayload(
    msg.payload ?? { v: 1, icons: [], removals: [] },
  )
  cachedPluginStaging = payload
  return payload
}

/** Load the plugin clientStorage staging queue. */
export async function loadPluginStaging(): Promise<StagingHandoffPayload> {
  if (!isFigmaHost()) {
    return { v: 1, icons: [], removals: [] }
  }
  if (cachedPluginStaging) {
    return cachedPluginStaging
  }
  const wait = awaitPluginMessage('staging-result')
  postToPlugin({ type: 'load-staging' })
  const msg = await wait
  if (!msg.ok) {
    throw new Error(msg.error || 'Plugin staging failed.')
  }
  const payload = handoffFromPluginPayload(
    msg.payload ?? { v: 1, icons: [], removals: [] },
  )
  cachedPluginStaging = payload
  return payload
}

/**
 * Open the full icon browser with the plugin staging queue.
 * Uses a URL handoff when small enough; otherwise downloads JSON and opens Upload.
 * Always returns the URL that was opened so the plugin UI can display it.
 */
export async function openIconBrowserWithStaging(): Promise<{
  url: string
  note?: string
}> {
  if (isFigmaHost()) {
    const wait = awaitPluginMessage('open-browser-done')
    postToPlugin({
      type: 'open-icon-browser',
      baseUrl: fullIconBrowserUrl(),
    })
    const msg = await wait
    if (msg.downloadPayload) {
      downloadStagingHandoffJson(handoffFromPluginPayload(msg.downloadPayload))
    }
    return { url: msg.url, note: msg.note }
  }

  const payload = await buildStagingHandoffPayload()
  const base = fullIconBrowserUrl()

  if (payload.icons.length === 0 && payload.removals.length === 0) {
    openExternalUrl(base)
    return { url: base }
  }

  const encoded = encodeStagingHandoffParam(payload)

  if (encoded.length <= STAGING_HANDOFF_URL_MAX) {
    const url = `${base}${base.includes('?') ? '&' : '?'}gv-staging=${encodeURIComponent(encoded)}&gv-upload=1`
    openExternalUrl(url)
    return { url }
  }

  const url = `${base}${base.includes('?') ? '&' : '?'}gv-upload=1`
  downloadStagingHandoffJson(payload)
  openExternalUrl(url)
  return {
    url,
    note: 'Queue is too large for a link — downloaded gv-staging-handoff.json. Drop that file into Upload to import your staged icons.',
  }
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
