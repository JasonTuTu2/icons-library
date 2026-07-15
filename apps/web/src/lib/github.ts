import {
  clearGithubSessionToken,
  getGithubSessionToken,
} from './githubAuth.js'

export type IconColorMode = 'mono' | 'preserved'

export interface IconUploadPayload {
  name: string
  content: string
  colorMode: IconColorMode
}

export interface StagedIcon {
  name: string
  colorMode: IconColorMode
  path: string
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const STAGING_BASE = 'packages/custom-icons/staging'

function getRepo(): string {
  return import.meta.env.VITE_GITHUB_REPO?.trim() ?? ''
}

/**
 * Token used for browser → GitHub API calls.
 * Prefer a session PAT (Connect button). Optional VITE_GITHUB_TOKEN is for local
 * .env only — Pages builds must NOT inject a write token.
 */
function getToken(): string {
  return (
    getGithubSessionToken() ||
    import.meta.env.VITE_GITHUB_TOKEN?.trim() ||
    ''
  )
}

export function isGithubRepoConfigured(): boolean {
  return getRepo().includes('/')
}

/** True when the UI can call GitHub write/dispatch APIs. */
export function isGithubAdminEnabled(): boolean {
  return isGithubRepoConfigured() && Boolean(getToken())
}

export function sanitizeIconName(raw: string): string | null {
  const base = raw
    .replace(/\.svg$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!base || !KEBAB.test(base)) return null
  return base
}

export function actionsUrl(): string {
  const repo = getRepo()
  return repo.includes('/')
    ? `https://github.com/${repo}/actions`
    : 'https://github.com/JasonTuTu2/icons-library/actions'
}

export function packagesUrl(): string {
  const repo = getRepo()
  const owner = repo.split('/')[0] || 'JasonTuTu2'
  return `https://github.com/${owner}?tab=packages`
}

function stagingDir(colorMode: IconColorMode): string {
  return colorMode === 'preserved' ? 'color' : 'mono'
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function githubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  const repo = getRepo()
  if (!repo.includes('/')) {
    throw new Error(
      'GitHub repo is not configured for this build (VITE_GITHUB_REPO).',
    )
  }
  if (!token) {
    throw new Error(
      'Connect with a GitHub PAT first (contents:write + actions:write).',
    )
  }

  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  return res
}

async function githubJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await githubFetch(path, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) detail = body.message
    } catch {
      // ignore
    }
    if (res.status === 401 || res.status === 403) {
      clearGithubSessionToken()
    }
    throw new Error(`GitHub API ${res.status}: ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function validateIcons(icons: IconUploadPayload[]): IconUploadPayload[] {
  if (icons.length === 0) {
    throw new Error('No icons to upload.')
  }

  return icons.map((icon) => {
    const name = sanitizeIconName(icon.name)
    if (!name) {
      throw new Error(
        `Invalid icon name "${icon.name}". Use kebab-case, e.g. billing-alert.`,
      )
    }
    const content = icon.content.trim()
    if (!content || !/<svg[\s>]/i.test(content)) {
      throw new Error(`"${icon.name}" must be an SVG document.`)
    }
    return {
      name,
      content,
      colorMode: icon.colorMode === 'preserved' ? 'preserved' : 'mono',
    }
  })
}

async function getFileSha(path: string): Promise<string | undefined> {
  const res = await githubFetch(`/contents/${path}`)
  if (res.status === 404) return undefined
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) detail = body.message
    } catch {
      // ignore
    }
    throw new Error(`GitHub API ${res.status}: ${detail}`)
  }
  const body = (await res.json()) as { sha?: string }
  return body.sha
}

/** Write icons into the shared staging folder (Contents API, no Action). */
export async function stageIcons(icons: IconUploadPayload[]): Promise<void> {
  const normalized = validateIcons(icons)

  for (const icon of normalized) {
    const dir = stagingDir(icon.colorMode)
    const path = `${STAGING_BASE}/${dir}/${icon.name}.svg`
    const sha = await getFileSha(path)
    const body: Record<string, string> = {
      message: `Stage icon gv:${icon.name}`,
      content: toBase64Utf8(`${icon.content}\n`),
      branch: 'main',
    }
    if (sha) body.sha = sha

    await githubJson(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }
}

async function listStagingDir(
  dir: 'mono' | 'color',
  colorMode: IconColorMode,
): Promise<StagedIcon[]> {
  const res = await githubFetch(`/contents/${STAGING_BASE}/${dir}`)
  if (res.status === 404) return []
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) detail = body.message
    } catch {
      // ignore
    }
    throw new Error(`GitHub API ${res.status}: ${detail}`)
  }

  const entries = (await res.json()) as Array<{
    name: string
    path: string
    type: string
  }>

  if (!Array.isArray(entries)) return []

  return entries
    .filter(
      (entry) =>
        entry.type === 'file' &&
        entry.name.toLowerCase().endsWith('.svg') &&
        !entry.name.startsWith('.'),
    )
    .map((entry) => ({
      name: entry.name.replace(/\.svg$/i, ''),
      colorMode,
      path: entry.path,
    }))
}

/** List all staged SVGs currently on main. */
export async function listStagedIcons(): Promise<StagedIcon[]> {
  const [mono, color] = await Promise.all([
    listStagingDir('mono', 'mono'),
    listStagingDir('color', 'preserved'),
  ])
  return [...mono, ...color].sort((a, b) => a.name.localeCompare(b.name))
}

/** Promote whatever is staged now into the library (one Action). */
export async function dispatchApplyStaged(): Promise<void> {
  await githubJson('/actions/workflows/apply-staged-icons.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' }),
  })
}

export async function dispatchPublish(): Promise<void> {
  await githubJson('/actions/workflows/publish-packages.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' }),
  })
}
