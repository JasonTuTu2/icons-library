import { describe, expect, it } from 'vitest'
import { processSvgContent, sanitizeIconName } from '../src/customSvg.js'

describe('customSvg', () => {
  it('sanitizes kebab names', () => {
    expect(sanitizeIconName('Billing Alert.svg')).toBe('billing-alert')
    expect(sanitizeIconName('Bad Name!!!')).toBe('bad-name')
    expect(sanitizeIconName('123')).toBeNull()
  })

  it('normalizes fills to currentColor', () => {
    const result = processSvgContent(
      `<svg viewBox="0 0 24 24"><path fill="#000" d="M0 0h24v24H0z"/></svg>`,
    )
    expect(result.body).toContain('currentColor')
    expect(result.body).not.toContain('#000')
  })
})
