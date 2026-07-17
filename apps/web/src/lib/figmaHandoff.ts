import type { IconColorMode } from './github'

const HASH_ICONS_KEY = 'gv-icons'
const HASH_UPLOAD_KEY = 'gv-upload'
const PENDING_STORAGE_KEY = 'gv-pending-figma-uploads'
const OPEN_UPLOAD_KEY = 'gv-open-upload-panel'

export interface FigmaHandoffIcon {
  name: string
  content: string
  colorMode: IconColorMode
}

interface HandoffPayload {
  v: 1
  icons: FigmaHandoffIcon[]
}

/** Survives React StrictMode remounts within the same page load. */
let pendingMemory: FigmaHandoffIcon[] | null | undefined
let openUploadMemory: boolean | undefined

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const b64 = padded + '='.repeat(padLen)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  await writer.write(bytes as BufferSource)
  await writer.close()
  return new Uint8Array(await new Response(ds.readable).arrayBuffer())
}

function isColorMode(value: unknown): value is IconColorMode {
  return value === 'mono' || value === 'preserved'
}

function parseHandoffPayload(raw: unknown): FigmaHandoffIcon[] | null {
  if (!raw || typeof raw !== 'object') return null
  const envelope = raw as Partial<HandoffPayload>
  if (envelope.v !== 1 || !Array.isArray(envelope.icons)) return null

  const icons: FigmaHandoffIcon[] = []
  for (const item of envelope.icons) {
    if (!item || typeof item !== 'object') continue
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const content = typeof item.content === 'string' ? item.content : ''
    if (!name || !content.includes('<svg')) continue
    icons.push({
      name,
      content,
      colorMode: isColorMode(item.colorMode) ? item.colorMode : 'mono',
    })
  }
  return icons.length > 0 ? icons : null
}

function storePending(icons: FigmaHandoffIcon[]): void {
  pendingMemory = icons
  try {
    sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(icons))
  } catch {
    // ignore quota / private mode
  }
}

function stripHashParams(keys: string[]): void {
  if (typeof window === 'undefined') return
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return
  const params = new URLSearchParams(raw)
  let changed = false
  for (const key of keys) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return
  const next = params.toString()
  const clean =
    window.location.pathname +
    window.location.search +
    (next ? `#${next}` : '')
  window.history.replaceState(null, '', clean)
}

/**
 * Consume `#gv-icons=` (deflate-raw + base64url JSON) and/or `#gv-upload=1`
 * from the URL. Stores pending icons / open-panel flag in sessionStorage.
 */
export async function consumeFigmaHandoffFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return false

  const params = new URLSearchParams(raw)
  const encoded = params.get(HASH_ICONS_KEY)?.trim() ?? ''
  const openUpload = params.get(HASH_UPLOAD_KEY) === '1'
  if (!encoded && !openUpload) return false

  let consumed = false

  if (encoded) {
    try {
      const compressed = base64UrlToBytes(encoded)
      const jsonBytes = await inflateRaw(compressed)
      const parsed = JSON.parse(new TextDecoder().decode(jsonBytes)) as unknown
      const icons = parseHandoffPayload(parsed)
      if (icons) {
        storePending(icons)
        consumed = true
      }
    } catch {
      // malformed payload — still strip hash below
    }
  }

  if (openUpload) {
    openUploadMemory = true
    try {
      sessionStorage.setItem(OPEN_UPLOAD_KEY, '1')
    } catch {
      // ignore
    }
    consumed = true
  }

  stripHashParams([HASH_ICONS_KEY, HASH_UPLOAD_KEY])
  return consumed
}

/** Pending icons from the Figma plugin (idempotent within a page load). */
export function takePendingFigmaUploads(): FigmaHandoffIcon[] | null {
  if (pendingMemory !== undefined) return pendingMemory

  try {
    const raw = sessionStorage.getItem(PENDING_STORAGE_KEY)
    if (!raw) {
      pendingMemory = null
      return null
    }
    sessionStorage.removeItem(PENDING_STORAGE_KEY)
    pendingMemory = parseHandoffPayload({
      v: 1,
      icons: JSON.parse(raw) as unknown,
    })
    return pendingMemory
  } catch {
    pendingMemory = null
    return null
  }
}

/** Whether the plugin asked to open the upload panel (e.g. JSON fallback). */
export function takeOpenUploadPanelFlag(): boolean {
  if (openUploadMemory !== undefined) return openUploadMemory

  try {
    const value = sessionStorage.getItem(OPEN_UPLOAD_KEY)
    if (value !== '1') {
      openUploadMemory = false
      return false
    }
    sessionStorage.removeItem(OPEN_UPLOAD_KEY)
    openUploadMemory = true
    return true
  } catch {
    openUploadMemory = false
    return false
  }
}

/** Parse a downloaded `gv-icons-handoff.json` (or equivalent). */
export function parseFigmaHandoffFile(text: string): FigmaHandoffIcon[] | null {
  try {
    return parseHandoffPayload(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}
