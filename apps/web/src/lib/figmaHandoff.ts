import type { IconColorMode } from './github'
import { detectSvgColorMode } from './detectSvgColorMode'

const HANDOFF_PARAM = 'gv-icons'
const UPLOAD_PARAM = 'gv-upload'
const PENDING_STORAGE_KEY = 'gv-pending-figma-uploads'
const OPEN_UPLOAD_KEY = 'gv-open-upload-panel'
const SYNC_REMOTE_STAGING_KEY = 'gv-sync-remote-staging'
const ERROR_STORAGE_KEY = 'gv-figma-handoff-error'

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
let errorMemory: string | null | undefined

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

function isColorMode(value: unknown): value is IconColorMode {
  return value === 'mono' || value === 'preserved' || value === 'gradient'
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
    if (!name || !/<svg\b/i.test(content)) continue
    icons.push({
      name,
      content,
      colorMode: isColorMode(item.colorMode)
        ? item.colorMode
        : detectSvgColorMode(content),
    })
  }
  return icons.length > 0 ? icons : null
}

function decodeHandoffParam(encoded: string): FigmaHandoffIcon[] | null {
  const trimmed = encoded.trim()
  if (!trimmed) return null

  // `r.` = raw base64url JSON (current). Bare value = legacy deflate attempt skipped.
  const rawB64 = trimmed.startsWith('r.') ? trimmed.slice(2) : trimmed
  if (trimmed.startsWith('r.') || !trimmed.startsWith('d.')) {
    try {
      const bytes = base64UrlToBytes(rawB64)
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
      return parseHandoffPayload(parsed)
    } catch {
      return null
    }
  }
  return null
}

export function storePendingFigmaUploads(icons: FigmaHandoffIcon[]): void {
  pendingMemory = icons
  try {
    sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(icons))
  } catch {
    // ignore quota / private mode
  }
}

export function storeOpenUploadPanel(): void {
  openUploadMemory = true
  try {
    sessionStorage.setItem(OPEN_UPLOAD_KEY, '1')
  } catch {
    // ignore
  }
}

function storeError(message: string): void {
  errorMemory = message
  try {
    sessionStorage.setItem(ERROR_STORAGE_KEY, message)
  } catch {
    // ignore
  }
}

function readSearchAndHashParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash.replace(/^#/, '')
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    for (const [key, value] of hashParams) {
      if (!params.has(key)) params.set(key, value)
    }
  }
  return params
}

function stripHandoffParams(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  for (const key of [HANDOFF_PARAM, UPLOAD_PARAM]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  const hashRaw = url.hash.replace(/^#/, '')
  if (hashRaw) {
    const hashParams = new URLSearchParams(hashRaw)
    for (const key of [HANDOFF_PARAM, UPLOAD_PARAM]) {
      if (hashParams.has(key)) {
        hashParams.delete(key)
        changed = true
      }
    }
    const nextHash = hashParams.toString()
    url.hash = nextHash ? `#${nextHash}` : ''
  }
  if (changed) {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
}

/**
 * Consume `?gv-icons=` / `#gv-icons=` and `gv-upload=1` from the URL.
 * Stores pending icons / open-panel flag in sessionStorage.
 */
export function consumeFigmaHandoffFromUrl(): boolean {
  if (typeof window === 'undefined') return false

  const params = readSearchAndHashParams()
  const encoded = params.get(HANDOFF_PARAM)?.trim() ?? ''
  const openUpload = params.get(UPLOAD_PARAM) === '1'
  if (!encoded && !openUpload) return false

  let consumed = false

  if (encoded) {
    const icons = decodeHandoffParam(encoded)
    if (icons) {
      storePendingFigmaUploads(icons)
      storeOpenUploadPanel()
      consumed = true
    } else {
      storeError(
        'Could not read icons from the Figma handoff link. Drop gv-icons-handoff.json into Upload SVG, or use Load selection in the plugin.',
      )
      storeOpenUploadPanel()
      consumed = true
    }
  } else if (openUpload) {
    storeOpenUploadPanel()
    try {
      sessionStorage.setItem(SYNC_REMOTE_STAGING_KEY, '1')
    } catch {
      // ignore
    }
    consumed = true
  }

  stripHandoffParams()
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
    const parsed = JSON.parse(raw) as unknown
    pendingMemory = Array.isArray(parsed)
      ? parseHandoffPayload({ v: 1, icons: parsed })
      : parseHandoffPayload(parsed)
    return pendingMemory
  } catch {
    pendingMemory = null
    return null
  }
}

/** Whether the plugin asked to open the upload panel. */
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

/** Plugin opened Upload after staging to GitHub — pull remote queue into IndexedDB. */
export function takeSyncRemoteStagingFlag(): boolean {
  try {
    const value = sessionStorage.getItem(SYNC_REMOTE_STAGING_KEY)
    if (value !== '1') return false
    sessionStorage.removeItem(SYNC_REMOTE_STAGING_KEY)
    return true
  } catch {
    return false
  }
}

export function takeFigmaHandoffError(): string | null {
  if (errorMemory !== undefined) {
    const value = errorMemory
    errorMemory = null
    try {
      sessionStorage.removeItem(ERROR_STORAGE_KEY)
    } catch {
      // ignore
    }
    return value
  }
  try {
    const value = sessionStorage.getItem(ERROR_STORAGE_KEY)
    if (!value) {
      errorMemory = null
      return null
    }
    sessionStorage.removeItem(ERROR_STORAGE_KEY)
    errorMemory = null
    return value
  } catch {
    errorMemory = null
    return null
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
