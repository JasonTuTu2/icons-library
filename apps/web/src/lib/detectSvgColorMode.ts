import type { IconColorMode } from './github'

const PAINT_SERVER =
  /<(?:linearGradient|radialGradient|pattern)\b/i
const URL_PAINT = /(?:fill|stroke)\s*[:=]\s*["']?\s*url\s*\(/i

const ATTR_COLOR =
  /(?:fill|stroke|stop-color)\s*=\s*["']([^"']+)["']/gi
const STYLE_COLOR =
  /(?:fill|stroke|stop-color)\s*:\s*([^;"']+)/gi

const IGNORE = new Set([
  'none',
  'transparent',
  'inherit',
  'initial',
  'unset',
  'currentcolor',
  'context-fill',
  'context-stroke',
])

function normalizeColor(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value || IGNORE.has(value)) return null
  if (value.startsWith('url(')) return null

  // rgb(…) / rgba(…) — keep compact form for uniqueness
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  )
  if (rgb) {
    const r = Math.round(Number(rgb[1]))
    const g = Math.round(Number(rgb[2]))
    const b = Math.round(Number(rgb[3]))
    value = `#${[r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('')}`
  }

  // Expand #rgb → #rrggbb
  const short = value.match(/^#([0-9a-f]{3})$/i)
  if (short?.[1]) {
    value = `#${short[1]
      .split('')
      .map((c) => c + c)
      .join('')}`
  }

  return value
}

function collectSolidColors(svg: string): Set<string> {
  const colors = new Set<string>()
  for (const re of [ATTR_COLOR, STYLE_COLOR]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(svg)) !== null) {
      const normalized = normalizeColor(match[1] ?? '')
      if (normalized) colors.add(normalized)
    }
  }
  return colors
}

/**
 * Guess Mono / Multi / Gradient from SVG markup.
 * Prefer Gradient when paint servers are present; Multi when 2+ distinct
 * solid colors; otherwise Mono. Callers should still allow manual override.
 */
export function detectSvgColorMode(svg: string): IconColorMode {
  if (!svg || !/<svg\b/i.test(svg)) return 'mono'

  if (PAINT_SERVER.test(svg) || URL_PAINT.test(svg)) {
    return 'gradient'
  }

  const colors = collectSolidColors(svg)
  if (colors.size >= 2) return 'preserved'
  return 'mono'
}
