import { describe, expect, it } from 'vitest'
import { iconifyIconExists } from './iconifyCompat.js'

describe('iconifyIconExists', () => {
  it('uses iconLoaded when present', () => {
    expect(
      iconifyIconExists({ iconLoaded: () => true }, 'ci:billing-alert'),
    ).toBe(true)
  })

  it('falls back to iconExists', () => {
    expect(iconifyIconExists({ iconExists: () => true }, 'ci:cart')).toBe(true)
  })
})
