export type IconVariant = 'regular' | 'filled' | 'none'
/** Designer-assigned origin for a custom asset. */
export type IconSource = 'iconify' | 'custom' | 'modified'
/** Whether the asset is currently in use. */
export type IconUsage = 'in-use' | 'unused'

export interface CustomIconEntryMeta {
  category?: string
  variant?: IconVariant
  source?: IconSource
  usage?: IconUsage
  /** Free-form designer note (empty = none). */
  note?: string
}

export interface CustomIconMetadata {
  categories: string[]
  icons: Record<string, CustomIconEntryMeta>
}

export const METADATA_PATH = 'packages/custom-icons/metadata.json'
export const STAGING_META_DIR = 'packages/custom-icons/staging/meta'

export function createEmptyMetadata(): CustomIconMetadata {
  return { categories: [], icons: {} }
}

export function normalizeCategory(raw: string | undefined | null): string {
  return (raw ?? '').trim()
}

export function categoryLabel(category: string | undefined | null): string {
  const value = normalizeCategory(category)
  return value || 'No Category'
}

export function normalizeVariant(
  raw: string | undefined | null,
): IconVariant {
  if (raw === 'filled') return 'filled'
  if (raw === 'regular') return 'regular'
  return 'none'
}

export function detectVariantFromName(name: string): IconVariant {
  return detectVariantSuffix(name) ?? 'none'
}

/** Returns a variant only when the name ends in `-filled` / `-regular` (or is those words). */
export function detectVariantSuffix(name: string): IconVariant | null {
  const trimmed = name.trim()
  if (/(^|-)filled$/i.test(trimmed)) return 'filled'
  if (/(^|-)regular$/i.test(trimmed)) return 'regular'
  return null
}

export function variantLabel(variant: IconVariant | undefined | null): string {
  const value = normalizeVariant(variant)
  if (value === 'filled') return 'filled'
  if (value === 'regular') return 'regular'
  return 'no variant'
}

export function normalizeSource(
  raw: string | undefined | null,
): IconSource {
  if (raw === 'iconify' || raw === 'modified') return raw
  return 'custom'
}

export function sourceLabel(source: IconSource | undefined | null): string {
  const value = normalizeSource(source)
  if (value === 'iconify') return 'Iconify'
  if (value === 'modified') return 'Modified'
  return 'Custom'
}

export function normalizeUsage(raw: string | undefined | null): IconUsage {
  return raw === 'unused' ? 'unused' : 'in-use'
}

export function usageLabel(usage: IconUsage | undefined | null): string {
  return normalizeUsage(usage) === 'unused' ? 'Unused' : 'In Use'
}

/** Trim; empty string means no note. Cap length for Contents API commits. */
export function normalizeNote(raw: string | undefined | null): string {
  return (raw ?? '').trim().slice(0, 500)
}

export function noteLabel(note: string | undefined | null): string {
  const value = normalizeNote(note)
  return value || 'No Note'
}

export function parseMetadataJson(raw: string): CustomIconMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createEmptyMetadata()
  }
  if (!parsed || typeof parsed !== 'object') {
    return createEmptyMetadata()
  }
  const record = parsed as {
    categories?: unknown
    icons?: unknown
  }
  const categories = Array.isArray(record.categories)
    ? record.categories
        .filter((item): item is string => typeof item === 'string')
        .map((item) => normalizeCategory(item))
        .filter(Boolean)
    : []
  const icons: Record<string, CustomIconEntryMeta> = {}
  if (record.icons && typeof record.icons === 'object') {
    for (const [name, value] of Object.entries(record.icons)) {
      if (!value || typeof value !== 'object') continue
      const entry = value as {
        category?: unknown
        variant?: unknown
        source?: unknown
        usage?: unknown
        note?: unknown
      }
      const variantRaw =
        typeof entry.variant === 'string' ? entry.variant : undefined
      const sourceRaw =
        typeof entry.source === 'string' ? entry.source : undefined
      const usageRaw =
        typeof entry.usage === 'string' ? entry.usage : undefined
      const noteRaw = typeof entry.note === 'string' ? entry.note : undefined
      icons[name] = {
        category: normalizeCategory(
          typeof entry.category === 'string' ? entry.category : '',
        ),
        ...(variantRaw !== undefined
          ? { variant: normalizeVariant(variantRaw) }
          : {}),
        ...(sourceRaw !== undefined
          ? { source: normalizeSource(sourceRaw) }
          : {}),
        ...(usageRaw !== undefined
          ? { usage: normalizeUsage(usageRaw) }
          : {}),
        ...(noteRaw !== undefined ? { note: normalizeNote(noteRaw) } : {}),
      }
    }
  }
  return {
    categories: [...new Set(categories)].sort((a, b) => a.localeCompare(b)),
    icons,
  }
}

