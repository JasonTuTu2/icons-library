import type { IconUploadPayload } from './github'
import {
  stageIconsLocal,
  stageRemovalsLocal,
  exportIconUploadPayloads,
  exportRemovalNames,
} from './localStagingStore'
import { storeOpenUploadPanel } from './figmaHandoff'
import { authApiFetch, getAuthSession, isAuthApiConfigured } from './sessionAuth.js'

const STAGING_PARAM = 'gv-staging'
const STAGING_ID_PARAM = 'gv-staging-id'
const PENDING_STAGING_KEY = 'gv-pending-staging-handoff'
const PENDING_HANDOFF_ID_KEY = 'gv-pending-staging-handoff-id'
const STAGING_IMPORTED_MSG_KEY = 'gv-staging-import-message'

export interface StagingHandoffPayload {
  v: 1
  icons: IconUploadPayload[]
  removals: string[]
}

let pendingStagingMemory: StagingHandoffPayload | null | undefined
let importMessageMemory: string | null | undefined
const importedHandoffIds = new Set<string>()
const handoffImportInFlight = new Set<string>()

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
  const icons = envelope.icons.filter((item): item is IconUploadPayload => {
    if (!item || typeof item !== 'object') return false
    const row = item as IconUploadPayload
    if (typeof row.name !== 'string' || !row.name.trim()) return false
    const content = typeof row.content === 'string' ? row.content : ''
    if (!content.trim()) return false
    if (row.kind === 'image') return true
    return /<svg[\s>]/i.test(content)
  })
  const removals = envelope.removals.filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  )
  if (icons.length === 0 && removals.length === 0) return null
  return { v: 1, icons, removals }
}

