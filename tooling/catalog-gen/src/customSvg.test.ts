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

  it('preserves gradient defs and url fills when monochrome is false', () => {
    const result = processSvgContent(
      `<svg viewBox="0 0 24 24">
        <defs><linearGradient id="g"><stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#00f"/></linearGradient></defs>
        <path fill="url(#g)" d="M0 0h24v24H0z"/>
      </svg>`,
      { monochrome: false },
    )
    expect(result.body).toMatch(/linearGradient/i)
    expect(result.body).toMatch(/url\(#g\)/i)
    expect(result.body).not.toContain('currentColor')
  })

  it('does not rewrite url(#…) fills to currentColor in mono mode', () => {
    const result = processSvgContent(
      `<svg viewBox="0 0 24 24">
        <defs><linearGradient id="g"><stop stop-color="#f00"/></linearGradient></defs>
        <path fill="url(#g)" d="M0 0h24v24H0z"/>
      </svg>`,
      { monochrome: true },
    )
    // SVGO may rename ids (g → a); paint server refs must still use url(#…).
    expect(result.body).toMatch(/url\(#\w+\)/i)
    expect(result.body).not.toMatch(/fill="currentColor"/i)
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

  it('collects gradient dir as gradient colorMode', () => {
    const root = mkdtempSync(join(tmpdir(), 'gv-icons-grad-'))
    try {
      mkdirSync(join(root, 'gradient'), { recursive: true })
      writeFileSync(
        join(root, 'gradient', 'glow.svg'),
        `<svg viewBox="0 0 24 24">
          <defs><linearGradient id="g"><stop stop-color="#f00"/></linearGradient></defs>
          <path fill="url(#g)" d="M0 0h24v24H0z"/>
        </svg>`,
      )
      const { icons } = collectAllCustomIcons(root)
      expect(icons).toHaveLength(1)
      expect(icons[0]?.name).toBe('glow')
      expect(icons[0]?.colorMode).toBe('gradient')
      expect(icons[0]?.icon.body).toMatch(/url\(#g\)/i)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
