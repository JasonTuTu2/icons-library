import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type IconVariant = 'regular' | 'filled'
export type IconSource = 'iconify' | 'custom' | 'modified'
export type IconUsage = 'in-use' | 'unused'

export interface CustomIconMetadata {
  categories: string[]
  icons: Record<
    string,
    {
      category?: string
      variant?: IconVariant
      source?: IconSource
      usage?: IconUsage
      note?: string
    }
  >
}

function normalizeCategory(raw: string | undefined | null): string {
  return (raw ?? '').trim()
}

function normalizeVariant(raw: string | undefined | null): IconVariant {
  return raw === 'filled' ? 'filled' : 'regular'
}

function normalizeSource(raw: string | undefined | null): IconSource {
  if (raw === 'iconify' || raw === 'modified') return raw
  return 'custom'
}

function normalizeUsage(raw: string | undefined | null): IconUsage {
  return raw === 'unused' ? 'unused' : 'in-use'
}

function normalizeNote(raw: string | undefined | null): string {
  return (raw ?? '').trim().slice(0, 500)
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
      {
        category?: string
        variant?: IconVariant
        source?: IconSource
        usage?: IconUsage
        note?: string
      }
    > = {}
    if (parsed.icons && typeof parsed.icons === 'object') {
      for (const [name, value] of Object.entries(parsed.icons)) {
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

export function sourceForIcon(
  metadata: CustomIconMetadata,
  name: string,
): IconSource {
  return normalizeSource(metadata.icons[name]?.source)
}

export function usageForIcon(
  metadata: CustomIconMetadata,
  name: string,
): IconUsage {
  return normalizeUsage(metadata.icons[name]?.usage)
}

export function noteForIcon(
  metadata: CustomIconMetadata,
  name: string,
): string | undefined {
  const note = normalizeNote(metadata.icons[name]?.note)
  return note || undefined
}

export function metadataPathFromCustomRoot(customRoot: string): string {
  return join(customRoot, 'metadata.json')
}
