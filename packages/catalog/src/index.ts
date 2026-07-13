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
  source?: 'ant' | 'iconify' | 'custom'
  limit?: number
}

export function searchIcons(options: SearchOptions = {}): IconMeta[] {
  const { query = '', set, source, limit } = options
  const q = query.trim().toLowerCase()

  let results = catalog.icons

  if (set) {
    results = results.filter((icon) => icon.set === set)
  }
  if (source) {
    results = results.filter((icon) => icon.source === source)
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

export function reactSnippet(id: string): string {
  if (id.startsWith('gv:')) {
    return `import { registerCustomIcons } from '@genvoice/icons-custom/react'\nimport { Icon } from '@genvoice/icons-react'\n\nregisterCustomIcons()\n\n<Icon name="${id}" size={24} label="…" />`
  }
  return `import { Icon } from '@genvoice/icons-react'\n\n<Icon name="${id}" size={24} label="…" />`
}

export function vueSnippet(id: string): string {
  if (id.startsWith('gv:')) {
    return `<script setup>\nimport { registerCustomIcons } from '@genvoice/icons-custom/vue'\nimport { Icon } from '@genvoice/icons-vue'\n\nregisterCustomIcons()\n</script>\n\n<template>\n  <Icon name="${id}" :size="24" label="…" />\n</template>`
  }
  return `<script setup>\nimport { Icon } from '@genvoice/icons-vue'\n</script>\n\n<template>\n  <Icon name="${id}" :size="24" label="…" />\n</template>`
}
