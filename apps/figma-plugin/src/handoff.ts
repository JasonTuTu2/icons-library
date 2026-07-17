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

/** Conservative cap for `#gv-icons=` (encoded) before ZIP/JSON fallback. */
export const MAX_HASH_PAYLOAD_CHARS = 12_000

export const HASH_ICONS_KEY = 'gv-icons'
export const HASH_UPLOAD_KEY = 'gv-upload'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw')
  const writer = cs.writable.getWriter()
  await writer.write(bytes as BufferSource)
  await writer.close()
  return new Uint8Array(await new Response(cs.readable).arrayBuffer())
}

/** Compress + base64url-encode the handoff envelope for a URL hash. */
export async function encodeHandoffHash(icons: HandoffIcon[]): Promise<string> {
  const payload: HandoffPayload = { v: 1, icons }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  const compressed = await deflateRaw(json)
  return bytesToBase64Url(compressed)
}

export function buildBrowserHandoffUrl(
  browserBase: string,
  encodedPayload: string,
): string {
  const base = browserBase.replace(/\/?$/, '/')
  const params = new URLSearchParams()
  params.set(HASH_ICONS_KEY, encodedPayload)
  return `${base}#${params.toString()}`
}

export function buildOpenUploadUrl(browserBase: string): string {
  const base = browserBase.replace(/\/?$/, '/')
  const params = new URLSearchParams()
  params.set(HASH_UPLOAD_KEY, '1')
  return `${base}#${params.toString()}`
}

export function downloadHandoffJson(icons: HandoffIcon[]): void {
  const payload: HandoffPayload = { v: 1, icons }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'gv-icons-handoff.json'
  a.click()
  URL.revokeObjectURL(url)
}
