import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { optimize } from 'svgo'

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export interface IconifyIconBody {
  body: string
  width?: number
  height?: number
}

export interface ProcessedCustomIcon {
  name: string
  title: string
  icon: IconifyIconBody
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

function toCurrentColor(svg: string): string {
  return svg
    .replace(/\sfill="(?!none)([^"]*)"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none)([^"]*)"/gi, ' stroke="currentColor"')
    .replace(/fill:\s*(?!none)([^;"']+)/gi, 'fill:currentColor')
    .replace(/stroke:\s*(?!none)([^;"']+)/gi, 'stroke:currentColor')
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
    // SVGO may drop default black fills; force monochrome inheritance.
    svg = svg.replace(
      /<(path|circle|rect|polygon|polyline|ellipse)\b(?![^>]*\bfill=)/gi,
      '<$1 fill="currentColor"',
    )
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

export function collectCustomIconsFromDir(
  svgDir: string,
): { icons: ProcessedCustomIcon[]; warnings: string[] } {
  const warnings: string[] = []
  const icons: ProcessedCustomIcon[] = []

  let entries: string[]
  try {
    entries = readdirSync(svgDir)
  } catch {
    return { icons, warnings: [`Custom SVG directory missing: ${svgDir}`] }
  }

  for (const entry of entries) {
    if (entry === 'color' || entry.startsWith('.')) continue
    if (entry.startsWith('_')) continue
    if (extname(entry).toLowerCase() !== '.svg') continue

    const name = sanitizeIconName(entry)
    if (!name) {
      warnings.push(`Skipped invalid icon filename: ${entry}`)
      continue
    }

    const filePath = join(svgDir, entry)
    try {
      const raw = readFileSync(filePath, 'utf8')
      const icon = processSvgContent(raw, { monochrome: true })
      icons.push({
        name,
        title: titleFromName(name),
        icon,
      })
    } catch (err) {
      warnings.push(
        `Skipped ${entry}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  icons.sort((a, b) => a.name.localeCompare(b.name))
  return { icons, warnings }
}
