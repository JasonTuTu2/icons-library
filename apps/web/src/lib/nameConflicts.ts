import {
  sanitizeIconName,
  type IconNameConflict,
} from './github'

export type ConflictAssetKind = 'svg' | 'image'

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

/**
 * Per-item blocking messages. Empty string = ok.
 * Strict: duplicates in-batch or existing library/staging names block staging.
 */
export function conflictMessagesForItems(
  items: Array<{ name: string; kind: ConflictAssetKind }>,
  remote: IconNameConflict[],
): string[] {
  const messages = items.map(() => '')

  const indexesByKey = new Map<string, number[]>()
  items.forEach((item, index) => {
    const name = sanitizeIconName(item.name)
    if (!name) return
    const key = `${item.kind}:${name}`
    const list = indexesByKey.get(key) ?? []
    list.push(index)
    indexesByKey.set(key, list)
  })

  for (const indexes of indexesByKey.values()) {
    if (indexes.length < 2) continue
    for (const index of indexes) {
      messages[index] =
        'Duplicate name in this batch. Choose a different name.'
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
    const where = [...new Set(hits.map((c) => conflictLocationLabel(c.location)))]
      .join(', ')
    const prefix = item.kind === 'image' ? 'img:' : 'ci:'
    messages[index] =
      `${prefix}${name} is already used in ${where}. Choose a different name.`
  })

  return messages
}

export function formatConflictList(conflicts: IconNameConflict[]): string {
  return conflicts
    .map((c) => `• ${c.name} — already in ${conflictLocationLabel(c.location)}`)
    .join('\n')
}
