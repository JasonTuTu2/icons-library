export type IconVariant = 'regular' | 'filled'

export interface CustomIconEntryMeta {
  category?: string
  variant?: IconVariant
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
  return value || 'No category'
}

export function normalizeVariant(
  raw: string | undefined | null,
): IconVariant {
  return raw === 'filled' ? 'filled' : 'regular'
}

export function detectVariantFromName(name: string): IconVariant {
  return detectVariantSuffix(name) ?? 'regular'
}

/** Returns a variant only when the name ends in `-filled` / `-regular` (or is those words). */
export function detectVariantSuffix(name: string): IconVariant | null {
  const trimmed = name.trim()
  if (/(^|-)filled$/i.test(trimmed)) return 'filled'
  if (/(^|-)regular$/i.test(trimmed)) return 'regular'
  return null
}

export function variantLabel(variant: IconVariant | undefined | null): string {
  return normalizeVariant(variant) === 'filled' ? 'Filled' : 'Regular'
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
      const entry = value as { category?: unknown; variant?: unknown }
      const variantRaw =
        typeof entry.variant === 'string' ? entry.variant : undefined
      icons[name] = {
        category: normalizeCategory(
          typeof entry.category === 'string' ? entry.category : '',
        ),
        ...(variantRaw !== undefined
          ? { variant: normalizeVariant(variantRaw) }
          : {}),
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
    }
  }
  return `${JSON.stringify(normalized, null, 2)}\n`
}

export function parseStagingMetaFile(raw: string): {
  category: string
  variant: IconVariant
} {
  try {
    const parsed = JSON.parse(raw) as {
      category?: unknown
      variant?: unknown
    }
    return {
      category: normalizeCategory(String(parsed.category ?? '')),
      variant: normalizeVariant(
        typeof parsed.variant === 'string' ? parsed.variant : undefined,
      ),
    }
  } catch {
    return { category: '', variant: 'regular' }
  }
}

export function mergeStagingMetaIntoMetadata(
  metadata: CustomIconMetadata,
  stagingEntries: Array<{
    name: string
    category: string
    variant?: IconVariant
  }>,
): CustomIconMetadata {
  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: { ...metadata.icons },
  }
  for (const { name, category, variant } of stagingEntries) {
    const cat = normalizeCategory(category)
    next.icons[name] = {
      ...next.icons[name],
      category: cat,
      variant: normalizeVariant(variant),
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
  patch: { category?: string; variant?: IconVariant },
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

  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: {
      ...metadata.icons,
      [name]: { category: cat, variant },
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
  if (stored === 'filled' || stored === 'regular') {
    return stored
  }
  return detectVariantFromName(name)
}
