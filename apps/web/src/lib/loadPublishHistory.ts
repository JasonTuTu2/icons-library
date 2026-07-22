import type { PublishHistoryEntry, StagedIcon, StagedRemoval } from './github'
import { listPublishHistory } from './github'

function publishHistoryUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}publish-history.json`
}

function isStagedIcon(value: unknown): value is StagedIcon {
  if (!value || typeof value !== 'object') return false
  const icon = value as Partial<StagedIcon>
  return (
    typeof icon.name === 'string' &&
    typeof icon.path === 'string' &&
    (icon.kind === 'svg' || icon.kind === 'image')
  )
}

function isStagedRemoval(value: unknown): value is StagedRemoval {
  if (!value || typeof value !== 'object') return false
  const rem = value as Partial<StagedRemoval>
  return typeof rem.name === 'string' && typeof rem.path === 'string'
}

function parseEntry(value: unknown): PublishHistoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<PublishHistoryEntry>
  if (
    typeof entry.version !== 'string' ||
    typeof entry.publishedAt !== 'string' ||
    typeof entry.commitSha !== 'string' ||
    !Array.isArray(entry.adds) ||
    !Array.isArray(entry.removals)
  ) {
    return null
  }
  const adds = entry.adds.filter(isStagedIcon)
  const removals = entry.removals.filter(isStagedRemoval)
  return {
    version: entry.version,
    publishedAt: entry.publishedAt,
    commitSha: entry.commitSha,
    adds,
    removals,
    versionOnly:
      typeof entry.versionOnly === 'boolean'
        ? entry.versionOnly
        : adds.length === 0 && removals.length === 0,
  }
}

/** Prefer static Pages artifact; fall back to live GitHub via auth-api. */
export async function loadPublishHistory(options?: {
  limit?: number
}): Promise<PublishHistoryEntry[]> {
  const limit = options?.limit
  try {
    const res = await fetch(publishHistoryUrl())
    if (res.ok) {
      const data = (await res.json()) as unknown
      if (Array.isArray(data)) {
        const entries = data
          .map(parseEntry)
          .filter((e): e is PublishHistoryEntry => e !== null)
        if (entries.length > 0) {
          return typeof limit === 'number' ? entries.slice(0, limit) : entries
        }
      }
    }
  } catch {
    // fall through to live API
  }
  return listPublishHistory(options)
}
