import { describe, expect, it } from 'vitest'
import { searchIcons, reactSnippet, vueSnippet, catalog } from '../src/index.js'

describe('catalog', () => {
  it('has icons and sets', () => {
    expect(catalog.sets.length).toBeGreaterThan(0)
    expect(catalog.icons.length).toBeGreaterThan(0)
  })

  it('searches by query', () => {
    const results = searchIcons({ query: 'home', limit: 10 })
    expect(results.length).toBeGreaterThan(0)
  })

  it('builds snippets', () => {
    expect(reactSnippet('mdi:home')).toContain('mdi:home')
    expect(vueSnippet('mdi:home')).toContain('mdi:home')
    expect(reactSnippet('ci:billing-alert')).toContain('ci:billing-alert')
    expect(reactSnippet('ci:billing-alert')).not.toContain('registerCustomIcons')
    expect(vueSnippet('ci:billing-alert')).toContain('ci:billing-alert')
    expect(vueSnippet('ci:billing-alert')).not.toContain('registerCustomIcons')
  })
})
