import { createClient, type RedisClientType } from 'redis'

/**
 * KVNamespace stand-in backed by Redis (Docker Compose storage).
 * Supports get/put/delete/list + expirationTtl.
 */
export class RedisKv {
  private constructor(
    private readonly client: RedisClientType,
    private readonly keyPrefix: string,
  ) {}

  static async connect(url: string, keyPrefix = 'icons:'): Promise<RedisKv> {
    const client = createClient({ url })
    client.on('error', (err) => {
      console.error('[redis-kv]', err)
    })
    await client.connect()
    return new RedisKv(client as RedisClientType, keyPrefix)
  }

  private k(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.k(key))
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    const full = this.k(key)
    const ttl = options?.expirationTtl
    if (typeof ttl === 'number' && ttl > 0) {
      await this.client.set(full, value, { EX: Math.floor(ttl) })
    } else {
      await this.client.set(full, value)
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.k(key))
  }

  async list(options?: {
    prefix?: string
    cursor?: string
  }): Promise<{
    keys: Array<{ name: string; expiration?: number }>
    list_complete: boolean
    cursor?: string
  }> {
    const logicalPrefix = options?.prefix ?? ''
    const match = `${this.keyPrefix}${logicalPrefix}*`
    const keys: Array<{ name: string; expiration?: number }> = []
    const now = Math.floor(Date.now() / 1000)

    for await (const fullKey of this.client.scanIterator({
      MATCH: match,
      COUNT: 100,
    })) {
      const name = String(fullKey).slice(this.keyPrefix.length)
      const ttl = await this.client.ttl(String(fullKey))
      const entry: { name: string; expiration?: number } = { name }
      // ttl > 0 → seconds remaining; -1 = no expiry; -2 = missing
      if (ttl > 0) entry.expiration = now + ttl
      keys.push(entry)
    }

    keys.sort((a, b) => a.name.localeCompare(b.name))
    void options?.cursor
    return { keys, list_complete: true }
  }

  async quit(): Promise<void> {
    await this.client.quit()
  }
}
