export interface CustomIconEntryMeta {
  category?: string
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
      const entry = value as { category?: unknown }
      icons[name] = {
        category: normalizeCategory(
          typeof entry.category === 'string' ? entry.category : '',
        ),
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
    }
  }
  return `${JSON.stringify(normalized, null, 2)}\n`
}

export function parseStagingMetaFile(raw: string): { category: string } {
  try {
    const parsed = JSON.parse(raw) as { category?: unknown }
    return { category: normalizeCategory(String(parsed.category ?? '')) }
  } catch {
    return { category: '' }
  }
}

export function mergeStagingMetaIntoMetadata(
  metadata: CustomIconMetadata,
  stagingEntries: Array<{ name: string; category: string }>,
): CustomIconMetadata {
  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: { ...metadata.icons },
  }
  for (const { name, category } of stagingEntries) {
    const cat = normalizeCategory(category)
    next.icons[name] = { ...next.icons[name], category: cat }
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
  const cat = normalizeCategory(category)
  const next: CustomIconMetadata = {
    categories: [...metadata.categories],
    icons: {
      ...metadata.icons,
      [name]: { ...metadata.icons[name], category: cat },
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
