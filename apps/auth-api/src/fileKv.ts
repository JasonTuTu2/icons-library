import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

type KvEntry = {
  value: string
  /** Unix seconds; omit = no expiry */
  expiration?: number
}

type KvDisk = {
  entries: Record<string, KvEntry>
}

/**
 * Minimal KVNamespace stand-in for Node/Docker: get/put/delete/list + expirationTtl.
 * Persists to a JSON file so Compose volumes keep accounts across restarts.
 */
export class FileKv {
  private entries = new Map<string, KvEntry>()

  private constructor(private readonly filePath: string) {}

  static open(filePath: string): FileKv {
    const kv = new FileKv(filePath)
    kv.load()
    return kv
  }

  private load(): void {
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<KvDisk>
      if (parsed.entries && typeof parsed.entries === 'object') {
        for (const [key, entry] of Object.entries(parsed.entries)) {
          if (entry && typeof entry.value === 'string') {
            this.entries.set(key, {
              value: entry.value,
              expiration:
                typeof entry.expiration === 'number'
                  ? entry.expiration
                  : undefined,
            })
          }
        }
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        console.warn(`[file-kv] could not load ${this.filePath}:`, err)
      }
    }
    this.purgeExpired()
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const disk: KvDisk = { entries: {} }
    const now = Math.floor(Date.now() / 1000)
    for (const [key, entry] of this.entries) {
      if (entry.expiration !== undefined && entry.expiration <= now) continue
      disk.entries[key] = entry
    }
    const tmp = `${this.filePath}.${process.pid}.tmp`
    writeFileSync(tmp, `${JSON.stringify(disk)}\n`, 'utf8')
    renameSync(tmp, this.filePath)
  }

  private purgeExpired(): void {
    const now = Math.floor(Date.now() / 1000)
    let changed = false
    for (const [key, entry] of this.entries) {
      if (entry.expiration !== undefined && entry.expiration <= now) {
        this.entries.delete(key)
        changed = true
      }
    }
    if (changed) this.persist()
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired()
    const entry = this.entries.get(key)
    if (!entry) return null
    if (
      entry.expiration !== undefined &&
      entry.expiration <= Math.floor(Date.now() / 1000)
    ) {
      this.entries.delete(key)
      this.persist()
      return null
    }
    return entry.value
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    const entry: KvEntry = { value }
    if (
      typeof options?.expirationTtl === 'number' &&
      options.expirationTtl > 0
    ) {
      entry.expiration =
        Math.floor(Date.now() / 1000) + Math.floor(options.expirationTtl)
    }
    this.entries.set(key, entry)
    this.persist()
  }

  async delete(key: string): Promise<void> {
    if (this.entries.delete(key)) this.persist()
  }

  async list(options?: {
    prefix?: string
    cursor?: string
  }): Promise<{
    keys: Array<{ name: string; expiration?: number }>
    list_complete: boolean
    cursor?: string
  }> {
    this.purgeExpired()
    const prefix = options?.prefix ?? ''
    const all = [...this.entries.entries()]
      .filter(([name]) => (prefix ? name.startsWith(prefix) : true))
      .map(([name, entry]) => ({
        name,
        expiration: entry.expiration,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Single-page list (Worker pagination not needed at this scale).
    void options?.cursor
    return { keys: all, list_complete: true }
  }
}
