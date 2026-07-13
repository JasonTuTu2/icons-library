import { describe, expect, it } from 'vitest'
import { parseName } from '../src/parseName.js'
import { getA11yAttributes } from '../src/a11y.js'
import { normalizeSize, buildIconStyle } from '../src/size.js'

describe('parseName', () => {
  it('parses ant names', () => {
    expect(parseName('ant:HomeOutlined')).toEqual({
      provider: 'ant',
      id: 'HomeOutlined',
      canonical: 'ant:HomeOutlined',
    })
  })

  it('parses iconify names', () => {
    expect(parseName('mdi:home')).toEqual({
      provider: 'iconify',
      id: 'mdi:home',
      canonical: 'mdi:home',
    })
  })

  it('rejects invalid names', () => {
    expect(() => parseName('HomeOutlined')).toThrow()
    expect(() => parseName('ant:')).toThrow()
    expect(() => parseName('ant:homeOutlined')).toThrow()
  })
})

describe('a11y', () => {
  it('marks decorative icons hidden', () => {
    expect(getA11yAttributes({ decorative: true })).toEqual({
      'aria-hidden': true,
    })
  })

  it('sets label for meaningful icons', () => {
    expect(getA11yAttributes({ label: 'Home' })).toEqual({
      role: 'img',
      'aria-label': 'Home',
    })
  })
})

describe('size', () => {
  it('normalizes numeric size to px', () => {
    expect(normalizeSize(24)).toBe('24px')
    expect(normalizeSize('1.5em')).toBe('1.5em')
  })

  it('builds style with defaults', () => {
    const style = buildIconStyle({})
    expect(style.width).toBe('1em')
    expect(style.color).toBe('currentColor')
  })
})
