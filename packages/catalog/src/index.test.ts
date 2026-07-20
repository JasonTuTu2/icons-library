import { describe, expect, it } from 'vitest'
import {
  searchIcons,
  reactSnippet,
  vueSnippet,
  getCustomCategories,
  catalog,
} from '../src/index.js'

describe('catalog', () => {
  it('has brand catalog sets and valid icon sources', () => {
    expect(catalog.sets.length).toBeGreaterThan(0)
    expect(catalog.icons.length).toBeGreaterThan(0)
    expect(catalog.sets.every((set) => set.source === 'custom')).toBe(true)
    expect(
      catalog.icons.every((icon) =>
        ['iconify', 'custom', 'modified'].includes(icon.source ?? 'custom'),
      ),
    ).toBe(true)
    expect(catalog.icons.some((icon) => icon.id.startsWith('mdi:'))).toBe(false)
  })

  it('searches by query', () => {
    const sample = catalog.icons[0]
    expect(sample).toBeTruthy()
    const query = sample!.name.split('-')[0]!
    const results = searchIcons({ query, limit: 10 })
    expect(results.length).toBeGreaterThan(0)
  })

  it('builds snippets', () => {
    expect(reactSnippet('ci:billing-alert')).toContain('ci:billing-alert')
    expect(reactSnippet('ci:billing-alert')).not.toContain('registerCustomIcons')
    expect(vueSnippet('ci:billing-alert')).toContain('ci:billing-alert')
    expect(vueSnippet('ci:billing-alert')).not.toContain('registerCustomIcons')
  })

  it('lists custom categories from catalog metadata', () => {
    expect(Array.isArray(getCustomCategories())).toBe(true)
  })

  it('filters by category including no category', () => {
    const uncategorized = searchIcons({ category: '', limit: 5 })
    expect(uncategorized.every((icon) => !(icon.category ?? '').trim())).toBe(
      true,
    )
    const named = getCustomCategories()[0]
    if (named) {
      const filtered = searchIcons({ category: named, limit: 5 })
      expect(
        filtered.every((icon) => (icon.category ?? '').trim() === named),
      ).toBe(true)
    }
  })

  it('filters by variant', () => {
    const filled = searchIcons({ variant: 'filled', limit: 20 })
    expect(filled.every((icon) => (icon.variant ?? 'none') === 'filled')).toBe(
      true,
    )
    const regular = searchIcons({ variant: 'regular', limit: 20 })
    expect(
      regular.every((icon) => (icon.variant ?? 'none') === 'regular'),
    ).toBe(true)
  })

  it('filters by source', () => {
    const custom = searchIcons({ source: 'custom', limit: 20 })
    expect(custom.every((icon) => (icon.source ?? 'custom') === 'custom')).toBe(
      true,
    )
    const iconify = searchIcons({ source: 'iconify', limit: 20 })
    expect(
      iconify.every((icon) => (icon.source ?? 'custom') === 'iconify'),
    ).toBe(true)
  })

  it('filters by usage', () => {
    const inUse = searchIcons({ usage: 'in-use', limit: 20 })
    expect(inUse.every((icon) => (icon.usage ?? 'in-use') === 'in-use')).toBe(
      true,
    )
    const unused = searchIcons({ usage: 'unused', limit: 20 })
    expect(unused.every((icon) => (icon.usage ?? 'in-use') === 'unused')).toBe(
      true,
    )
  })
})
