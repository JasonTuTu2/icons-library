export type IconColorMode = 'mono' | 'preserved' | 'gradient'
export type AssetKind = 'svg' | 'image'
export type ImageFormat = 'png' | 'jpg' | 'jpeg'

export interface IconUploadPayload {
  name: string
  /** SVG document text, or base64 for images (no data: URL prefix). */
  content: string
  /** Required for SVG; ignored for images. */
  colorMode?: IconColorMode
  /** Defaults to svg. */
  kind?: AssetKind
  /** Required when kind is image. */
  format?: ImageFormat
}

export interface StagedIcon {
  name: string
  path: string
  kind: AssetKind
  /** SVG only. */
  colorMode?: IconColorMode
  /** Image only. */
  format?: ImageFormat
}

/** Tombstone in staging/remove — Apply deletes matching library SVG(s) and/or image. */
export interface StagedRemoval {
  name: string
  path: string
}

export interface GithubAdminConfig {
  token: string
  repo: string
}

export interface PublishReadiness {
  /** Custom SVG/image adds/removes applied to the library since the last package version publish. */
  hasNewIcons: boolean
  /** Staged adds + removal markers waiting for Apply. */
  stagedCount: number
  stagedAddCount: number
  stagedRemovalCount: number
}

export interface IconNameConflict {
  name: string
  location:
    | 'library-mono'
    | 'library-color'
    | 'library-gradient'
    | 'library-image'
    | 'staging-mono'
    | 'staging-color'
    | 'staging-gradient'
    | 'staging-image'
    | 'staging-remove'
}

export interface DispatchPublishOptions {
  /**
   * Library SVG/image paths to omit from this publish (unchecked unpublished icons).
   * Held aside during version/publish, then restored to the library afterward
   * so they remain unpublished for a later release — not demoted to staging.
   */
  deferPaths?: string[]
}

export interface GithubAdminClient {
  stageIcons(icons: IconUploadPayload[]): Promise<void>
  stageRemovals(names: string[]): Promise<void>
  unstageRemoval(name: string): Promise<void>
  listStagedIcons(): Promise<StagedIcon[]>
  listStagedRemovals(): Promise<StagedRemoval[]>
  listUnpublishedIcons(): Promise<StagedIcon[]>
  /** Library SVGs deleted (Apply removal) since the last package publish. */
  listUnpublishedRemovals(): Promise<StagedRemoval[]>
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
const REMOVE_DIR = `${STAGING_BASE}/remove`
const IMAGES_DIR = 'packages/custom-icons/images'
const STAGING_IMAGES = `${STAGING_BASE}/images`
const DEFAULT_REPO = 'JasonTuTu2/icons-library'
const IMAGE_EXTS = ['png', 'jpg', 'jpeg'] as const

function removalMarkerPath(name: string): string {
  return `${REMOVE_DIR}/${name}.remove`
}

function parseImageFormat(raw: string): ImageFormat | null {
  const ext = raw.replace(/^\./, '').toLowerCase()
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return ext
  return null
}

function stripDataUrlBase64(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^data:[^;]+;base64,(.+)$/i)
  return (match?.[1] ?? trimmed).replace(/\s+/g, '')
}

export function sanitizeIconName(raw: string): string | null {
  const base = raw
    .replace(/\.(svg|png|jpe?g)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!base || !KEBAB.test(base)) return null
  return base
}

function findImageFileName(
  fileNames: Set<string>,
  name: string,
): string | undefined {
  for (const ext of IMAGE_EXTS) {
    if (fileNames.has(`${name}.${ext}`)) return `${name}.${ext}`
  }
  return undefined
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
  if (colorMode === 'preserved') return 'color'
  if (colorMode === 'gradient') return 'gradient'
  return 'mono'
}

function normalizeColorMode(value: IconColorMode | undefined): IconColorMode {
  if (value === 'preserved' || value === 'gradient') return value
  return 'mono'
}

