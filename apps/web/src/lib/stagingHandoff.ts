import type { IconUploadPayload } from './github'
import {
  stageIconsLocal,
  stageRemovalsLocal,
  exportIconUploadPayloads,
  exportRemovalNames,
} from './localStagingStore'
import { storeOpenUploadPanel } from './figmaHandoff'

const STAGING_PARAM = 'gv-staging'
const PENDING_STAGING_KEY = 'gv-pending-staging-handoff'
const STAGING_IMPORTED_MSG_KEY = 'gv-staging-import-message'

export interface StagingHandoffPayload {
  v: 1
  icons: IconUploadPayload[]
  removals: string[]
}

let pendingStagingMemory: StagingHandoffPayload | null | undefined
let importMessageMemory: string | null | undefined

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

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

function parseStagingPayload(raw: unknown): StagingHandoffPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const envelope = raw as Partial<StagingHandoffPayload>
  if (envelope.v !== 1) return null
  if (!Array.isArray(envelope.icons) || !Array.isArray(envelope.removals)) {
    return null
  }
  const icons = envelope.icons.filter(
    (item): item is IconUploadPayload =>
      Boolean(item) && typeof item === 'object' && typeof item.name === 'string',
  )
  const removals = envelope.removals.filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  )
  if (icons.length === 0 && removals.length === 0) return null
  return { v: 1, icons, removals }
}

export function decodeStagingHandoffParam(
  encoded: string,
): StagingHandoffPayload | null {
  const trimmed = encoded.trim()
  if (!trimmed) return null
  const rawB64 = trimmed.startsWith('r.') ? trimmed.slice(2) : trimmed
  try {
    const bytes = base64UrlToBytes(rawB64)
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    return parseStagingPayload(parsed)
  } catch {
    return null
  }
}

export function encodeStagingHandoffParam(
  payload: StagingHandoffPayload,
): string {
  const json = JSON.stringify(payload)
  return `r.${bytesToBase64Url(new TextEncoder().encode(json))}`
}

export async function buildStagingHandoffPayload(): Promise<StagingHandoffPayload> {
  const [icons, removals] = await Promise.all([
    exportIconUploadPayloads(),
    exportRemovalNames(),
  ])
  return { v: 1, icons, removals }
}

/** Max encoded param length (keep under typical browser URL limits). */
export const STAGING_HANDOFF_URL_MAX = 5500

export async function importStagingHandoff(
  payload: StagingHandoffPayload,
): Promise<void> {
  if (payload.icons.length > 0) {
    await stageIconsLocal(payload.icons)
  }
  if (payload.removals.length > 0) {
    await stageRemovalsLocal(payload.removals)
  }
}

function storePendingStaging(payload: StagingHandoffPayload): void {
  pendingStagingMemory = payload
  try {
    sessionStorage.setItem(PENDING_STAGING_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function storeImportMessage(message: string): void {
  importMessageMemory = message
  try {
    sessionStorage.setItem(STAGING_IMPORTED_MSG_KEY, message)
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

function stripStagingParam(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  if (url.searchParams.has(STAGING_PARAM)) {
    url.searchParams.delete(STAGING_PARAM)
    changed = true
  }
  const hashRaw = url.hash.replace(/^#/, '')
  if (hashRaw) {
    const hashParams = new URLSearchParams(hashRaw)
    if (hashParams.has(STAGING_PARAM)) {
      hashParams.delete(STAGING_PARAM)
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
 * Read `?gv-staging=` / `#gv-staging=` from the URL (Figma plugin → full browser).
 */
export function consumeStagingHandoffFromUrl(): boolean {
  if (typeof window === 'undefined') return false

  const params = readSearchAndHashParams()
  const encoded = params.get(STAGING_PARAM)?.trim() ?? ''
  if (!encoded) return false

  const payload = decodeStagingHandoffParam(encoded)
  if (payload) {
    storePendingStaging(payload)
    storeOpenUploadPanel()
    storeImportMessage(
      `Imported ${payload.icons.length} staged add(s) and ${payload.removals.length} removal(s) from Figma.`,
    )
  } else {
    storeOpenUploadPanel()
    storeImportMessage(
      'Could not read the staging handoff from Figma. Stage again and use Open icon browser in the plugin.',
    )
  }

  stripStagingParam()
  return true
}

export function takePendingStagingHandoff(): StagingHandoffPayload | null {
  if (pendingStagingMemory !== undefined) {
    const value = pendingStagingMemory
    pendingStagingMemory = null
    return value
  }
  try {
    const raw = sessionStorage.getItem(PENDING_STAGING_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_STAGING_KEY)
    return parseStagingPayload(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function takeStagingImportMessage(): string | null {
  if (importMessageMemory !== undefined) {
    const value = importMessageMemory
    importMessageMemory = null
    try {
      sessionStorage.removeItem(STAGING_IMPORTED_MSG_KEY)
    } catch {
      // ignore
    }
    return value
  }
  try {
    const value = sessionStorage.getItem(STAGING_IMPORTED_MSG_KEY)
    if (!value) return null
    sessionStorage.removeItem(STAGING_IMPORTED_MSG_KEY)
    return value
  } catch {
    return null
  }
}
