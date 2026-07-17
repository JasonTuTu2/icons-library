import { describe, expect, it } from 'vitest'
import { iconifyIconExists } from './iconifyCompat.js'

describe('iconifyIconExists', () => {
  it('uses iconLoaded when present (Iconify v6)', () => {
    expect(
      iconifyIconExists(
        { iconLoaded: (n) => n === 'ci:billing-alert' },
        'ci:billing-alert',
      ),
    ).toBe(true)
    expect(
      iconifyIconExists({ iconLoaded: () => false }, 'ci:missing'),
    ).toBe(false)
  })

  it('falls back to iconExists (Iconify v5 alias)', () => {
    expect(
      iconifyIconExists(
        { iconExists: (n) => n === 'ci:cart' },
        'ci:cart',
      ),
    ).toBe(true)
  })

  it('prefers iconLoaded over iconExists', () => {
    expect(
      iconifyIconExists(
        {
          iconLoaded: () => true,
          iconExists: () => false,
        },
        'ci:x',
      ),
    ).toBe(true)
  })

  it('returns false when neither API exists', () => {
    expect(iconifyIconExists({}, 'ci:x')).toBe(false)
  })
})