function colorModeFromLibraryPath(path: string): IconColorMode {
  if (path.includes('/svg/gradient/')) return 'gradient'
  if (path.includes('/svg/color/')) return 'preserved'
  return 'mono'
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

    const kind: AssetKind = icon.kind === 'image' ? 'image' : 'svg'

    if (kind === 'image') {
      const format = parseImageFormat(icon.format ?? '')
      if (!format) {
        throw new Error(
          `"${icon.name}" image uploads require format png, jpg, or jpeg.`,
        )
      }
      const content = stripDataUrlBase64(icon.content)
      if (!content) {
        throw new Error(`"${icon.name}" image content is empty.`)
      }
      return { name, content, kind, format }
    }

    const content = icon.content.trim()
    if (!content || !/<svg[\s>]/i.test(content)) {
      throw new Error(`"${icon.name}" must be an SVG document.`)
    }
    return {
      name,
      content,
      kind: 'svg' as const,
      colorMode: normalizeColorMode(icon.colorMode),
    }
  })
}

function isLibraryAssetPath(path: string): boolean {
  const p = path.replace(/\\/g, '/')
  if (p.includes('/staging/') || p.includes('/.publish-hold/')) return false
  if (
    p.startsWith('packages/custom-icons/svg/') &&
    p.toLowerCase().endsWith('.svg')
  ) {
    return true
  }
  if (
    p.startsWith(`${IMAGES_DIR}/`) &&
    /\.(png|jpe?g)$/i.test(p)
  ) {
    return true
  }
  return false
}

