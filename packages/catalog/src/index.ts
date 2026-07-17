import type { IconCatalog, IconMeta, IconSetInfo } from './types.js'
import catalogData from './data/icons.json'

export type { IconCatalog, IconMeta, IconSetInfo, IconLicense, IconSource } from './types.js'

export const catalog = catalogData as IconCatalog

export function getSets(): IconSetInfo[] {
  return catalog.sets
}

export function getAllIcons(): IconMeta[] {
  return catalog.icons
}

export function getIconById(id: string): IconMeta | undefined {
  return catalog.icons.find((icon) => icon.id === id)
}

export function getIconsBySet(setId: string): IconMeta[] {
  return catalog.icons.filter((icon) => icon.set === setId)
}

export interface SearchOptions {
  query?: string
  set?: string
  source?: 'custom'
  colorMode?: 'mono' | 'preserved' | 'gradient'
  /** Filter custom brand images vs vector icons. */
  assetKind?: 'icon' | 'image'
  /**
   * Filter by category.
   * - omit / `undefined`: all categories
   * - `null` or `''`: No category only
   * - non-empty string: exact category match
   */
  category?: string | null
  limit?: number
}

export function searchIcons(options: SearchOptions = {}): IconMeta[] {
  const { query = '', set, source, colorMode, assetKind, category, limit } =
    options
  const q = query.trim().toLowerCase()
  const hasCategoryFilter = Object.prototype.hasOwnProperty.call(
    options,
    'category',
  )

  let results = catalog.icons

  if (set) {
    results = results.filter((icon) => icon.set === set)
  }
  if (source) {
    results = results.filter((icon) => icon.source === source)
  }
  if (colorMode) {
    results = results.filter((icon) => icon.colorMode === colorMode)
  }
  if (assetKind === 'image') {
    results = results.filter((icon) => icon.assetKind === 'image')
  } else if (assetKind === 'icon') {
    results = results.filter((icon) => icon.assetKind !== 'image')
  }
  if (hasCategoryFilter) {
    const wanted = (category ?? '').trim()
    results = results.filter((icon) => {
      const current = (icon.category ?? '').trim()
      return current === wanted
    })
  }
  if (q) {
    results = results.filter((icon) => {
      if (icon.id.toLowerCase().includes(q)) return true
      if (icon.title.toLowerCase().includes(q)) return true
      if (icon.name.toLowerCase().includes(q)) return true
      return icon.tags.some((tag) => tag.toLowerCase().includes(q))
    })
  }

  if (limit != null && limit >= 0) {
    return results.slice(0, limit)
  }
  return results
}

export function reactSnippet(
  id: string,
  options?: { format?: 'png' | 'jpg' | 'jpeg' },
): string {
  if (id.startsWith('img:')) {
    const name = id.slice(4)
    const ext = options?.format ?? 'png'
    return `// Brand image — not an Iconify glyph.\n// From @JasonTuTu2/icons-custom (after install):\nimport logoUrl from '@JasonTuTu2/icons-custom/images/${name}.${ext}'\n\n<img src={logoUrl} alt="…" />`
  }
  return `import { Icon } from '@JasonTuTu2/icons-react'\n\n<Icon name="${id}" size={24} label="…" />`
}

export function vueSnippet(
  id: string,
  options?: { format?: 'png' | 'jpg' | 'jpeg' },
): string {
  if (id.startsWith('img:')) {
    const name = id.slice(4)
    const ext = options?.format ?? 'png'
    return `<script setup>\nimport logoUrl from '@JasonTuTu2/icons-custom/images/${name}.${ext}'\n</script>\n\n<template>\n  <img :src="logoUrl" alt="…" />\n</template>`
  }
  return `<script setup>\nimport { Icon } from '@JasonTuTu2/icons-vue'\n</script>\n\n<template>\n  <Icon name="${id}" :size="24" label="…" />\n</template>`
}

/** Distinct non-empty custom asset categories from the catalog. */
export function getCustomCategories(): string[] {
  const categories = new Set<string>()
  for (const icon of catalog.icons) {
    if (icon.source !== 'custom') continue
    const category = icon.category?.trim()
    if (category) categories.add(category)
  }
  return [...categories].sort((a, b) => a.localeCompare(b))
}
