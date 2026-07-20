import type { PublishHistoryEntry, StagedIcon } from './github'

export function formatPublishedDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function addBreakdown(adds: StagedIcon[]): {
  mono: number
  multi: number
  gradient: number
  image: number
} {
  let mono = 0
  let multi = 0
  let gradient = 0
  let image = 0
  for (const icon of adds) {
    if (icon.kind === 'image') {
      image++
      continue
    }
    if (icon.colorMode === 'preserved') multi++
    else if (icon.colorMode === 'gradient') gradient++
    else mono++
  }
  return { mono, multi, gradient, image }
}

export function summarizeRelease(entry: PublishHistoryEntry): string {
  if (entry.versionOnly) {
    return 'Package version bump only (no new or removed icons in this release).'
  }
  const parts: string[] = []
  if (entry.adds.length > 0) {
    const b = addBreakdown(entry.adds)
    const detail: string[] = []
    if (b.mono) detail.push(`${b.mono} mono`)
    if (b.multi) detail.push(`${b.multi} multi-color`)
    if (b.gradient) detail.push(`${b.gradient} gradient`)
    if (b.image) detail.push(`${b.image} image${b.image === 1 ? '' : 's'}`)
    const suffix = detail.length ? ` (${detail.join(', ')})` : ''
    parts.push(
      `Added ${entry.adds.length} icon${entry.adds.length === 1 ? '' : 's'}${suffix}`,
    )
  }
  if (entry.removals.length > 0) {
    parts.push(
      `Removed ${entry.removals.length} icon${entry.removals.length === 1 ? '' : 's'}`,
    )
  }
  return parts.join(' · ')
}

export function iconListLabel(icon: StagedIcon): string {
  if (icon.kind === 'image') {
    return `img:${icon.name}`
  }
  return `ci:${icon.name}`
}

/** First package version that shipped each icon name (oldest matching release wins). */
export function buildIntroducedVersionByName(
  history: PublishHistoryEntry[],
): Map<string, string> {
  const map = new Map<string, string>()
  const chronological = [...history].reverse()
  for (const entry of chronological) {
    for (const icon of entry.adds) {
      if (!map.has(icon.name)) {
        map.set(icon.name, entry.version)
      }
    }
  }
  return map
}
