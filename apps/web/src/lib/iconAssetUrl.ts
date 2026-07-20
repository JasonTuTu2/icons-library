import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { customImagePublicUrl } from './customImageUrl'

/**
 * Public path under the icon browser root for a downloadable library asset.
 * Prefer catalog `assetPath` when present; otherwise derive from color mode.
 */
export function resolveIconAssetPath(icon: IconMeta): string | null {
  if (icon.assetPath) {
    return icon.assetPath.replace(/^\//, '')
  }

  if (icon.assetKind === 'image') return null

  if (!icon.id.startsWith('ci:') || !icon.name) return null

  if (icon.colorMode === 'preserved') {
    return `custom-icons/color/${icon.name}.svg`
  }
  if (icon.colorMode === 'gradient') {
    return `custom-icons/gradient/${icon.name}.svg`
  }
  return `custom-icons/${icon.name}.svg`
}

export function iconAssetPublicUrl(icon: IconMeta): string | null {
  const path = resolveIconAssetPath(icon)
  if (!path) return null
  return customImagePublicUrl(path)
}

export function iconAssetDownloadFilename(icon: IconMeta): string | null {
  const path = resolveIconAssetPath(icon)
  if (!path) return null
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

/** Fetch the public asset and trigger a browser download. */
export async function downloadIconAsset(icon: IconMeta): Promise<void> {
  const url = iconAssetPublicUrl(icon)
  const filename = iconAssetDownloadFilename(icon)
  if (!url || !filename) {
    throw new Error('No downloadable file for this icon')
  }

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`)
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
