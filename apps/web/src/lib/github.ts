export type IconColorMode = 'mono' | 'preserved'

export interface IconUploadPayload {
  name: string
  content: string
  colorMode: IconColorMode
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const BATCH_SIZE = 5

function getConfig() {
  const token = import.meta.env.VITE_GITHUB_TOKEN?.trim() ?? ''
  const repo = import.meta.env.VITE_GITHUB_REPO?.trim() ?? ''
  return { token, repo }
}

export function isGithubAdminEnabled(): boolean {
  const { token, repo } = getConfig()
  return Boolean(token && repo.includes('/'))
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
  const { repo } = getConfig()
  return `https://github.com/${repo}/actions`
}

export function packagesUrl(): string {
  const { repo } = getConfig()
  const owner = repo.split('/')[0] ?? 'JasonTuTu2'
  return `https://github.com/${owner}?tab=packages`
}

async function githubFetch(path: string, init: RequestInit): Promise<void> {
  const { token, repo } = getConfig()
  if (!token || !repo) {
    throw new Error('GitHub upload/publish is not configured for this build.')
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
}

/** Fire repository_dispatch in small batches to keep payloads small. */
export async function dispatchIconUpload(
  icons: IconUploadPayload[],
): Promise<void> {
  if (icons.length === 0) {
    throw new Error('No icons to upload.')
  }

  for (const icon of icons) {
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
  }

  const normalized = icons.map((icon) => ({
    name: sanitizeIconName(icon.name)!,
    content: icon.content.trim(),
    colorMode: icon.colorMode === 'preserved' ? 'preserved' : 'mono',
  }))

  for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
    const batch = normalized.slice(i, i + BATCH_SIZE)
    await githubFetch('/dispatches', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'icon-upload',
        client_payload: { icons: batch },
      }),
    })
  }
}

export async function dispatchPublish(): Promise<void> {
  await githubFetch('/actions/workflows/publish-packages.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' }),
  })
}
