export type Role = 'designer' | 'dev'

export interface AuthUser {
  username: string
  password: string
  role: Role
}

export interface SessionClaims {
  sub: string
  role: Role
  exp: number
}

export interface Env {
  GITHUB_TOKEN: string
  GITHUB_REPO: string
  SESSION_SECRET: string
  AUTH_USERS: string
  CORS_ORIGINS?: string
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) return false
  let out = 0
  for (let i = 0; i < aBytes.length; i++) {
    out |= aBytes[i]! ^ bBytes[i]!
  }
  return out === 0
}

export function parseUsers(raw: string): AuthUser[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AUTH_USERS must be valid JSON')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AUTH_USERS must be a non-empty JSON array')
  }
  const users: AuthUser[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const username =
      typeof row.username === 'string' ? row.username.trim() : ''
    const password = typeof row.password === 'string' ? row.password : ''
    const role = row.role === 'dev' || row.role === 'designer' ? row.role : null
    if (!username || !password || !role) continue
    users.push({ username, password, role })
  }
  if (users.length === 0) {
    throw new Error('AUTH_USERS has no valid accounts')
  }
  return users
}

export function findUser(
  users: AuthUser[],
  username: string,
  password: string,
): AuthUser | null {
  const needle = username.trim()
  for (const user of users) {
    if (user.username === needle && timingSafeEqual(user.password, password)) {
      return user
    }
  }
  return null
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(
  secret: string,
  claims: Omit<SessionClaims, 'exp'>,
  ttlSeconds = 60 * 60 * 12,
): Promise<string> {
  const payload: SessionClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson(payload)
  const data = `${header}.${body}`
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  )
  return `${data}.${b64url(sig)}`
}

export async function verifySession(
  secret: string,
  token: string,
): Promise<SessionClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts as [string, string, string]
  const data = `${header}.${body}`
  const key = await hmacKey(secret)
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(data),
  )
  if (!ok) return null
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (padded.length % 4)) % 4
    const json = atob(padded + '='.repeat(pad))
    const claims = JSON.parse(json) as SessionClaims
    if (
      typeof claims.sub !== 'string' ||
      (claims.role !== 'designer' && claims.role !== 'dev') ||
      typeof claims.exp !== 'number'
    ) {
      return null
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}
