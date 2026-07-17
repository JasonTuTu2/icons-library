export type IconColorMode = 'mono' | 'preserved'

export interface HandoffIcon {
  name: string
  content: string
  colorMode: IconColorMode
}

export interface HandoffPayload {
  v: 1
  icons: HandoffIcon[]
}

/** Conservative cap for encoded payload before JSON download fallback. */
export const MAX_HANDOFF_CHARS = 12_000

export const HANDOFF_PARAM = 'gv-icons'
export const UPLOAD_PARAM = 'gv-upload'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Encode handoff as raw base64url JSON (prefix `r.`).
 * Avoids CompressionStream so decode is reliable across browsers.
 */
export function encodeHandoffPayload(icons: HandoffIcon[]): string {
  const payload: HandoffPayload = { v: 1, icons }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  return `r.${bytesToBase64Url(json)}`
}

export function buildBrowserHandoffUrl(
  browserBase: string,
  encodedPayload: string,
): string {
  const normalized = browserBase.match(/^https?:\/\//)
    ? browserBase
    : `https://${browserBase}`
  const url = new URL(normalized)
  // Prefer query string — Figma openExternal is unreliable with long hashes.
  url.searchParams.set(HANDOFF_PARAM, encodedPayload)
  url.searchParams.set(UPLOAD_PARAM, '1')
  url.hash = ''
  return url.toString()
}

export function buildOpenUploadUrl(browserBase: string): string {
  const normalized = browserBase.match(/^https?:\/\//)
    ? browserBase
    : `https://${browserBase}`
  const url = new URL(normalized)
  url.searchParams.set(UPLOAD_PARAM, '1')
  url.hash = ''
  return url.toString()
}

export function downloadHandoffJson(icons: HandoffIcon[]): void {
  const payload: HandoffPayload = { v: 1, icons }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = 'gv-icons-handoff.json'
  a.click()
  URL.revokeObjectURL(objectUrl)
}
