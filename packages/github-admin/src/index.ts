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

export interface GithubAdminConfig {
  token: string
  repo: string
}

export interface PublishReadiness {
  /** Custom SVGs applied to the library since the last package version publish. */
  hasNewIcons: boolean
  /** Icons still sitting in staging (not yet Apply'd). */
  stagedCount: number
}

export interface IconNameConflict {
  name: string
  location:
    | 'library-mono'
    | 'library-color'
    | 'staging-mono'
    | 'staging-color'
}

export interface DispatchPublishOptions {
  /**
   * Library SVG paths to omit from this publish (unchecked unpublished icons).
   * Held aside during version/publish, then restored to the library afterward
   * so they remain unpublished for a later release — not demoted to staging.
   */
  deferPaths?: string[]
}

export interface GithubAdminClient {
  stageIcons(icons: IconUploadPayload[]): Promise<void>
  listStagedIcons(): Promise<StagedIcon[]>
  listUnpublishedIcons(): Promise<StagedIcon[]>
  /** Existing library / staging files that collide with these kebab names. */
  findIconNameConflicts(names: string[]): Promise<IconNameConflict[]>
  getPublishReadiness(): Promise<PublishReadiness>
  dispatchApplyStaged(): Promise<void>
  dispatchPublish(options?: DispatchPublishOptions): Promise<void>
}

/** Thrown when GitHub rejects credentials (401/403). Callers should clear stored tokens. */
export class GithubAuthError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(`GitHub API ${status}: ${detail}`)
    this.name = 'GithubAuthError'
    this.status = status
  }
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const STAGING_BASE = 'packages/custom-icons/staging'
const DEFAULT_REPO = 'JasonTuTu2/icons-library'

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

export function isValidRepo(repo: string): boolean {
  return repo.includes('/')
}

export function actionsUrl(repo: string): string {
  return isValidRepo(repo)
    ? `https://github.com/${repo}/actions`
    : `https://github.com/${DEFAULT_REPO}/actions`
}

/** Deep link to a specific workflow’s run history. */
export function actionsWorkflowUrl(repo: string, workflowFile: string): string {
  const base = isValidRepo(repo) ? repo : DEFAULT_REPO
  const file = workflowFile.replace(/^.*\//, '')
  return `https://github.com/${base}/actions/workflows/${file}`
}

export function packagesUrl(repo: string): string {
  const owner = (isValidRepo(repo) ? repo : DEFAULT_REPO).split('/')[0] || 'JasonTuTu2'
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

export function createGithubAdminClient(
  config: GithubAdminConfig,
): GithubAdminClient {
  const repo = config.repo.trim()
  const token = config.token.trim()

  async function githubFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    if (!isValidRepo(repo)) {
      throw new Error('GitHub repo is not configured (expected owner/repo).')
    }
    if (!token) {
      throw new Error(
        'Connect with a GitHub PAT first (contents:write + actions:write).',
      )
    }

    return fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
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
        throw new GithubAuthError(res.status, detail)
      }
      throw new Error(`GitHub API ${res.status}: ${detail}`)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
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
      if (res.status === 401 || res.status === 403) {
        throw new GithubAuthError(res.status, detail)
      }
      throw new Error(`GitHub API ${res.status}: ${detail}`)
    }
    const body = (await res.json()) as { sha?: string }
    return body.sha
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
      if (res.status === 401 || res.status === 403) {
        throw new GithubAuthError(res.status, detail)
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

  return {
    async stageIcons(icons: IconUploadPayload[]): Promise<void> {
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
    },

    async listStagedIcons(): Promise<StagedIcon[]> {
      const [mono, color] = await Promise.all([
        listStagingDir('mono', 'mono'),
        listStagingDir('color', 'preserved'),
      ])
      return [...mono, ...color].sort((a, b) => a.name.localeCompare(b.name))
    },

    async listUnpublishedIcons(): Promise<StagedIcon[]> {
      const commits = await githubJson<
        Array<{ sha: string; commit: { message: string } }>
      >('/commits?sha=main&per_page=50')

      const publishCommit = commits.find((entry) =>
        /Version packages/i.test(entry.commit.message),
      )

      // No prior publish — treat everything as already "published" for this list
      // (avoid dumping the whole library). Empty list; Publish warn still allows.
      if (!publishCommit) {
        return []
      }

      if (commits[0]?.sha === publishCommit.sha) {
        return []
      }

      const compare = await githubJson<{
        files?: Array<{ filename: string; status?: string }>
      }>(`/compare/${publishCommit.sha}...main`)

      const icons: StagedIcon[] = []
      for (const file of compare.files ?? []) {
        if (file.status === 'removed') continue
        const path = file.filename.replace(/\\/g, '/')
        if (
          !path.startsWith('packages/custom-icons/svg/') ||
          !path.toLowerCase().endsWith('.svg') ||
          path.includes('/staging/')
        ) {
          continue
        }
        const base = path.split('/').pop()!.replace(/\.svg$/i, '')
        const colorMode: IconColorMode = path.includes('/svg/color/')
          ? 'preserved'
          : 'mono'
        icons.push({ name: base, colorMode, path })
      }

      return icons.sort((a, b) => a.name.localeCompare(b.name))
    },

    async findIconNameConflicts(names: string[]): Promise<IconNameConflict[]> {
      const unique = [
        ...new Set(
          names
            .map((n) => sanitizeIconName(n))
            .filter((n): n is string => Boolean(n)),
        ),
      ]
      const conflicts: IconNameConflict[] = []

      for (const name of unique) {
        const checks: Array<{
          path: string
          location: IconNameConflict['location']
        }> = [
          {
            path: `packages/custom-icons/svg/${name}.svg`,
            location: 'library-mono',
          },
          {
            path: `packages/custom-icons/svg/color/${name}.svg`,
            location: 'library-color',
          },
          {
            path: `${STAGING_BASE}/mono/${name}.svg`,
            location: 'staging-mono',
          },
          {
            path: `${STAGING_BASE}/color/${name}.svg`,
            location: 'staging-color',
          },
        ]
        for (const check of checks) {
          const sha = await getFileSha(check.path)
          if (sha) conflicts.push({ name, location: check.location })
        }
      }

      return conflicts
    },

    async getPublishReadiness(): Promise<PublishReadiness> {
      const staged = await this.listStagedIcons()
      const stagedCount = staged.length

      const commits = await githubJson<
        Array<{ sha: string; commit: { message: string } }>
      >('/commits?sha=main&per_page=50')

      const publishCommit = commits.find((entry) =>
        /Version packages/i.test(entry.commit.message),
      )

      // No prior publish on record — don't block with the "no new icons" warn.
      if (!publishCommit) {
        return { hasNewIcons: true, stagedCount }
      }

      const unpublished = await this.listUnpublishedIcons()
      return {
        hasNewIcons: unpublished.length > 0,
        stagedCount,
      }
    },

    async dispatchApplyStaged(): Promise<void> {
      await githubJson('/actions/workflows/apply-staged-icons.yml/dispatches', {
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
      })
    },

    async dispatchPublish(options?: DispatchPublishOptions): Promise<void> {
      const deferPaths = (options?.deferPaths ?? []).filter((p) =>
        p.startsWith('packages/custom-icons/svg/'),
      )
      await githubJson('/actions/workflows/publish-packages.yml/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            defer_paths: JSON.stringify(deferPaths),
          },
        }),
      })
    },
  }
}
