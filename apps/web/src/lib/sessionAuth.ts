import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gv-icons-auth-session'

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

export function getAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
  emit()
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
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
