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
import {
  deleteStagingHandoff,
  isHandoffId,
  putStagingHandoff,
  readStagingHandoff,
} from './stagingHandoff'
import {
  createInvite,
  createUser,
  deleteInvite,
  getInvite,
  getStoredUser,
  listInvites,
  listUsers,
  upsertMigratedUser,
  validatePassword,
  validateUsername,
  verifyStoredUser,
} from './usersKv'
import {
  deleteUserStaging,
  putUserStaging,
  readUserStaging,
} from './userStaging'

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
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

  const existingKv = await getStoredUser(c.env.STAGING_HANDOFF, username)
  if (existingKv) {
    const kvUser = await verifyStoredUser(
      c.env.STAGING_HANDOFF,
      username,
      password,
    )
    if (!kvUser) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }
    const token = await signSession(c.env.SESSION_SECRET, {
      sub: kvUser.username,
      role: kvUser.role,
    })
    return c.json({
      token,
      username: kvUser.username,
      role: kvUser.role,
    })
  }

  // Bootstrap / fallback: AUTH_USERS secret (lazy-migrates into KV on success).
  let secretUser: ReturnType<typeof findUser> = null
  try {
    const users = parseUsers(c.env.AUTH_USERS)
    secretUser = findUser(users, username, password)
  } catch {
    // Secret missing or invalid — only KV accounts can sign in.
  }
  if (!secretUser) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  try {
    await upsertMigratedUser(c.env.STAGING_HANDOFF, {
      username: secretUser.username,
      password,
      role: secretUser.role,
    })
  } catch {
    // Migration failure should not block login.
  }

  const token = await signSession(c.env.SESSION_SECRET, {
    sub: secretUser.username,
    role: secretUser.role,
  })

  return c.json({
    token,
    username: secretUser.username,
    role: secretUser.role,
  })
})

/** Peek invite (public) — used by the invite redeem form. */
app.get('/api/invites/:token', async (c) => {
  const token = c.req.param('token')?.trim() ?? ''
  if (!token) return c.json({ error: 'Missing invite token' }, 400)
  const invite = await getInvite(c.env.STAGING_HANDOFF, token)
  if (!invite) {
    return c.json({ error: 'Invite expired or not found' }, 404)
  }
  return c.json({ role: invite.role, valid: true })
})

