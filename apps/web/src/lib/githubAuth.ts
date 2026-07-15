import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gv-icons-github-token'

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
