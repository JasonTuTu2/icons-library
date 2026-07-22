import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gv-icons-auth-session'
/** Hash handoff from Figma plugin → full browser (storage is partitioned in the iframe). */
const HASH_AUTH_KEY = 'gv-auth-session'

export type AuthRole = 'designer' | 'dev'

export interface AuthSession {
  token: string
  username: string
  role: AuthRole
}

type Listener = () => void
const listeners = new Set<Listener>()

/** Cached snapshot so useSyncExternalStore does not infinite-loop. */
let cachedSession: AuthSession | null | undefined
let cachedRaw: string | null | undefined

function emit(): void {
  cachedSession = undefined
  cachedRaw = undefined
  for (const listener of listeners) listener()
}

export function getAuthApiBaseUrl(): string {
  return import.meta.env.VITE_AUTH_API_URL?.trim().replace(/\/$/, '') ?? ''
}

export function isAuthApiConfigured(): boolean {
  return Boolean(getAuthApiBaseUrl())
}

function readStoredSessionRaw(): string | null {
  try {
    return (
      sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
    )
  } catch {
    return null
  }
}

function persistSessionRaw(raw: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // ignore
  }
}

function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = readStoredSessionRaw()
    if (raw === cachedRaw && cachedSession !== undefined) {
      return cachedSession
    }
    cachedRaw = raw
    if (!raw) {
      cachedSession = null
      return null
    }
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.username !== 'string' ||
      (parsed.role !== 'designer' && parsed.role !== 'dev')
    ) {
      cachedSession = null
      return null
    }
    cachedSession = {
      token: parsed.token,
      username: parsed.username,
      role: parsed.role,
    }
    return cachedSession
  } catch {
    cachedRaw = undefined
    cachedSession = null
    return null
  }
}

export function setAuthSession(session: AuthSession): void {
  persistSessionRaw(JSON.stringify(session))
  emit()
}

export function clearAuthSession(): void {
  clearStoredSession()
  emit()
}

export function subscribeAuthSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeAuthSession,
    getAuthSession,
    () => null,
  )
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<AuthSession> {
  const base = getAuthApiBaseUrl()
  if (!base) {
    throw new Error('Auth API URL is not configured (VITE_AUTH_API_URL).')
  }
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    token?: string
    username?: string
    role?: AuthRole
  }
  if (!res.ok) {
    throw new Error(body.error || `Login failed (${res.status})`)
  }
  if (
    !body.token ||
    !body.username ||
    (body.role !== 'designer' && body.role !== 'dev')
  ) {
    throw new Error('Login response was incomplete')
  }
  const session: AuthSession = {
    token: body.token,
    username: body.username,
    role: body.role,
  }
  setAuthSession(session)
  return session
}

export interface AuthInvite {
  token: string
  role: AuthRole
  createdBy: string
  createdAt: string
  expiresAt: string
}

export interface AuthUserRow {
  username: string
  role: AuthRole
  createdAt: string
}

function sessionFromLoginBody(body: {
  error?: string
  token?: string
  username?: string
  role?: AuthRole
}): AuthSession {
  if (
    !body.token ||
    !body.username ||
    (body.role !== 'designer' && body.role !== 'dev')
  ) {
    throw new Error('Login response was incomplete')
  }
  return {
    token: body.token,
    username: body.username,
    role: body.role,
  }
}

/** Public: validate invite token before showing the form. */
export async function peekInvite(
  token: string,
): Promise<{ role: AuthRole; valid: true }> {
  const base = getAuthApiBaseUrl()
  if (!base) {
    throw new Error('Auth API URL is not configured (VITE_AUTH_API_URL).')
  }
  const res = await fetch(
    `${base}/api/invites/${encodeURIComponent(token.trim())}`,
  )
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    role?: AuthRole
    valid?: boolean
  }
  if (!res.ok) {
    throw new Error(body.error || `Invite lookup failed (${res.status})`)
  }
  if (body.role !== 'designer' && body.role !== 'dev') {
    throw new Error('Invite response was incomplete')
  }
  return { role: body.role, valid: true }
}

/** Public: create account from invite and sign in. */
export async function redeemInvite(
  token: string,
  username: string,
  password: string,
): Promise<AuthSession> {
  const base = getAuthApiBaseUrl()
  if (!base) {
    throw new Error('Auth API URL is not configured (VITE_AUTH_API_URL).')
  }
  const res = await fetch(
    `${base}/api/invites/${encodeURIComponent(token.trim())}/redeem`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    token?: string
    username?: string
    role?: AuthRole
  }
  if (!res.ok) {
    throw new Error(body.error || `Invite redeem failed (${res.status})`)
  }
  const session = sessionFromLoginBody(body)
  setAuthSession(session)
  return session
}

