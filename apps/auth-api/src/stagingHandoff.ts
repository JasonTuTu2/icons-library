/** Ephemeral plugin → browser staging (KV, ~15 min TTL). */

const HANDOFF_TTL_SECONDS = 900

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isHandoffId(id: string): boolean {
  return ID_RE.test(id.trim())
}

export async function putStagingHandoff(
  kv: KVNamespace,
  id: string,
  json: string,
): Promise<void> {
  await kv.put(id, json, { expirationTtl: HANDOFF_TTL_SECONDS })
}

export async function readStagingHandoff(
  kv: KVNamespace,
  id: string,
): Promise<string | null> {
  return await kv.get(id)
}

export async function deleteStagingHandoff(
  kv: KVNamespace,
  id: string,
): Promise<void> {
  await kv.delete(id)
}