function stagedFromLibraryPath(path: string): StagedIcon | null {
  const p = path.replace(/\\/g, '/')
  if (!isLibraryAssetPath(p)) return null
  const base = p.split('/').pop()!
  if (p.startsWith(`${IMAGES_DIR}/`)) {
    const format = parseImageFormat(base.slice(base.lastIndexOf('.') + 1))
    if (!format) return null
    return {
      name: base.replace(/\.(png|jpe?g)$/i, ''),
      path: p,
      kind: 'image',
      format,
    }
  }
  return {
    name: base.replace(/\.svg$/i, ''),
    path: p,
    kind: 'svg',
    colorMode: colorModeFromLibraryPath(p),
  }
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
        'GitHub write token is not configured (need contents:write + actions:write).',
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

  async function deletePath(path: string, message: string): Promise<boolean> {
    const sha = await getFileSha(path)
    if (!sha) return false
    await githubJson(`/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: 'main' }),
    })
    return true
  }

  async function putBase64File(
    path: string,
    base64Content: string,
    message: string,
  ): Promise<void> {
    const body: Record<string, string> = {
      message,
      content: base64Content,
      branch: 'main',
    }

    // Prefer create-without-sha to avoid a noisy 404 GET for new files.
    let res = await githubFetch(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })

    // File already exists — retry with sha.
    if (res.status === 422) {
      const sha = await getFileSha(path)
      if (sha) {
        body.sha = sha
        res = await githubFetch(`/contents/${path}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
    }

    if (!res.ok) {
      let detail = res.statusText
      try {
        const errBody = (await res.json()) as { message?: string }
        if (errBody.message) detail = errBody.message
      } catch {
        // ignore
      }
      if (res.status === 401 || res.status === 403) {
        throw new GithubAuthError(res.status, detail)
      }
      throw new Error(`GitHub API ${res.status}: ${detail}`)
    }
  }

  async function putTextFile(
    path: string,
    content: string,
    message: string,
  ): Promise<void> {
    return putBase64File(path, toBase64Utf8(content), message)
  }

  async function listContentFileNames(dirPath: string): Promise<Set<string>> {
    const res = await githubFetch(`/contents/${dirPath}`)
    if (res.status === 404) return new Set()
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
      type: string
    }>
    if (!Array.isArray(entries)) return new Set()

    return new Set(
      entries
        .filter((entry) => entry.type === 'file' && !entry.name.startsWith('.'))
        .map((entry) => entry.name.toLowerCase()),
    )
  }

  async function listStagingDir(
    dir: 'mono' | 'color' | 'gradient' | 'remove' | 'images',
    colorMode?: IconColorMode,
  ): Promise<StagedIcon[] | StagedRemoval[]> {
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

    if (dir === 'remove') {
      return entries
        .filter(
          (entry) =>
            entry.type === 'file' &&
            entry.name.toLowerCase().endsWith('.remove') &&
            !entry.name.startsWith('.'),
        )
        .map((entry) => ({
          name: entry.name.replace(/\.remove$/i, ''),
          path: entry.path,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    if (dir === 'images') {
      return entries
        .filter(
          (entry) =>
            entry.type === 'file' &&
            /\.(png|jpe?g)$/i.test(entry.name) &&
            !entry.name.startsWith('.'),
        )
        .map((entry) => {
          const format = parseImageFormat(
            entry.name.slice(entry.name.lastIndexOf('.') + 1),
          )!
          return {
            name: entry.name.replace(/\.(png|jpe?g)$/i, ''),
            path: entry.path,
            kind: 'image' as const,
            format,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    return entries
      .filter(
        (entry) =>
          entry.type === 'file' &&
          entry.name.toLowerCase().endsWith('.svg') &&
          !entry.name.startsWith('.'),
      )
      .map((entry) => ({
        name: entry.name.replace(/\.svg$/i, ''),
        colorMode: colorMode!,
        path: entry.path,
        kind: 'svg' as const,
      }))
  }

  /**
   * Diff main against the last "Version packages" commit.
   * Null when there is no prior publish or HEAD is that publish.
   */
  async function compareSinceLastPublish(): Promise<{
    files?: Array<{ filename: string; status?: string }>
  } | null> {
    const commits = await githubJson<
      Array<{ sha: string; commit: { message: string } }>
    >('/commits?sha=main&per_page=50')

    const publishCommit = commits.find((entry) =>
      /Version packages/i.test(entry.commit.message),
    )

    // No prior publish — avoid dumping the whole library.
    if (!publishCommit) return null
    if (commits[0]?.sha === publishCommit.sha) return null

    return githubJson(`/compare/${publishCommit.sha}...main`)
  }

  return {
    async stageIcons(icons: IconUploadPayload[]): Promise<void> {
      const normalized = validateIcons(icons)

      for (const icon of normalized) {
        // An add cancels a pending removal for the same name.
        await deletePath(
          removalMarkerPath(icon.name),
          `Cancel staged removal ${icon.kind === 'image' ? 'img' : 'gv'}:${icon.name}`,
        )

        if (icon.kind === 'image') {
          const format = icon.format!
          // Drop any other staged image ext for this name.
          for (const ext of IMAGE_EXTS) {
            if (ext === format) continue
            await deletePath(
              `${STAGING_IMAGES}/${icon.name}.${ext}`,
              `Cancel staged image img:${icon.name} (.${ext})`,
            )
          }
          await putBase64File(
            `${STAGING_IMAGES}/${icon.name}.${format}`,
            icon.content,
            `Stage image img:${icon.name}`,
          )
          continue
        }

        const dir = stagingDir(icon.colorMode ?? 'mono')
        // Keep a single staged SVG per name across mono/color/gradient.
        for (const other of ['mono', 'color', 'gradient'] as const) {
          if (other === dir) continue
          await deletePath(
            `${STAGING_BASE}/${other}/${icon.name}.svg`,
            `Cancel staged add gv:${icon.name} (${other})`,
          )
        }
        const path = `${STAGING_BASE}/${dir}/${icon.name}.svg`
        await putTextFile(
          path,
          `${icon.content}\n`,
          `Stage icon gv:${icon.name}`,
        )
      }
    },

    async stageRemovals(names: string[]): Promise<void> {
      const unique = [
        ...new Set(
          names
            .map((n) => sanitizeIconName(n))
            .filter((n): n is string => Boolean(n)),
        ),
      ]
      if (unique.length === 0) {
        throw new Error('No icon names to remove.')
      }

      const libraryImages = await listContentFileNames(IMAGES_DIR)

      for (const name of unique) {
        const monoPath = `packages/custom-icons/svg/${name}.svg`
        const colorPath = `packages/custom-icons/svg/color/${name}.svg`
        const gradientPath = `packages/custom-icons/svg/gradient/${name}.svg`
        const imageFile = findImageFileName(libraryImages, name)
        const imagePath = imageFile ? `${IMAGES_DIR}/${imageFile}` : undefined
        const [monoSha, colorSha, gradientSha, imageSha] = await Promise.all([
          getFileSha(monoPath),
          getFileSha(colorPath),
          getFileSha(gradientPath),
          imagePath ? getFileSha(imagePath) : Promise.resolve(undefined),
        ])
        if (!monoSha && !colorSha && !gradientSha && !imageSha) {
          throw new Error(
            `${name} is not in the library (gv: or img:) — nothing to stage for removal.`,
          )
        }

        // A removal cancels a pending add for the same name.
        await deletePath(
          `${STAGING_BASE}/mono/${name}.svg`,
          `Cancel staged add gv:${name} (mono)`,
        )
        await deletePath(
          `${STAGING_BASE}/color/${name}.svg`,
          `Cancel staged add gv:${name} (color)`,
        )
        await deletePath(
          `${STAGING_BASE}/gradient/${name}.svg`,
          `Cancel staged add gv:${name} (gradient)`,
        )
        for (const ext of IMAGE_EXTS) {
          await deletePath(
            `${STAGING_IMAGES}/${name}.${ext}`,
            `Cancel staged image img:${name}`,
          )
        }

        await putTextFile(
          removalMarkerPath(name),
          `remove ${name}\n`,
          `Stage removal ${name}`,
        )
      }
    },

    async unstageRemoval(name: string): Promise<void> {
      const sanitized = sanitizeIconName(name)
      if (!sanitized) {
        throw new Error(`Invalid icon name "${name}".`)
      }
      const deleted = await deletePath(
        removalMarkerPath(sanitized),
        `Unstage removal ${sanitized}`,
      )
      if (!deleted) {
        throw new Error(`${sanitized} is not staged for removal.`)
      }
    },

    async listStagedIcons(): Promise<StagedIcon[]> {
      const [mono, color, gradient, images] = await Promise.all([
        listStagingDir('mono', 'mono') as Promise<StagedIcon[]>,
        listStagingDir('color', 'preserved') as Promise<StagedIcon[]>,
        listStagingDir('gradient', 'gradient') as Promise<StagedIcon[]>,
        listStagingDir('images') as Promise<StagedIcon[]>,
      ])
      return [...mono, ...color, ...gradient, ...images].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    },

    async listStagedRemovals(): Promise<StagedRemoval[]> {
      return (await listStagingDir('remove')) as StagedRemoval[]
    },

    async listUnpublishedIcons(): Promise<StagedIcon[]> {
      const compare = await compareSinceLastPublish()
      if (!compare) return []

      const icons: StagedIcon[] = []
      for (const file of compare.files ?? []) {
        if (file.status === 'removed') continue
        const staged = stagedFromLibraryPath(file.filename)
        if (staged) icons.push(staged)
      }

      return icons.sort((a, b) => a.name.localeCompare(b.name))
    },

    async listUnpublishedRemovals(): Promise<StagedRemoval[]> {
      const compare = await compareSinceLastPublish()
      if (!compare) return []

      const removals: StagedRemoval[] = []
      for (const file of compare.files ?? []) {
        if (file.status !== 'removed') continue
        const staged = stagedFromLibraryPath(file.filename)
        if (staged) {
          removals.push({ name: staged.name, path: staged.path })
        }
      }

      return removals.sort((a, b) => a.name.localeCompare(b.name))
    },

    async findIconNameConflicts(names: string[]): Promise<IconNameConflict[]> {
      const unique = [
        ...new Set(
          names
            .map((n) => sanitizeIconName(n))
            .filter((n): n is string => Boolean(n)),
        ),
      ]
      if (unique.length === 0) return []

      // List directories once — avoid per-path GET 404s for names that are new.
      const [
        libraryMono,
        libraryColor,
        libraryGradient,
        libraryImages,
        stagingMono,
        stagingColor,
        stagingGradient,
        stagingImages,
        stagingRemove,
      ] = await Promise.all([
        listContentFileNames('packages/custom-icons/svg'),
        listContentFileNames('packages/custom-icons/svg/color'),
        listContentFileNames('packages/custom-icons/svg/gradient'),
        listContentFileNames(IMAGES_DIR),
        listContentFileNames(`${STAGING_BASE}/mono`),
        listContentFileNames(`${STAGING_BASE}/color`),
        listContentFileNames(`${STAGING_BASE}/gradient`),
        listContentFileNames(STAGING_IMAGES),
        listContentFileNames(`${STAGING_BASE}/remove`),
      ])

      const conflicts: IconNameConflict[] = []
      for (const name of unique) {
        if (libraryMono.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'library-mono' })
        }
        if (libraryColor.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'library-color' })
        }
        if (libraryGradient.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'library-gradient' })
        }
        if (findImageFileName(libraryImages, name)) {
          conflicts.push({ name, location: 'library-image' })
        }
        if (stagingMono.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'staging-mono' })
        }
        if (stagingColor.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'staging-color' })
        }
        if (stagingGradient.has(`${name}.svg`)) {
          conflicts.push({ name, location: 'staging-gradient' })
        }
        if (findImageFileName(stagingImages, name)) {
          conflicts.push({ name, location: 'staging-image' })
        }
        if (stagingRemove.has(`${name}.remove`)) {
          conflicts.push({ name, location: 'staging-remove' })
        }
      }

      return conflicts
    },

    async getPublishReadiness(): Promise<PublishReadiness> {
      const [staged, removals] = await Promise.all([
        this.listStagedIcons(),
        this.listStagedRemovals(),
      ])
      const stagedAddCount = staged.length
      const stagedRemovalCount = removals.length
      const stagedCount = stagedAddCount + stagedRemovalCount

      const commits = await githubJson<
        Array<{ sha: string; commit: { message: string } }>
      >('/commits?sha=main&per_page=50')

      const publishCommit = commits.find((entry) =>
        /Version packages/i.test(entry.commit.message),
      )

      // No prior publish on record — don't block with the "no new icons" warn.
      if (!publishCommit) {
        return {
          hasNewIcons: true,
          stagedCount,
          stagedAddCount,
          stagedRemovalCount,
        }
      }

      if (commits[0]?.sha === publishCommit.sha) {
        return {
          hasNewIcons: false,
          stagedCount,
          stagedAddCount,
          stagedRemovalCount,
        }
      }

      const compare = await githubJson<{
        files?: Array<{ filename: string; status?: string }>
      }>(`/compare/${publishCommit.sha}...main`)

      const hasLibraryChange = (compare.files ?? []).some((file) =>
        isLibraryAssetPath(file.filename),
      )

      return {
        hasNewIcons: hasLibraryChange,
        stagedCount,
        stagedAddCount,
        stagedRemovalCount,
      }
    },

    async dispatchApplyStaged(): Promise<void> {
      await githubJson('/actions/workflows/apply-staged-icons.yml/dispatches', {
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
      })
    },

    async dispatchPublish(options?: DispatchPublishOptions): Promise<void> {
      const deferPaths = (options?.deferPaths ?? []).filter(
        (p) =>
          p.startsWith('packages/custom-icons/svg/') ||
          p.startsWith(`${IMAGES_DIR}/`),
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
