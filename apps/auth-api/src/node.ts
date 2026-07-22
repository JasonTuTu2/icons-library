/**
 * Node/Docker entry for the auth API (same Hono app as the Cloudflare Worker).
 *
 * Prefers Redis when REDIS_URL is set (Compose); otherwise file KV.
 *
 *   pnpm --filter @JasonTuTu2/icons-auth-api start:node
 */
import { serve } from '@hono/node-server'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './index'
import type { Env } from './auth'
import { FileKv } from './fileKv'
import { RedisKv } from './redisKv'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env ${name}`)
  }
  return value
}

async function createKv(): Promise<KVNamespace> {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (redisUrl) {
    const kv = await RedisKv.connect(redisUrl)
    console.log(`[auth-api] storage=redis (${redisUrl.replace(/\/\/.*@/, '//***@')})`)
    return kv as unknown as KVNamespace
  }
  const defaultKv = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../.data/kv.json',
  )
  const kvPath = process.env.AUTH_KV_PATH?.trim() || defaultKv
  console.log(`[auth-api] storage=file (${kvPath})`)
  return FileKv.open(kvPath) as unknown as KVNamespace
}

async function main() {
  const port = Number(process.env.PORT || 8787)
  const env: Env = {
    GITHUB_TOKEN: required('GITHUB_TOKEN'),
    GITHUB_REPO: required('GITHUB_REPO'),
    SESSION_SECRET: required('SESSION_SECRET'),
    AUTH_USERS: process.env.AUTH_USERS?.trim() || '[]',
    CORS_ORIGINS: process.env.CORS_ORIGINS?.trim(),
    STAGING_HANDOFF: await createKv(),
  }

  console.log(`[auth-api] listening on http://0.0.0.0:${port}`)
  serve({
    port,
    fetch: (request) => app.fetch(request, env),
  })
}

main().catch((err) => {
  console.error('[auth-api] failed to start:', err)
  process.exit(1)
})
