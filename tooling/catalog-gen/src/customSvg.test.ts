import { describe, expect, it } from 'vitest'
import {
  collectAllCustomIcons,
  processSvgContent,
  sanitizeIconName,
} from '../src/customSvg.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('customSvg', () => {
  it('sanitizes kebab names', () => {
    expect(sanitizeIconName('Billing Alert.svg')).toBe('billing-alert')
    expect(sanitizeIconName('Bad Name!!!')).toBe('bad-name')
    expect(sanitizeIconName('123')).toBeNull()
  })

  it('normalizes fills to currentColor for mono', () => {
    const result = processSvgContent(
      `<svg viewBox="0 0 24 24"><path fill="#000" d="M0 0h24v24H0z"/></svg>`,
    )
    expect(result.body).toContain('currentColor')
    expect(result.body).not.toContain('#000')
  })

  it('preserves fills when monochrome is false', () => {
    const result = processSvgContent(
      `<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h24v24H0z"/></svg>`,
      { monochrome: false },
    )
    // SVGO may normalize #ff0000 → "red"; either form is preserved (not currentColor).
    expect(result.body.includes('#ff0000') || result.body.includes('fill="red"')).toBe(
      true,
    )
    expect(result.body).not.toContain('currentColor')
  })

  it('collects mono and color dirs with dedupe', () => {
    const root = mkdtempSync(join(tmpdir(), 'gv-icons-'))
    try {
      mkdirSync(join(root, 'color'), { recursive: true })
      writeFileSync(
        join(root, 'alpha.svg'),
        `<svg viewBox="0 0 24 24"><path fill="#111" d="M0 0h24v24H0z"/></svg>`,
      )
      writeFileSync(
        join(root, 'color', 'beta.svg'),
        `<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h24v24H0z"/></svg>`,
      )
      writeFileSync(
        join(root, 'color', 'alpha.svg'),
        `<svg viewBox="0 0 24 24"><path fill="#00ff00" d="M0 0h24v24H0z"/></svg>`,
      )

      const { icons, warnings } = collectAllCustomIcons(root)
      expect(icons.map((i) => i.name).sort()).toEqual(['alpha', 'beta'])
      expect(icons.find((i) => i.name === 'alpha')?.colorMode).toBe('mono')
      expect(icons.find((i) => i.name === 'beta')?.colorMode).toBe('preserved')
      expect(warnings.some((w) => w.includes('color/alpha.svg'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
