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

/** Read without deleting (allows retry / StrictMode / auth-then-import). */
export async function readStagingHandoff(id: string): Promise<string | null> {
  const res = await caches.default.match(cacheRequest(id))
  if (!res) return null
  return await res.text()
}

/** Optional cleanup after successful import in the browser. */
export async function deleteStagingHandoff(id: string): Promise<void> {
  await caches.default.delete(cacheRequest(id))
}

/** @deprecated Prefer readStagingHandoff — delete-on-read breaks retries. */
export async function takeStagingHandoff(id: string): Promise<string | null> {
  const raw = await readStagingHandoff(id)
  if (raw) await deleteStagingHandoff(id)
  return raw
}
