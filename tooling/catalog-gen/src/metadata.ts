import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type IconVariant = 'regular' | 'filled'

export interface CustomIconMetadata {
  categories: string[]
  icons: Record<string, { category?: string; variant?: IconVariant }>
}

function normalizeCategory(raw: string | undefined | null): string {
  return (raw ?? '').trim()
}

function normalizeVariant(raw: string | undefined | null): IconVariant {
  return raw === 'filled' ? 'filled' : 'regular'
}

export function detectVariantFromName(name: string): IconVariant {
  const trimmed = name.trim()
  if (/(^|-)filled$/i.test(trimmed)) return 'filled'
  if (/(^|-)regular$/i.test(trimmed)) return 'regular'
  return 'regular'
}

export function loadCustomMetadata(metadataPath: string): CustomIconMetadata {
  try {
    const raw = readFileSync(metadataPath, 'utf8')
    const parsed = JSON.parse(raw) as {
      categories?: unknown
      icons?: unknown
    }
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
          .filter((item): item is string => typeof item === 'string')
          .map((item) => normalizeCategory(item))
          .filter(Boolean)
      : []
    const icons: Record<
      string,
      { category?: string; variant?: IconVariant }
    > = {}
    if (parsed.icons && typeof parsed.icons === 'object') {
      for (const [name, value] of Object.entries(parsed.icons)) {
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
  } catch {
    return { categories: [], icons: {} }
  }
}

export function categoryForIcon(
  metadata: CustomIconMetadata,
  name: string,
): string | undefined {
  const category = normalizeCategory(metadata.icons[name]?.category)
  return category || undefined
}

export function variantForIcon(
  metadata: CustomIconMetadata,
  name: string,
): IconVariant {
  const stored = metadata.icons[name]?.variant
  if (stored === 'filled' || stored === 'regular') return stored
  return detectVariantFromName(name)
}

export function metadataPathFromCustomRoot(customRoot: string): string {
  return join(customRoot, 'metadata.json')
}