/** Redeem invite: create account + return session (public). */
app.post('/api/invites/:token/redeem', async (c) => {
  const token = c.req.param('token')?.trim() ?? ''
  if (!token) return c.json({ error: 'Missing invite token' }, 400)

  let body: { username?: string; password?: string }
  try {
    body = (await c.req.json()) as { username?: string; password?: string }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const username = body.username?.trim() ?? ''
  const password = body.password ?? ''
  const usernameError = validateUsername(username)
  if (usernameError) return c.json({ error: usernameError }, 400)
  const passwordError = validatePassword(password)
  if (passwordError) return c.json({ error: passwordError }, 400)

  const invite = await getInvite(c.env.STAGING_HANDOFF, token)
  if (!invite) {
    return c.json({ error: 'Invite expired or not found' }, 404)
  }

  try {
    const user = await createUser(c.env.STAGING_HANDOFF, {
      username,
      password,
      role: invite.role,
    })
    await deleteInvite(c.env.STAGING_HANDOFF, token)
    const sessionToken = await signSession(c.env.SESSION_SECRET, {
      sub: user.username,
      role: user.role,
    })
    return c.json({
      token: sessionToken,
      username: user.username,
      role: user.role,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Username already taken') {
      return c.json({ error: message }, 409)
    }
    return c.json({ error: message }, 502)
  }
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

/** List KV accounts (dev only). AUTH_USERS secret accounts appear after first login. */
authed.get('/users', async (c) => {
  if (c.get('role') !== 'dev') {
    return c.json({ error: 'Listing users requires a developer account' }, 403)
  }
  try {
    return c.json({ users: await listUsers(c.env.STAGING_HANDOFF) })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

/** Create invite link (dev only). */
authed.post('/invites', async (c) => {
  if (c.get('role') !== 'dev') {
    return c.json({ error: 'Creating invites requires a developer account' }, 403)
  }
  let body: { role?: string }
  try {
    body = (await c.req.json()) as { role?: string }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const role = body.role === 'dev' || body.role === 'designer' ? body.role : null
  if (!role) {
    return c.json({ error: 'role must be designer or dev' }, 400)
  }
  try {
    const invite = await createInvite(c.env.STAGING_HANDOFF, {
      role,
      createdBy: c.get('username'),
    })
    return c.json(invite)
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/invites', async (c) => {
  if (c.get('role') !== 'dev') {
    return c.json({ error: 'Listing invites requires a developer account' }, 403)
  }
  try {
    return c.json({ invites: await listInvites(c.env.STAGING_HANDOFF) })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.delete('/invites/:token', async (c) => {
  if (c.get('role') !== 'dev') {
    return c.json({ error: 'Revoking invites requires a developer account' }, 403)
  }
  const token = c.req.param('token')?.trim() ?? ''
  if (!token) return c.json({ error: 'Missing invite token' }, 400)
  try {
    await deleteInvite(c.env.STAGING_HANDOFF, token)
    return c.json({ ok: true })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

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

authed.post('/clear-remote-staging', async (c) => {
  try {
    const { complete } = await githubClient(c.env).clearRemoteStagingBatch(12)
    return c.json({ ok: true, complete })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.post('/stage-removals', async (c) => {
  let body: { removals?: string[] }
  try {
    body = (await c.req.json()) as { removals?: string[] }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const removals = Array.isArray(body.removals) ? body.removals : []
  if (removals.length === 0) {
    return c.json({ error: 'No removals to stage' }, 400)
  }
  try {
    await githubClient(c.env).stageRemovals(removals)
  } catch (err) {
    return c.json(githubError(err), 502)
  }
  return c.json({ ok: true, staged: removals.length })
})

authed.post('/dispatch-apply-staged', async (c) => {
  try {
    await githubClient(c.env).dispatchApplyStaged()
  } catch (err) {
    return c.json(githubError(err), 502)
  }
  return c.json({ ok: true })
})

/** @deprecated Prefer stepped apply from the browser (subrequest limits). */
authed.post('/apply-legacy', async (c) => {
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

/** Figma plugin: write to packages/custom-icons/staging (Contents API). */
authed.post('/stage-icons', async (c) => {
  let body: { icons?: IconUploadPayload[] }
  try {
    body = (await c.req.json()) as { icons?: IconUploadPayload[] }
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const icons = Array.isArray(body.icons) ? body.icons : []
  if (icons.length === 0) {
    return c.json({ error: 'No icons to stage' }, 400)
  }
  try {
    await githubClient(c.env).stageIcons(icons)
  } catch (err) {
    return c.json(githubError(err), 502)
  }
  return c.json({ ok: true, staged: icons.length })
})

authed.get('/staged-icons', async (c) => {
  try {
    return c.json(await githubClient(c.env).listStagedIcons())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/staged-removals', async (c) => {
  try {
    return c.json(await githubClient(c.env).listStagedRemovals())
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

/** Short-lived plugin → browser queue (Workers Cache, ~15 min). */
authed.post('/staging-handoff', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid body' }, 400)
  }
  const row = body as { v?: number; icons?: unknown; removals?: unknown }
  if (row.v !== 1 || !Array.isArray(row.icons) || !Array.isArray(row.removals)) {
    return c.json({ error: 'Expected { v: 1, icons, removals }' }, 400)
  }
  if (row.icons.length === 0 && row.removals.length === 0) {
    return c.json({ error: 'Nothing to hand off' }, 400)
  }

  const id = crypto.randomUUID()
  try {
    await putStagingHandoff(c.env.STAGING_HANDOFF, id, JSON.stringify(body))
  } catch (err) {
    return c.json(githubError(err), 502)
  }
  return c.json({ id })
})

authed.get('/staging-handoff/:id', async (c) => {
  const id = c.req.param('id')?.trim() ?? ''
  if (!isHandoffId(id)) {
    return c.json({ error: 'Invalid handoff id' }, 400)
  }
  try {
    const raw = await readStagingHandoff(c.env.STAGING_HANDOFF, id)
    if (!raw) {
      return c.json({ error: 'Handoff expired or not found' }, 404)
    }
    return c.json(JSON.parse(raw) as unknown)
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.delete('/staging-handoff/:id', async (c) => {
  const id = c.req.param('id')?.trim() ?? ''
  if (!isHandoffId(id)) {
    return c.json({ error: 'Invalid handoff id' }, 400)
  }
  try {
    await deleteStagingHandoff(c.env.STAGING_HANDOFF, id)
    return c.json({ ok: true })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

function parseStagingBody(body: unknown): {
  v: 1
  icons: unknown[]
  removals: unknown[]
} | null {
  if (!body || typeof body !== 'object') return null
  const row = body as { v?: number; icons?: unknown; removals?: unknown }
  if (row.v !== 1 || !Array.isArray(row.icons) || !Array.isArray(row.removals)) {
    return null
  }
  return { v: 1, icons: row.icons, removals: row.removals }
}

/**
 * Account-scoped staging queue (plugin Stage + browser). Survives across devices
 * for the same login (~7 days). Not the shared GitHub staging/ folder.
 */
authed.put('/my-staging', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const parsed = parseStagingBody(body)
  if (!parsed) {
    return c.json({ error: 'Expected { v: 1, icons, removals }' }, 400)
  }
  const username = c.get('username')
  try {
    if (parsed.icons.length === 0 && parsed.removals.length === 0) {
      await deleteUserStaging(c.env.STAGING_HANDOFF, username)
      return c.json({ ok: true, empty: true })
    }
    await putUserStaging(c.env.STAGING_HANDOFF, username, JSON.stringify(parsed))
    return c.json({
      ok: true,
      icons: parsed.icons.length,
      removals: parsed.removals.length,
    })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.get('/my-staging', async (c) => {
  const username = c.get('username')
  try {
    const raw = await readUserStaging(c.env.STAGING_HANDOFF, username)
    if (!raw) {
      return c.json({ v: 1, icons: [], removals: [] })
    }
    const parsed = parseStagingBody(JSON.parse(raw) as unknown)
    if (!parsed) {
      return c.json({ v: 1, icons: [], removals: [] })
    }
    return c.json(parsed)
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

authed.delete('/my-staging', async (c) => {
  const username = c.get('username')
  try {
    await deleteUserStaging(c.env.STAGING_HANDOFF, username)
    return c.json({ ok: true })
  } catch (err) {
    return c.json(githubError(err), 502)
  }
})

app.route('/api', authed)

export default app
