import {
  sanitizeIconName,
  type IconNameConflict,
} from './github'

export type ConflictAssetKind = 'svg' | 'image'

export type ConflictCopy = {
  duplicateBatch: string
  alreadyIn: (id: string, where: string) => string
  willReplace: (id: string, where: string) => string
  locationLabel: (location: IconNameConflict['location']) => string
  replaceConfirm: (label: string) => string
}

const defaultCopy: ConflictCopy = {
  duplicateBatch: 'Duplicate name in this batch. Choose a different name.',
  alreadyIn: (id, where) =>
    `${id} is already in ${where}. Unstage it first or rename.`,
  willReplace: (id, where) =>
    `${id} will replace ${where} when you Stage (Apply overwrites the file, including when color mode changes).`,
  locationLabel: conflictLocationLabel,
  replaceConfirm: (label) =>
    `Replace existing ${label} in the library?\n\nApply will overwrite the current file. Publishing a replacement bumps the minor package version (e.g. 0.3.21 → 0.4.0).`,
}

export function conflictLocationLabel(
  location: IconNameConflict['location'],
): string {
  switch (location) {
    case 'library-mono':
      return 'library (mono SVG)'
    case 'library-color':
      return 'library (multi-color SVG)'
    case 'library-gradient':
      return 'library (gradient SVG)'
    case 'library-image':
      return 'library (brand image)'
    case 'staging-mono':
      return 'staging (mono SVG)'
    case 'staging-color':
      return 'staging (multi-color SVG)'
    case 'staging-gradient':
      return 'staging (gradient SVG)'
    case 'staging-image':
      return 'staging (brand image)'
    case 'staging-remove':
      return 'staged removals'
  }
}

export function isLibraryConflictLocation(
  location: IconNameConflict['location'],
): boolean {
  return location.startsWith('library-')
}

export function isStagingConflictLocation(
  location: IconNameConflict['location'],
): boolean {
  return (
    location.startsWith('staging-') || location === 'staging-remove'
  )
}

/** Image names only collide with images; SVG names only with SVGs. */
export function isConflictForKind(
  location: IconNameConflict['location'],
  kind: ConflictAssetKind,
): boolean {
  if (location === 'staging-remove') return true
  if (kind === 'image') {
    return location === 'library-image' || location === 'staging-image'
  }
  return (
    location === 'library-mono' ||
    location === 'library-color' ||
    location === 'library-gradient' ||
    location === 'staging-mono' ||
    location === 'staging-color' ||
    location === 'staging-gradient'
  )
}

function itemKey(kind: ConflictAssetKind, name: string): string {
  return `${kind}:${name}`
}

export interface ItemConflictAnalysis {
  /** Blocks Stage (staging dupes, staging queue conflicts, invalid batch dupes). */
  messages: string[]
  /** Library conflicts — confirm replace on Stage. */
  replaceKeys: string[]
  /** Non-blocking hints for library replace (shown in the row). */
  replaceHints: string[]
}

/**
 * Per-item conflict analysis. Empty `messages` entry = ok to stage (library hits → replace flow).
 */
export function analyzeItemConflicts(
  items: Array<{ name: string; kind: ConflictAssetKind }>,
  remote: IconNameConflict[],
  copy: ConflictCopy = defaultCopy,
): ItemConflictAnalysis {
  const messages = items.map(() => '')
  const replaceHints = items.map(() => '')
  const replaceKeys: string[] = []

  const indexesByKey = new Map<string, number[]>()
  items.forEach((item, index) => {
    const name = sanitizeIconName(item.name)
    if (!name) return
    const key = itemKey(item.kind, name)
    const list = indexesByKey.get(key) ?? []
    list.push(index)
    indexesByKey.set(key, list)
  })

  for (const indexes of indexesByKey.values()) {
    if (indexes.length < 2) continue
    for (const index of indexes) {
      messages[index] = copy.duplicateBatch
    }
  }

  items.forEach((item, index) => {
    if (messages[index]) return
    const name = sanitizeIconName(item.name)
    if (!name) return
    const hits = remote.filter(
      (c) => c.name === name && isConflictForKind(c.location, item.kind),
    )
    if (hits.length === 0) return

    const stagingHits = hits.filter((c) => isStagingConflictLocation(c.location))
    const libraryHits = hits.filter((c) => isLibraryConflictLocation(c.location))

    if (stagingHits.length > 0) {
      const where = [
        ...new Set(stagingHits.map((c) => copy.locationLabel(c.location))),
      ].join(', ')
      const prefix = item.kind === 'image' ? 'img:' : 'ci:'
      messages[index] = copy.alreadyIn(`${prefix}${name}`, where)
      return
    }

    if (libraryHits.length > 0) {
      const key = itemKey(item.kind, name)
      replaceKeys.push(key)
      const where = [
        ...new Set(libraryHits.map((c) => copy.locationLabel(c.location))),
      ].join(', ')
      const prefix = item.kind === 'image' ? 'img:' : 'ci:'
      replaceHints[index] = copy.willReplace(`${prefix}${name}`, where)
    }
  })

  return { messages, replaceHints, replaceKeys: [...new Set(replaceKeys)] }
}

/** @deprecated Prefer analyzeItemConflicts — kept for simple call sites. */
export function conflictMessagesForItems(
  items: Array<{ name: string; kind: ConflictAssetKind }>,
  remote: IconNameConflict[],
): string[] {
  return analyzeItemConflicts(items, remote).messages
}

export function formatConflictList(conflicts: IconNameConflict[]): string {
  return conflicts
    .map((c) => `• ${c.name} — already in ${conflictLocationLabel(c.location)}`)
    .join('\n')
}

export function confirmLibraryReplacements(
  replaceKeys: string[],
  copy: ConflictCopy = defaultCopy,
): boolean {
  for (const key of replaceKeys) {
    const [kind, name] = key.split(':') as [ConflictAssetKind, string]
    const label = kind === 'image' ? `img:${name}` : `ci:${name}`
    const ok = window.confirm(copy.replaceConfirm(label))
    if (!ok) return false
  }
  return true
}
