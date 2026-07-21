import type { Role } from './auth'
import { hashPassword, verifyPassword } from './password'

const USER_PREFIX = 'auth-user:'
const INVITE_PREFIX = 'auth-invite:'

/** Invite links expire after 7 days. */
export const INVITE_TTL_SECONDS = 60 * 60 * 24 * 7

export interface StoredUser {
  username: string
  passwordHash: string
  role: Role
  createdAt: string
}

export interface PublicUser {
  username: string
  role: Role
  createdAt: string
}

export interface StoredInvite {
  token: string
  role: Role
  createdBy: string
  createdAt: string
}

export interface PublicInvite {
  token: string
  role: Role
  createdBy: string
  createdAt: string
  expiresAt: string
}

function userKey(username: string): string {
  return `${USER_PREFIX}${username.trim().toLowerCase()}`
}

function inviteKey(token: string): string {
  return `${INVITE_PREFIX}${token.trim().toLowerCase()}`
}

export function normalizeUsername(raw: string): string {
  return raw.trim()
}

export function validateUsername(username: string): string | null {
  const name = normalizeUsername(username)
  if (name.length < 2 || name.length > 32) {
    return 'Username must be 2–32 characters'
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Username may use letters, numbers, . _ - (must start with alphanumeric)'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 128) return 'Password is too long'
  return null
}

export async function getStoredUser(
  kv: KVNamespace,
  username: string,
): Promise<StoredUser | null> {
  const raw = await kv.get(userKey(username))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUser>
    if (
      typeof parsed.username !== 'string' ||
      typeof parsed.passwordHash !== 'string' ||
      (parsed.role !== 'designer' && parsed.role !== 'dev') ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null
    }
    return {
      username: parsed.username,
      passwordHash: parsed.passwordHash,
      role: parsed.role,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

export async function putStoredUser(
  kv: KVNamespace,
  user: StoredUser,
): Promise<void> {
  await kv.put(userKey(user.username), JSON.stringify(user))
}

export async function createUser(
  kv: KVNamespace,
  opts: { username: string; password: string; role: Role },
): Promise<StoredUser> {
  const username = normalizeUsername(opts.username)
  const existing = await getStoredUser(kv, username)
  if (existing) {
    throw new Error('Username already taken')
  }
  const user: StoredUser = {
    username,
    passwordHash: await hashPassword(opts.password),
    role: opts.role,
    createdAt: new Date().toISOString(),
  }
  await putStoredUser(kv, user)
  return user
}

export async function verifyStoredUser(
  kv: KVNamespace,
  username: string,
  password: string,
): Promise<StoredUser | null> {
  const user = await getStoredUser(kv, username)
  if (!user) return null
  const ok = await verifyPassword(password, user.passwordHash)
  return ok ? user : null
}

export async function listUsers(kv: KVNamespace): Promise<PublicUser[]> {
  const users: PublicUser[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: USER_PREFIX, cursor })
    for (const key of page.keys) {
      const raw = await kv.get(key.name)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as Partial<StoredUser>
        if (
          typeof parsed.username !== 'string' ||
          (parsed.role !== 'designer' && parsed.role !== 'dev') ||
          typeof parsed.createdAt !== 'string'
        ) {
          continue
        }
        users.push({
          username: parsed.username,
          role: parsed.role,
          createdAt: parsed.createdAt,
        })
      } catch {
        // skip corrupt rows
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  users.sort((a, b) => a.username.localeCompare(b.username))
  return users
}

export async function createInvite(
  kv: KVNamespace,
  opts: { role: Role; createdBy: string },
): Promise<PublicInvite> {
  const token = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const invite: StoredInvite = {
    token,
    role: opts.role,
    createdBy: opts.createdBy,
    createdAt,
  }
  await kv.put(inviteKey(token), JSON.stringify(invite), {
    expirationTtl: INVITE_TTL_SECONDS,
  })
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_SECONDS * 1000,
  ).toISOString()
  return { ...invite, expiresAt }
}

export async function getInvite(
  kv: KVNamespace,
  token: string,
): Promise<StoredInvite | null> {
  const raw = await kv.get(inviteKey(token))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredInvite>
    if (
      typeof parsed.token !== 'string' ||
      (parsed.role !== 'designer' && parsed.role !== 'dev') ||
      typeof parsed.createdBy !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null
    }
    return {
      token: parsed.token,
      role: parsed.role,
      createdBy: parsed.createdBy,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

export async function deleteInvite(
  kv: KVNamespace,
  token: string,
): Promise<void> {
  await kv.delete(inviteKey(token))
}

export async function listInvites(kv: KVNamespace): Promise<PublicInvite[]> {
  const invites: PublicInvite[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: INVITE_PREFIX, cursor })
    for (const key of page.keys) {
      const raw = await kv.get(key.name)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as Partial<StoredInvite>
        if (
          typeof parsed.token !== 'string' ||
          (parsed.role !== 'designer' && parsed.role !== 'dev') ||
          typeof parsed.createdBy !== 'string' ||
          typeof parsed.createdAt !== 'string'
        ) {
          continue
        }
        const expiresAt =
          typeof key.expiration === 'number'
            ? new Date(key.expiration * 1000).toISOString()
            : new Date(
                Date.parse(parsed.createdAt) + INVITE_TTL_SECONDS * 1000,
              ).toISOString()
        invites.push({
          token: parsed.token,
          role: parsed.role,
          createdBy: parsed.createdBy,
          createdAt: parsed.createdAt,
          expiresAt,
        })
      } catch {
        // skip
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return invites
}

/** Lazy-migrate AUTH_USERS secret account into KV after a successful secret login. */
export async function upsertMigratedUser(
  kv: KVNamespace,
  opts: { username: string; password: string; role: Role },
): Promise<void> {
  const username = normalizeUsername(opts.username)
  const existing = await getStoredUser(kv, username)
  if (existing) return
  await putStoredUser(kv, {
    username,
    passwordHash: await hashPassword(opts.password),
    role: opts.role,
    createdAt: new Date().toISOString(),
  })
}
