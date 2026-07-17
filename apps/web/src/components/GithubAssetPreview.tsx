import { useEffect, useState } from 'react'
import {
  findLibraryAssetPath,
  getAssetPreview,
  type AssetPreview,
  type IconColorMode,
} from '../lib/github'

function previewToDataUrl(preview: AssetPreview): string {
  if (preview.kind === 'image') {
    return `data:${preview.mime};base64,${preview.base64}`
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.text)}`
}

function previewClass(colorMode?: IconColorMode, isImage?: boolean): string {
  if (isImage) return 'upload-preview upload-preview-image'
  if (colorMode === 'preserved' || colorMode === 'gradient') {
    return 'upload-preview upload-preview-color'
  }
  return 'upload-preview upload-preview-mono'
}

interface GithubAssetPreviewProps {
  /** Repo-relative path (staging or library). */
  path?: string | null
  /** When path is unknown (staged removals), resolve from library by name. */
  libraryName?: string
  colorMode?: IconColorMode
  isImage?: boolean
  title?: string
}

/**
 * Thumbnail for a GitHub Contents path (or library name for removals).
 * Matches the upload / Figma Load selection preview chrome.
 */
export function GithubAssetPreview({
  path,
  libraryName,
  colorMode,
  isImage,
  title,
}: GithubAssetPreviewProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [loadedImage, setLoadedImage] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setLoadedImage(false)

    async function load() {
      let target = path?.trim() || null
      if (!target && libraryName) {
        target = await findLibraryAssetPath(libraryName)
      }
      if (!target || cancelled) return
      const preview = await getAssetPreview(target)
      if (!preview || cancelled) return
      setLoadedImage(preview.kind === 'image')
      setSrc(previewToDataUrl(preview))
    }

    void load().catch(() => {
      if (!cancelled) setSrc(null)
    })

    return () => {
      cancelled = true
    }
  }, [path, libraryName])

  return (
    <span
      className={previewClass(colorMode, isImage || loadedImage)}
      title={title}
    >
      {src ? <img src={src} alt="" width={28} height={28} /> : null}
    </span>
  )
}
