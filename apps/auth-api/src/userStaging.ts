/** Per-account staging queue (plugin + browser), keyed by login username. */

const USER_STAGING_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function userStagingKey(username: string): string {
  return `user-staging:${username.trim().toLowerCase()}`
}

export async function putUserStaging(
  kv: KVNamespace,
  username: string,
  json: string,
): Promise<void> {
  await kv.put(userStagingKey(username), json, {
    expirationTtl: USER_STAGING_TTL_SECONDS,
  })
}

export async function readUserStaging(
  kv: KVNamespace,
  username: string,
): Promise<string | null> {
  return await kv.get(userStagingKey(username))
}

export async function deleteUserStaging(
  kv: KVNamespace,
  username: string,
): Promise<void> {
  await kv.delete(userStagingKey(username))
}
