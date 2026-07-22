import { serve } from '@hono/node-server'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './index'
import type { Env } from './auth'
import { FileKv } from './fileKv'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env ${name}`)
  }
  return value
}

function createEnv(): Env {
  const defaultKv = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../.data/kv.json',
  )
  const kvPath = process.env.AUTH_KV_PATH?.trim() || defaultKv
  const kv = FileKv.open(kvPath)
  return {
    GITHUB_TOKEN: required('GITHUB_TOKEN'),
    GITHUB_REPO: required('GITHUB_REPO'),
    SESSION_SECRET: required('SESSION_SECRET'),
    AUTH_USERS: process.env.AUTH_USERS?.trim() || '[]',
    CORS_ORIGINS: process.env.CORS_ORIGINS?.trim(),
    STAGING_HANDOFF: kv as unknown as KVNamespace,
  }
}

const port = Number(process.env.PORT || 8787)
const env = createEnv()

console.log(`[auth-api] listening on http://0.0.0.0:${port}`)

serve({
  port,
  fetch: (request) => app.fetch(request, env),
})
