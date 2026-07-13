import { describe, expect, it } from 'vitest'
import { collection, getCustomIconNames } from '../src/index.js'

describe('@JasonTuTu2/icons-custom', () => {
  it('exposes a gv collection', () => {
    expect(collection.prefix).toBe('gv')
  })

  it('lists canonical names', () => {
    const names = getCustomIconNames()
    expect(names.every((n) => n.startsWith('gv:'))).toBe(true)
  })
})
