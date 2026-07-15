import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gv-icons-github-token'
/** Hash key used by the Figma plugin to hand off a PAT into the browser. */
const HASH_TOKEN_KEY = 'gv-github-token'

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getGithubSessionToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setGithubSessionToken(token: string): void {
  const value = token.trim()
  if (!value) {
    clearGithubSessionToken()
    return
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore quota / private mode
  }
  emit()
}

export function clearGithubSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  emit()
}

/**
 * If the Figma plugin opened the browser with `#gv-github-token=…`, store it in
 * sessionStorage and strip the token from the URL.
 */
export function consumeGithubTokenFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return false

  const params = new URLSearchParams(raw)
  const fromHash = params.get(HASH_TOKEN_KEY)?.trim() ?? ''
  if (!fromHash) return false

  setGithubSessionToken(fromHash)
  params.delete(HASH_TOKEN_KEY)
  const next = params.toString()
  const clean =
    window.location.pathname +
    window.location.search +
    (next ? `#${next}` : '')
  window.history.replaceState(null, '', clean)
  return true
}

export function subscribeGithubSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Reactive session PAT (tab-scoped). Empty when signed out. */
export function useGithubSessionToken(): string {
  return useSyncExternalStore(
    subscribeGithubSession,
    getGithubSessionToken,
    () => '',
  )
}
