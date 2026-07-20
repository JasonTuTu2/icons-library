import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { optimize } from 'svgo'

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export type ColorMode = 'mono' | 'preserved' | 'gradient'

export interface IconifyIconBody {
  body: string
  width?: number
  height?: number
}

export interface ProcessedCustomIcon {
  name: string
  title: string
  icon: IconifyIconBody
  colorMode: ColorMode
}

export function isValidKebabName(name: string): boolean {
  return KEBAB.test(name)
}

export function sanitizeIconName(raw: string): string | null {
  const base = basename(raw, extname(raw))
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!base || !isValidKebabName(base)) return null
  return base
}

function titleFromName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Rewrite solid fills/strokes to currentColor; keep none and url(#…) (gradients). */
function toCurrentColor(svg: string): string {
  return svg
    .replace(/\sfill="(?!none|url\()([^"]*)"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none|url\()([^"]*)"/gi, ' stroke="currentColor"')
    .replace(/fill:\s*(?!none|url\()([^;"']+)/gi, 'fill:currentColor')
    .replace(/stroke:\s*(?!none|url\()([^;"']+)/gi, 'stroke:currentColor')
}

const SHAPE_TAG = 'path|circle|rect|polygon|polyline|ellipse|line'

/**
 * Figma often sets fill="none" on the root <svg>. Iconify only stores the inner
 * body, so that inheritance is lost and unfilled shapes default to black —
 * covering brand logos with opaque black rects/strokes. Bake fill="none" onto
 * descendant shapes that omit fill before the body is extracted.
 */
function bakeRootFillNone(svg: string): string {
  const root = svg.match(/<svg\b([^>]*)>/i)
  if (!root?.[1]) return svg
  const attrs = root[1]
  const hasFillNone =
    /\bfill\s*=\s*["']none["']/i.test(attrs) ||
    /(?:^|[;"'])\s*fill\s*:\s*none\b/i.test(attrs)
  if (!hasFillNone) return svg

  return svg.replace(
    new RegExp(`<(${SHAPE_TAG})\\b(?![^>]*\\bfill=)`, 'gi'),
    '<$1 fill="none"',
  )
}

function extractViewBox(svg: string): { width: number; height: number; viewBox: string } {
  const vb = svg.match(/viewBox=["']([^"']+)["']/i)
  if (vb?.[1]) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return {
        width: parts[2]!,
        height: parts[3]!,
        viewBox: vb[1],
      }
    }
  }

  const widthMatch = svg.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/i)
  const heightMatch = svg.match(/\bheight=["'](\d+(?:\.\d+)?)["']/i)
  const width = widthMatch ? Number(widthMatch[1]) : 24
  const height = heightMatch ? Number(heightMatch[1]) : 24
  return { width, height, viewBox: `0 0 ${width} ${height}` }
}

function extractBody(svg: string): string {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i)
  if (!match?.[1]) {
    throw new Error('Could not extract SVG body')
  }
  return match[1].trim()
}

export function processSvgContent(
  raw: string,
  options: { monochrome?: boolean } = {},
): IconifyIconBody {
  const { monochrome = true } = options
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Empty SVG')
  }
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error('Not an SVG document')
  }

  const optimized = optimize(trimmed, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
            // Keep gradient / pattern IDs stable so url(#…) refs survive.
            ...(!monochrome ? { cleanupIds: false } : {}),
          },
        },
      },
      'removeDimensions',
    ],
  })

  if ('error' in optimized && optimized.error) {
    throw new Error(String(optimized.error))
  }

  let svg = optimized.data
  if (monochrome) {
    svg = toCurrentColor(svg)
    // SVGO may drop default black fills; force monochrome inheritance
    // except shapes that already use a paint server (gradient/pattern).
    svg = svg.replace(
      new RegExp(`<(${SHAPE_TAG})\\b(?![^>]*\\bfill=)`, 'gi'),
      '<$1 fill="currentColor"',
    )
  } else {
    svg = bakeRootFillNone(svg)
  }

  const { width, height, viewBox } = extractViewBox(svg)
  // Ensure viewBox exists for Iconify
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`)
  }

  const body = extractBody(svg)
  return {
    body,
    width: Math.round(width) || 24,
    height: Math.round(height) || 24,
  }
}

function collectFromDir(
  dir: string,
  colorMode: ColorMode,
): { icons: ProcessedCustomIcon[]; warnings: string[] } {
  const warnings: string[] = []
  const icons: ProcessedCustomIcon[] = []
  const monochrome = colorMode === 'mono'

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return { icons, warnings: [] }
  }

  for (const entry of entries) {
    if (entry === 'color' || entry === 'gradient' || entry.startsWith('.')) continue
    if (entry.startsWith('_')) continue
    if (entry.toLowerCase() === 'readme.md') continue
    if (extname(entry).toLowerCase() !== '.svg') continue

    const name = sanitizeIconName(entry)
    if (!name) {
      warnings.push(`Skipped invalid icon filename: ${entry}`)
      continue
    }

    const filePath = join(dir, entry)
    try {
      const raw = readFileSync(filePath, 'utf8')
      const icon = processSvgContent(raw, { monochrome })
      icons.push({
        name,
        title: titleFromName(name),
        icon,
        colorMode,
      })
    } catch (err) {
      warnings.push(
        `Skipped ${entry}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { icons, warnings }
}

function mergeIcons(
  byName: Map<string, ProcessedCustomIcon>,
  batch: { icons: ProcessedCustomIcon[]; warnings: string[] },
  folderLabel: string,
  warnings: string[],
): void {
  warnings.push(...batch.warnings)
  for (const icon of batch.icons) {
    if (byName.has(icon.name)) {
      warnings.push(
        `Skipped ${folderLabel}/${icon.name}.svg: name already used by ${byName.get(icon.name)!.colorMode} icon "${icon.name}"`,
      )
      continue
    }
    byName.set(icon.name, icon)
  }
}

/**
 * Collect custom icons from:
 * - `svg/*.svg` (mono)
 * - `svg/color/*.svg` (preserved multi-color)
 * - `svg/gradient/*.svg` (gradients / paint servers preserved)
 * Shared `ci:` namespace — first wins on name collision (mono > color > gradient).
 */
export function collectAllCustomIcons(
  svgRootDir: string,
): { icons: ProcessedCustomIcon[]; warnings: string[] } {
  const warnings: string[] = []
  const byName = new Map<string, ProcessedCustomIcon>()

  mergeIcons(byName, collectFromDir(svgRootDir, 'mono'), 'svg', warnings)
  mergeIcons(
    byName,
    collectFromDir(join(svgRootDir, 'color'), 'preserved'),
    'color',
    warnings,
  )
  mergeIcons(
    byName,
    collectFromDir(join(svgRootDir, 'gradient'), 'gradient'),
    'gradient',
    warnings,
  )

  const icons = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { icons, warnings }
}

/** @deprecated Prefer collectAllCustomIcons */
export function collectCustomIconsFromDir(
  svgDir: string,
): { icons: ProcessedCustomIcon[]; warnings: string[] } {
  return collectAllCustomIcons(svgDir)
}
