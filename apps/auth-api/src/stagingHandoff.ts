/** Ephemeral plugin → browser staging via Workers Cache (no KV setup). */

const HANDOFF_CACHE_ORIGIN = 'https://icons-library-staging-handoff.invalid'

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isHandoffId(id: string): boolean {
  return ID_RE.test(id.trim())
}

function cacheRequest(id: string): Request {
  return new Request(`${HANDOFF_CACHE_ORIGIN}/${id}`)
}

export async function putStagingHandoff(
  id: string,
  json: string,
): Promise<void> {
  await caches.default.put(
    cacheRequest(id),
    new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=900',
      },
    }),
  )
}

/** Read once, then delete. */
export async function takeStagingHandoff(id: string): Promise<string | null> {
  const req = cacheRequest(id)
  const res = await caches.default.match(req)
  if (!res) return null
  await caches.default.delete(req)
  return await res.text()
}
