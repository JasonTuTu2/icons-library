import { buildAuthSessionHandoffHash, isAuthApiConfigured } from './sessionAuth.js'
import {
  createServerStagingHandoff,
  type StagingHandoffPayload,
} from './stagingHandoff.js'
import type { IconUploadPayload } from './github.js'

const PLUGIN_RPC_TIMEOUT_MS = 45_000

const FIGMA_PARAM = 'gv-figma'
/** Must match apps/figma-plugin/manifest.json `id` (required for external UI). */
const FIGMA_PLUGIN_ID = 'genvoice-icons-library'

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
      payload?: unknown
      error?: string
    }
  | { type: 'open-browser-done'; url: string; note?: string }

function postToPlugin(pluginMessage: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return
  parent.postMessage(
    { pluginMessage, pluginId: FIGMA_PLUGIN_ID },
    'https://www.figma.com',
  )
}

function waitForPluginMessage(
  predicate: (msg: FigmaPluginMessage) => boolean,
  timeoutMs = PLUGIN_RPC_TIMEOUT_MS,
): Promise<FigmaPluginMessage> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsub()
      reject(new Error('Plugin did not respond — reload the plugin and try again.'))
    }, timeoutMs)
    const unsub = subscribeFigmaPluginMessages((msg) => {
      if (!predicate(msg)) return
      window.clearTimeout(timer)
      unsub()
      resolve(msg)
    })
  })
}

function parsePluginStagingPayload(raw: unknown): StagingHandoffPayload {
  if (!raw || typeof raw !== 'object') {
    return { v: 1, icons: [], removals: [] }
  }
  const row = raw as { v?: number; icons?: unknown; removals?: unknown }
  if (row.v !== 1) return { v: 1, icons: [], removals: [] }
  const icons: IconUploadPayload[] = []
  if (Array.isArray(row.icons)) {
    for (const item of row.icons) {
      if (!item || typeof item !== 'object') continue
      const icon = item as Record<string, unknown>
      const name = typeof icon.name === 'string' ? icon.name.trim() : ''
      const content = typeof icon.content === 'string' ? icon.content : ''
      if (!name || !content) continue
      const kind = icon.kind === 'image' ? 'image' : 'svg'
      if (kind === 'image') {
        icons.push({
          name,
          content,
          kind: 'image',
          format:
            icon.format === 'jpg' || icon.format === 'jpeg'
              ? 'jpg'
              : icon.format === 'png'
                ? 'png'
                : 'png',
          category: typeof icon.category === 'string' ? icon.category : undefined,
          variant: typeof icon.variant === 'string' ? icon.variant : undefined,
          source: typeof icon.source === 'string' ? icon.source : undefined,
          usage: typeof icon.usage === 'string' ? icon.usage : undefined,
          note: typeof icon.note === 'string' ? icon.note : undefined,
          replaceLibrary: icon.replaceLibrary === true,
        } as IconUploadPayload)
      } else {
        icons.push({
          name,
          content,
          kind: 'svg',
          colorMode:
            icon.colorMode === 'preserved' || icon.colorMode === 'gradient'
              ? icon.colorMode
              : 'mono',
          category: typeof icon.category === 'string' ? icon.category : undefined,
          variant: typeof icon.variant === 'string' ? icon.variant : undefined,
          source: typeof icon.source === 'string' ? icon.source : undefined,
          usage: typeof icon.usage === 'string' ? icon.usage : undefined,
          note: typeof icon.note === 'string' ? icon.note : undefined,
          replaceLibrary: icon.replaceLibrary === true,
        } as IconUploadPayload)
      }
    }
  }
  const removals = Array.isArray(row.removals)
    ? row.removals.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0,
      )
    : []
  return { v: 1, icons, removals }
}

/** Persist staged icons in the plugin (figma.clientStorage), not iframe web storage. */
export async function stageIconsInPlugin(
  icons: IconUploadPayload[],
  removals?: string[],
): Promise<void> {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new Error('Open the Figma plugin to stage.')
  }
  postToPlugin({ type: 'stage-icons', icons, removals })
  const msg = await waitForPluginMessage((m) => m.type === 'staging-result')
  if (msg.type !== 'staging-result' || !msg.ok) {
    throw new Error(
      msg.type === 'staging-result' && msg.error
        ? msg.error
        : 'Staging failed in the plugin.',
    )
  }
}

/** Read the plugin staging queue from figma.clientStorage via the main thread. */
export async function loadPluginStagingHandoff(): Promise<StagingHandoffPayload> {
  if (typeof window === 'undefined' || window.parent === window) {
    return { v: 1, icons: [], removals: [] }
  }
  postToPlugin({ type: 'load-staging' })
  const msg = await waitForPluginMessage((m) => m.type === 'staging-result')
  if (msg.type !== 'staging-result' || !msg.ok) {
    throw new Error(
      msg.type === 'staging-result' && msg.error
        ? msg.error
        : 'Could not read staging from the plugin.',
    )
  }
  return parsePluginStagingPayload(msg.payload)
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

/**
 * Open the full icon browser. Staging lives in figma.clientStorage; non-empty
 * queues upload via auth API handoff (`gv-staging-id`) into the site tab.
 */
export async function openIconBrowserWithStaging(): Promise<void> {
  const base = fullIconBrowserUrl().replace(/\/?$/, '/')
  const sep = base.includes('?') ? '&' : '?'
  const payload = await loadPluginStagingHandoff()
  let url = `${base}${sep}gv-upload=1`

  if (payload.icons.length > 0 || payload.removals.length > 0) {
    if (!isAuthApiConfigured()) {
      throw new Error('Sign in to hand off staging to the icon browser.')
    }
    const id = await createServerStagingHandoff(payload)
    const authHash = buildAuthSessionHandoffHash()
    const stagingHash = `gv-staging-id=${encodeURIComponent(id)}`
    const hash = authHash ? `${authHash}&${stagingHash}` : stagingHash
    url = `${base}${sep}gv-upload=1#${hash}`
  } else {
    const authHash = buildAuthSessionHandoffHash()
    if (authHash) {
      url = `${base}${sep}gv-upload=1#${authHash}`
    }
  }

  openExternalUrl(url)
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