/** Parse a downloaded `gv-staging-handoff.json` (or equivalent). */
export function parseStagingHandoffFile(raw: string): StagingHandoffPayload | null {
  try {
    return parseStagingPayload(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
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

/** Max encoded `gv-staging` param length (leave room for auth hash + query). */
export const STAGING_HANDOFF_URL_MAX = 14_000

export function buildStagingHandoffUrl(
  baseUrl: string,
  payload: StagingHandoffPayload,
): { url: string; tooLarge?: boolean } {
  const base = baseUrl.replace(/\/?$/, '/')
  if (payload.icons.length === 0 && payload.removals.length === 0) {
    return { url: base }
  }

  const encoded = encodeStagingHandoffParam(payload)
  if (encoded.length <= STAGING_HANDOFF_URL_MAX) {
    const url = `${base}${base.includes('?') ? '&' : '?'}gv-staging=${encodeURIComponent(encoded)}&gv-upload=1`
    return { url }
  }

  return {
    url: `${base}${base.includes('?') ? '&' : '?'}gv-upload=1`,
    tooLarge: true,
  }
}

/** Store queue on auth API; returns short id for `?gv-staging-id=`. */
export async function createServerStagingHandoff(
  payload: StagingHandoffPayload,
): Promise<string> {
  const res = await authApiFetch('/api/staging-handoff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as {
    id?: string
    error?: string
  }
  if (!res.ok || !body.id) {
    throw new Error(body.error || `Staging handoff failed (${res.status})`)
  }
  return body.id
}

export async function fetchServerStagingHandoff(
  id: string,
): Promise<StagingHandoffPayload> {
  if (!getAuthSession()) {
    throw new Error('Sign in to import staging from the plugin.')
  }
  const res = await authApiFetch(
    `/api/staging-handoff/${encodeURIComponent(id)}`,
  )
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
  } & StagingHandoffPayload
  if (res.status === 401) {
    throw new Error('Sign in to import staging from the plugin.')
  }
  if (!res.ok) {
    throw new Error(
      body.error ||
        (res.status === 404
          ? 'Staging handoff expired or not found. Open the icon browser again from the plugin.'
          : `Staging handoff failed (${res.status})`),
    )
  }
  const parsed = parseStagingPayload(body)
  if (!parsed) {
    throw new Error(
      'Handoff data was invalid or empty. Stage again in the plugin and use Open icon browser.',
    )
  }
  return parsed
}

async function ackServerHandoff(id: string): Promise<void> {
  try {
    await authApiFetch(`/api/staging-handoff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  } catch {
    // TTL will expire the cache entry
  }
}

async function importFromHandoffId(id: string): Promise<boolean> {
  const trimmed = id.trim()
  if (!trimmed || importedHandoffIds.has(trimmed)) return false
  if (handoffImportInFlight.has(trimmed)) return false
  handoffImportInFlight.add(trimmed)

  try {
    const payload = await fetchServerStagingHandoff(trimmed)
    await importHandoffOrThrow(payload)
    importedHandoffIds.add(trimmed)
    clearPendingHandoffId()
    void ackServerHandoff(trimmed)
    storePendingStaging(payload)
    storeOpenUploadPanel()
    storeImportMessage(handoffImportedMessage(payload))
    return true
  } catch (err) {
    storeImportMessage(err instanceof Error ? err.message : String(err))
    storeOpenUploadPanel()
    return true
  } finally {
    handoffImportInFlight.delete(trimmed)
  }
}

function rememberPendingHandoffId(id: string): void {
  try {
    sessionStorage.setItem(PENDING_HANDOFF_ID_KEY, id)
  } catch {
    // ignore
  }
}

function clearPendingHandoffId(): void {
  try {
    sessionStorage.removeItem(PENDING_HANDOFF_ID_KEY)
  } catch {
    // ignore
  }
}

function readPendingHandoffId(): string {
  try {
    return sessionStorage.getItem(PENDING_HANDOFF_ID_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

async function importHandoffOrThrow(
  payload: StagingHandoffPayload,
): Promise<void> {
  try {
    await importStagingHandoff(payload)
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Could not save staged icons in this browser.',
    )
  }
}

function handoffImportedMessage(payload: StagingHandoffPayload): string {
  return `Imported ${payload.icons.length} staged add(s) and ${payload.removals.length} removal(s) from the plugin.`
}

/** Retry import when auth was missing on first load (plugin ? browser tab). */
export async function retryPendingStagingHandoffImport(): Promise<boolean> {
  const id = readPendingHandoffId()
  if (!id || !isAuthApiConfigured() || !getAuthSession()) return false
  return importFromHandoffId(id)
}

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

export function downloadStagingHandoffJson(payload: StagingHandoffPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'gv-staging-handoff.json'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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

function stripStagingParams(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  if (url.searchParams.has(STAGING_PARAM)) {
    url.searchParams.delete(STAGING_PARAM)
    changed = true
  }
  if (url.searchParams.has(STAGING_ID_PARAM)) {
    url.searchParams.delete(STAGING_ID_PARAM)
    changed = true
  }
  const hashRaw = url.hash.replace(/^#/, '')
  if (hashRaw) {
    const hashParams = new URLSearchParams(hashRaw)
    let hashChanged = false
    if (hashParams.has(STAGING_PARAM)) {
      hashParams.delete(STAGING_PARAM)
      hashChanged = true
    }
    if (hashParams.has(STAGING_ID_PARAM)) {
      hashParams.delete(STAGING_ID_PARAM)
      hashChanged = true
    }
    if (hashChanged) {
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
 * Import staging from the URL (`gv-staging-id` via auth API, or legacy `gv-staging`).
 */
export async function consumeStagingHandoffFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const params = readSearchAndHashParams()
  const handoffId = params.get(STAGING_ID_PARAM)?.trim() ?? ''
  if (handoffId) {
    rememberPendingHandoffId(handoffId)
    stripStagingParams()
    storeOpenUploadPanel()
    if (!isAuthApiConfigured()) {
      storeImportMessage(
        'Staging handoff requires Sign in (auth API). Sign in, then open Upload again or reload this page.',
      )
      return true
    }
    if (!getAuthSession()) {
      storeImportMessage(
        'Sign in to import staged icons from the plugin (your handoff link is saved for this tab).',
      )
      return true
    }
    await importFromHandoffId(handoffId)
    return true
  }

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

  stripStagingParams()
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
