import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  createGithubAdminClient,
  type DispatchPublishOptions,
  type IconSource,
  type IconUploadPayload,
  type IconUsage,
  type IconVariant,
} from '@JasonTuTu2/github-admin'
import {
  findUser,
  parseUsers,
  signSession,
  verifySession,
  type Env,
  type Role,
} from './auth'

type Variables = {
  username: string
  role: Role
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const allowed = new Set(origins.map((o) => o.toLowerCase()))
  return cors({
    origin: (origin) => {
      if (!origin) return origins[0] ?? '*'
      const lower = origin.toLowerCase()
      if (allowed.has(lower)) return origin
      if (
        lower.startsWith('http://localhost:') ||
        lower.startsWith('http://127.0.0.1:')
      ) {
        return origin
      }
      // GitHub Pages usernames are case-insensitive in practice; accept any
      // github.io host that matches an allowed pages host ignoring case.
      try {
        const host = new URL(origin).hostname.toLowerCase()
        for (const allowedOrigin of origins) {
          const allowedHost = new URL(allowedOrigin).hostname.toLowerCase()
          if (host === allowedHost) return origin
        }
      } catch {
        // ignore
      }
      return ''
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

app.post('/api/login', async (c) => {
  let body: { username?: string; password?: string }
  try {
    body = (await c.req.json()) as { username?: string; password?: string }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const username = body.username?.trim() ?? ''
  const password = body.password ?? ''
  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400)
  }

  let users
  try {
    users = parseUsers(c.env.AUTH_USERS)
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Auth misconfigured' },
      500,
    )
  }

  const user = findUser(users, username, password)
  if (!user) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const token = await signSession(c.env.SESSION_SECRET, {
    sub: user.username,
    role: user.role,
  })

  return c.json({
    token,
    username: user.username,
    role: user.role,
  })
})

const authed = new Hono<{ Bindings: Env; Variables: Variables }>()

authed.use('*', async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match?.[1]) {
    return c.json({ error: 'Missing Authorization Bearer token' }, 401)
  }
  const claims = await verifySession(c.env.SESSION_SECRET, match[1].trim())
  if (!claims) {
    return c.json({ error: 'Invalid or expired session' }, 401)
  }
  c.set('username', claims.sub)
  c.set('role', claims.role)
  await next()
})

authed.get('/me', (c) =>
  c.json({
    username: c.get('username'),
    role: c.get('role'),
  }),
)

function githubClient(env: Env) {
  const token = env.GITHUB_TOKEN?.trim()
  const repo = env.GITHUB_REPO?.trim()
  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set')
  }
  return createGithubAdminClient({ token, repo })
}

function githubError(err: unknown) {
  return {
    error: err instanceof Error ? err.message : String(err),
  }
}

/** Live metadata.json from the repo (sidebar / catalog properties). */
authed.get('/metadata', async (c) => {
  try {
    return c.json(await githubClient(c.env).getCustomMetadata())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

/** Patch category / variant / source / usage / note for one custom icon. */
authed.post('/icon-metadata', async (c) => {
  let body: {
    name?: string
    patch?: {
      category?: string
      variant?: IconVariant
      source?: IconSource
      usage?: IconUsage
      note?: string
    }
  }
  try {
    body = (await c.req.json()) as typeof body
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const name = body.name?.trim() ?? ''
  if (!name || !body.patch || typeof body.patch !== 'object') {
    return c.json({ error: 'name and patch required' }, 400)
  }
  try {
    await githubClient(c.env).updateIconMetadata(name, body.patch)
    return c.json({ ok: true })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

/** Library name collisions for staging checks. */
authed.post('/library-conflicts', async (c) => {
  let body: { names?: string[] }
  try {
    body = (await c.req.json()) as { names?: string[] }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const names = Array.isArray(body.names) ? body.names : []
  try {
    const conflicts = await githubClient(c.env).findLibraryNameConflicts(names)
    return c.json({ conflicts })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/unpublished-icons', async (c) => {
  try {
    return c.json(await githubClient(c.env).listUnpublishedIcons())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/unpublished-removals', async (c) => {
  try {
    return c.json(await githubClient(c.env).listUnpublishedRemovals())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/publish-history', async (c) => {
  const limitRaw = c.req.query('limit')
  const limit = limitRaw ? Number(limitRaw) : undefined
  try {
    return c.json(
      await githubClient(c.env).listPublishHistory(
        Number.isFinite(limit) ? { limit } : undefined,
      ),
    )
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/publish-readiness', async (c) => {
  try {
    return c.json(await githubClient(c.env).getPublishReadiness())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/published-version', async (c) => {
  try {
    const version = await githubClient(c.env).getPublishedPackageVersion()
    return c.json({ version })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/library-asset-path', async (c) => {
  const name = c.req.query('name')?.trim() ?? ''
  if (!name) return c.json({ error: 'name required' }, 400)
  try {
    const path = await githubClient(c.env).findLibraryAssetPath(name)
    return c.json({ path })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/asset-preview', async (c) => {
  const path = c.req.query('path')?.trim() ?? ''
  if (!path) return c.json({ error: 'path required' }, 400)
  try {
    const preview = await githubClient(c.env).getAssetPreview(path)
    return c.json({ preview })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.post('/apply', async (c) => {
  let body: { icons?: IconUploadPayload[]; removals?: string[] }
  try {
    body = (await c.req.json()) as {
      icons?: IconUploadPayload[]
      removals?: string[]
    }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const icons = Array.isArray(body.icons) ? body.icons : []
  const removals = Array.isArray(body.removals) ? body.removals : []
  if (icons.length === 0 && removals.length === 0) {
    return c.json({ error: 'Nothing to apply' }, 400)
  }

  try {
    const client = githubClient(c.env)
    await client.clearRemoteStaging()
    if (icons.length > 0) await client.stageIcons(icons)
    if (removals.length > 0) await client.stageRemovals(removals)
    await client.dispatchApplyStaged()
  } catch (err) {
    return c.json(githubError(err), 502)
  }

  return c.json({
    ok: true,
    username: c.get('username'),
    appliedAdds: icons.length,
    appliedRemovals: removals.length,
  })
})

authed.post('/publish', async (c) => {
  if (c.get('role') !== 'dev') {
    return c.json({ error: 'Publish requires a developer account' }, 403)
  }

  let body: DispatchPublishOptions = {}
  try {
    body = (await c.req.json()) as DispatchPublishOptions
  } catch {
    body = {}
  }

  try {
    const client = githubClient(c.env)
    await client.dispatchPublish(body)
  } catch (err) {
    return c.json(githubError(err), 502)
  }

  return c.json({
    ok: true,
    username: c.get('username'),
  })
})

app.route('/api', authed)

export default app