export async function listAuthUsers(): Promise<AuthUserRow[]> {
  const res = await authApiFetch('/api/users')
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    users?: AuthUserRow[]
  }
  if (!res.ok) {
    throw new Error(body.error || `List users failed (${res.status})`)
  }
  return Array.isArray(body.users) ? body.users : []
}

export async function updateAuthUserRole(
  username: string,
  role: AuthRole,
): Promise<AuthUserRow> {
  const res = await authApiFetch(
    `/api/users/${encodeURIComponent(username.trim())}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as AuthUserRow & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error || `Update role failed (${res.status})`)
  }
  if (
    typeof body.username !== 'string' ||
    (body.role !== 'designer' && body.role !== 'dev') ||
    typeof body.createdAt !== 'string'
  ) {
    throw new Error('Update role response was incomplete')
  }
  return {
    username: body.username,
    role: body.role,
    createdAt: body.createdAt,
  }
}

export async function listAuthInvites(): Promise<AuthInvite[]> {
  const res = await authApiFetch('/api/invites')
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    invites?: AuthInvite[]
  }
  if (!res.ok) {
    throw new Error(body.error || `List invites failed (${res.status})`)
  }
  return Array.isArray(body.invites) ? body.invites : []
}

export async function createAuthInvite(role: AuthRole): Promise<AuthInvite> {
  const res = await authApiFetch('/api/invites', {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
  const body = (await res.json().catch(() => ({}))) as AuthInvite & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error || `Create invite failed (${res.status})`)
  }
  if (
    typeof body.token !== 'string' ||
    (body.role !== 'designer' && body.role !== 'dev')
  ) {
    throw new Error('Invite response was incomplete')
  }
  return {
    token: body.token,
    role: body.role,
    createdBy: body.createdBy,
    createdAt: body.createdAt,
    expiresAt: body.expiresAt,
  }
}

export async function revokeAuthInvite(token: string): Promise<void> {
  const res = await authApiFetch(
    `/api/invites/${encodeURIComponent(token.trim())}`,
    { method: 'DELETE' },
  )
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error || `Revoke invite failed (${res.status})`)
  }
}

/** Full invite URL for the current site origin + router basename. */
export function buildInviteUrl(token: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const path = `${base}/invite`
  const url = new URL(path, window.location.origin)
  url.searchParams.set('t', token)
  return url.toString()
}

export async function authApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getAuthApiBaseUrl()
  const session = getAuthSession()
  if (!base) {
    throw new Error('Auth API URL is not configured (VITE_AUTH_API_URL).')
  }
  if (!session) {
    throw new Error('Sign in to continue.')
  }
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${base}${path}`, { ...init, headers })
  if (res.status === 401) {
    clearAuthSession()
  }
  return res
}

function sessionFromHandoffEncoded(encoded: string): AuthSession | null {
  const trimmed = encoded.trim()
  if (!trimmed) return null
  try {
    const padded = trimmed.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (padded.length % 4)) % 4
    const json = atob(padded + '='.repeat(padLen))
    const parsed = JSON.parse(json) as Partial<AuthSession>
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.username !== 'string' ||
      (parsed.role !== 'designer' && parsed.role !== 'dev')
    ) {
      return null
    }
    return {
      token: parsed.token,
      username: parsed.username,
      role: parsed.role,
    }
  } catch {
    return null
  }
}

/** Hash fragment for handing auth to the full browser tab opened from the plugin. */
export function buildAuthSessionHandoffHash(): string | undefined {
  const session = getAuthSession()
  if (!session) return undefined
  const json = JSON.stringify(session)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${HASH_AUTH_KEY}=${encodeURIComponent(encoded)}`
}

/**
 * Apply `#gv-auth-session=…` from the URL (plugin → browser), then strip it.
 */
export function consumeAuthSessionFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return false

  const params = new URLSearchParams(raw)
  const encoded = params.get(HASH_AUTH_KEY)?.trim() ?? ''
  if (!encoded) return false

  const session = sessionFromHandoffEncoded(encoded)
  if (!session) return false

  setAuthSession(session)
  params.delete(HASH_AUTH_KEY)
  const next = params.toString()
  const clean =
    window.location.pathname +
    window.location.search +
    (next ? `#${next}` : '')
  window.history.replaceState(null, '', clean)
  return true
}