export function serializeMetadata(metadata: CustomIconMetadata): string {
  const normalized: CustomIconMetadata = {
    categories: [...metadata.categories]
      .map((item) => normalizeCategory(item))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    icons: {},
  }
  for (const [name, entry] of Object.entries(metadata.icons)) {
    normalized.icons[name] = {
      category: normalizeCategory(entry.category),
      variant: normalizeVariant(entry.variant),
      source: normalizeSource(entry.source),
      usage: normalizeUsage(entry.usage),
      note: normalizeNote(entry.note),
    }
  }
  return `${JSON.stringify(normalized, null, 2)}\n`
}

export function parseStagingMetaFile(raw: string): {
  category: string
  variant: IconVariant
  source: IconSource
  usage: IconUsage
  note: string
  replaceLibrary?: boolean
} {
  try {
    const parsed = JSON.parse(raw) as {
      category?: unknown
      variant?: unknown
      source?: unknown
      usage?: unknown
      note?: unknown
      replaceLibrary?: unknown
    }
    return {
      category: normalizeCategory(String(parsed.category ?? '')),
      variant: normalizeVariant(
        typeof parsed.variant === 'string' ? parsed.variant : undefined,
      ),
      source: normalizeSource(
        typeof parsed.source === 'string' ? parsed.source : undefined,
      ),
      usage: normalizeUsage(
        typeof parsed.usage === 'string' ? parsed.usage : undefined,
      ),
      note: normalizeNote(
        typeof parsed.note === 'string' ? parsed.note : undefined,
      ),
      replaceLibrary: parsed.replaceLibrary === true ? true : undefined,
    }
  } catch {
    return {
      category: '',
      variant: 'none',
      source: 'custom',
      usage: 'in-use',
      note: '',
    }
  }
}

export function mergeStagingMetaIntoMetadata(
  metadata: CustomIconMetadata,
  stagingEntries: Array<{
    name: string
    category: string
    variant?: IconVariant
    source?: IconSource
    usage?: IconUsage
    note?: string
  }>,
): CustomIconMetadata {
  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: { ...metadata.icons },
  }
  for (const { name, category, variant, source, usage, note } of stagingEntries) {
    const stagedCat = normalizeCategory(category)
    const existingCat = normalizeCategory(next.icons[name]?.category)
    // Empty staged category means "unchanged" on replace — Figma/Upload default
    // to '' and must not wipe a library category into "No Category".
    const cat = stagedCat || existingCat
    next.icons[name] = {
      ...next.icons[name],
      category: cat,
      variant: normalizeVariant(variant),
      source: normalizeSource(source),
      usage: normalizeUsage(usage),
      note: normalizeNote(note),
    }
    if (cat && !next.categories.includes(cat)) {
      next.categories.push(cat)
    }
  }
  next.categories.sort((a, b) => a.localeCompare(b))
  return next
}

export function setIconCategory(
  metadata: CustomIconMetadata,
  name: string,
  category: string,
): CustomIconMetadata {
  return setIconMetadata(metadata, name, { category })
}

export function setIconMetadata(
  metadata: CustomIconMetadata,
  name: string,
  patch: {
    category?: string
    variant?: IconVariant
    source?: IconSource
    usage?: IconUsage
    note?: string
  },
): CustomIconMetadata {
  const current = metadata.icons[name] ?? {}
  const cat =
    patch.category !== undefined
      ? normalizeCategory(patch.category)
      : normalizeCategory(current.category)
  const variant =
    patch.variant !== undefined
      ? normalizeVariant(patch.variant)
      : normalizeVariant(current.variant)
  const source =
    patch.source !== undefined
      ? normalizeSource(patch.source)
      : normalizeSource(current.source)
  const usage =
    patch.usage !== undefined
      ? normalizeUsage(patch.usage)
      : normalizeUsage(current.usage)
  const note =
    patch.note !== undefined
      ? normalizeNote(patch.note)
      : normalizeNote(current.note)

  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: {
      ...metadata.icons,
      [name]: { category: cat, variant, source, usage, note },
    },
  }
  if (cat && !next.categories.includes(cat)) {
    next.categories.push(cat)
    next.categories.sort((a, b) => a.localeCompare(b))
  }
  return next
}

export function removeIconMetadata(
  metadata: CustomIconMetadata,
  name: string,
): CustomIconMetadata {
  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: { ...metadata.icons },
  }
  delete next.icons[name]
  return next
}

export function getIconCategory(
  metadata: CustomIconMetadata,
  name: string,
): string {
  return normalizeCategory(metadata.icons[name]?.category)
}

export function getIconVariant(
  metadata: CustomIconMetadata,
  name: string,
): IconVariant {
  const stored = metadata.icons[name]?.variant
  if (stored === 'filled' || stored === 'regular' || stored === 'none') {
    return stored
  }
  return detectVariantFromName(name)
}

export function getIconSource(
  metadata: CustomIconMetadata,
  name: string,
): IconSource {
  return normalizeSource(metadata.icons[name]?.source)
}

export function getIconUsage(
  metadata: CustomIconMetadata,
  name: string,
): IconUsage {
  return normalizeUsage(metadata.icons[name]?.usage)
}

export function getIconNote(
  metadata: CustomIconMetadata,
  name: string,
): string {
  return normalizeNote(metadata.icons[name]?.note)
}
