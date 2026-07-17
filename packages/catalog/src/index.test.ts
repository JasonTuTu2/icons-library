import { describe, expect, it } from 'vitest'
import {
  searchIcons,
  reactSnippet,
  vueSnippet,
  getCustomCategories,
  catalog,
} from '../src/index.js'

describe('catalog', () => {
  it('has custom-only icons and sets', () => {
    expect(catalog.sets.length).toBeGreaterThan(0)
    expect(catalog.icons.length).toBeGreaterThan(0)
    expect(catalog.sets.every((set) => set.source === 'custom')).toBe(true)
    expect(catalog.icons.every((icon) => icon.source === 'custom')).toBe(true)
    expect(catalog.icons.some((icon) => icon.id.startsWith('mdi:'))).toBe(false)
  })

  it('searches by query', () => {
    const results = searchIcons({ query: 'v1', limit: 10 })
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
    expect(filled.every((icon) => (icon.variant ?? 'regular') === 'filled')).toBe(
      true,
    )
    const regular = searchIcons({ variant: 'regular', limit: 20 })
    expect(
      regular.every((icon) => (icon.variant ?? 'regular') === 'regular'),
    ).toBe(true)
  })
})
