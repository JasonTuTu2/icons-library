import { describe, expect, it } from 'vitest'
import { iconifyIconExists } from './iconifyCompat.js'

describe('iconifyIconExists', () => {
  it('uses iconLoaded when present (Iconify v6)', () => {
    expect(
      iconifyIconExists(
        { iconLoaded: (n) => n === 'gv:billing-alert' },
        'gv:billing-alert',
      ),
    ).toBe(true)
    expect(
      iconifyIconExists({ iconLoaded: () => false }, 'gv:missing'),
    ).toBe(false)
  })

  it('falls back to iconExists (Iconify v5 alias)', () => {
    expect(
      iconifyIconExists(
        { iconExists: (n) => n === 'gv:cart' },
        'gv:cart',
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
        'gv:x',
      ),
    ).toBe(true)
  })

  it('returns false when neither API exists', () => {
    expect(iconifyIconExists({}, 'gv:x')).toBe(false)
  })
})
