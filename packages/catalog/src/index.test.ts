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
    expect(vueSnippet('ant:HomeOutlined')).toContain('ant:HomeOutlined')
    expect(reactSnippet('gv:star')).toContain('registerCustomIcons')
    expect(vueSnippet('gv:star')).toContain('@JasonTuTu2/icons-custom/vue')
  })
})
