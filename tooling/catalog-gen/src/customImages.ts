import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { sanitizeIconName } from './customSvg.js'

export type ImageFormat = 'png' | 'jpg' | 'jpeg'

export interface ProcessedCustomImage {
  name: string
  title: string
  format: ImageFormat
  /** Path relative to packages/custom-icons (e.g. images/logo.png). */
  assetPath: string
  /** Public path under the icon browser (e.g. custom-images/logo.png). */
  publicPath: string
}

function titleFromName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseFormat(ext: string): ImageFormat | null {
  const e = ext.replace(/^\./, '').toLowerCase()
  if (e === 'png' || e === 'jpg' || e === 'jpeg') return e
  return null
}

/**
 * Collect brand images from `images/*.{png,jpg,jpeg}`.
 * Catalog IDs use `img:` (not Iconify / `<Icon>`).
 */
export function collectCustomImages(
  imagesDir: string,
): { images: ProcessedCustomImage[]; warnings: string[] } {
  const warnings: string[] = []
  const images: ProcessedCustomImage[] = []
  const byName = new Map<string, ProcessedCustomImage>()

  let entries: string[]
  try {
    entries = readdirSync(imagesDir)
  } catch {
    return { images, warnings: [] }
  }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry.startsWith('_')) continue
    if (entry.toLowerCase() === 'readme.md') continue
    const format = parseFormat(extname(entry))
    if (!format) continue

    const name = sanitizeIconName(entry)
    if (!name) {
      warnings.push(`Skipped invalid image filename: ${entry}`)
      continue
    }

    if (byName.has(name)) {
      warnings.push(
        `Skipped images/${entry}: name already used by ${byName.get(name)!.assetPath}`,
      )
      continue
    }

    const processed: ProcessedCustomImage = {
      name,
      title: titleFromName(name),
      format,
      assetPath: `images/${name}.${format}`,
      publicPath: `custom-images/${name}.${format}`,
    }
    byName.set(name, processed)
    images.push(processed)
  }

  images.sort((a, b) => a.name.localeCompare(b.name))
  return { images, warnings }
}

/** Absolute file path helper when imagesDir is known. */
export function imageFilePath(imagesDir: string, image: ProcessedCustomImage): string {
  return join(imagesDir, `${image.name}.${image.format}`)
}
