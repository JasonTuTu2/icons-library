/**
 * Convert pending upload payloads between SVG text and PNG/JPG base64.
 * Used by Upload Apply-all format (browser-side; no Figma re-export).
 */

export type ConvertibleFormat = 'svg' | 'png' | 'jpg'

export type ConvertibleAsset = {
  content: string
  previewUrl: string
  kind: 'svg' | 'image'
  format?: 'png' | 'jpg' | 'jpeg'
  colorMode?: 'mono' | 'preserved' | 'gradient'
}

function revoke(url: string): void {
  URL.revokeObjectURL(url)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      const base64 = dataUrl.includes(',')
        ? dataUrl.slice(dataUrl.indexOf(',') + 1)
        : dataUrl
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image for conversion'))
    img.src = url
  })
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: 'image/png' | 'image/jpeg',
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, mime === 'image/jpeg' ? 0.92 : undefined)
  })
  if (!blob) throw new Error('Canvas export failed')
  return blob
}

async function rasterizeUrl(
  url: string,
  mime: 'image/png' | 'image/jpeg',
): Promise<{ base64: string; previewUrl: string }> {
  const img = await loadHtmlImage(url)
  const width = Math.max(1, img.naturalWidth || img.width || 256)
  const height = Math.max(1, img.naturalHeight || img.height || 256)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await canvasToBlob(canvas, mime)
  const base64 = await blobToBase64(blob)
  return { base64, previewUrl: URL.createObjectURL(blob) }
}

function imageToSvgDocument(
  base64: string,
  mime: string,
  width: number,
  height: number,
): string {
  const href = `data:${mime};base64,${base64}`
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <image width="${width}" height="${height}" href="${href}" xlink:href="${href}" />\n</svg>\n`
}

function currentFormat(asset: ConvertibleAsset): ConvertibleFormat {
  if (asset.kind === 'svg') return 'svg'
  return asset.format === 'jpg' || asset.format === 'jpeg' ? 'jpg' : 'png'
}

/**
 * Returns a new asset in the requested format. Caller must revoke the old
 * previewUrl when replacing state (this revokes it when content actually changes).
 */
export async function convertAssetFormat<T extends ConvertibleAsset>(
  asset: T,
  format: ConvertibleFormat,
): Promise<T> {
  if (currentFormat(asset) === format) return asset

  if (format === 'svg') {
    const mime =
      asset.kind === 'image' &&
      (asset.format === 'jpg' || asset.format === 'jpeg')
        ? 'image/jpeg'
        : asset.kind === 'image'
          ? 'image/png'
          : 'image/svg+xml'
    let width = 256
    let height = 256
    let base64 = asset.content
    if (asset.kind === 'svg') {
      // Already SVG — no-op handled above
      return asset
    }
    const img = await loadHtmlImage(asset.previewUrl)
    width = Math.max(1, img.naturalWidth || img.width || 256)
    height = Math.max(1, img.naturalHeight || img.height || 256)
    const svg = imageToSvgDocument(base64, mime, width, height)
    revoke(asset.previewUrl)
    return {
      ...asset,
      content: svg,
      previewUrl: URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml' }),
      ),
      kind: 'svg' as const,
      format: undefined,
      colorMode: asset.colorMode ?? 'mono',
    }
  }

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const sourceUrl =
    asset.kind === 'svg'
      ? URL.createObjectURL(new Blob([asset.content], { type: 'image/svg+xml' }))
      : asset.previewUrl
  try {
    const { base64, previewUrl } = await rasterizeUrl(sourceUrl, mime)
    revoke(asset.previewUrl)
    if (asset.kind === 'svg') revoke(sourceUrl)
    return {
      ...asset,
      content: base64,
      previewUrl,
      kind: 'image' as const,
      format: format === 'jpg' ? 'jpg' : 'png',
      colorMode: 'mono',
    }
  } catch (err) {
    if (asset.kind === 'svg') revoke(sourceUrl)
    throw err
  }
}
