import {
  createEmptyMetadata,
  getIconCategory,
  getIconNote,
  getIconSource,
  getIconUsage,
  getIconVariant,
  normalizeCategory,
  normalizeNote,
  normalizeSource,
  normalizeUsage,
  normalizeVariant,
  parseMetadataJson,
  parseStagingMetaFile,
  serializeMetadata,
  setIconMetadata,
  type CustomIconMetadata,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from './metadata.js'

export type IconColorMode = 'mono' | 'preserved' | 'gradient'
export type AssetKind = 'svg' | 'image'
export type ImageFormat = 'png' | 'jpg' | 'jpeg'
export type { IconVariant, IconSource, IconUsage }

export interface IconUploadPayload {
  name: string
  /** SVG document text, or base64 for images (no data: URL prefix). */
  content: string
  /** Required for SVG; ignored for images. */
  colorMode?: IconColorMode
  /** Custom asset category; empty string means no category. */
  category?: string
  /** Custom asset variant; defaults to regular. */
  variant?: IconVariant
  /** Designer source; defaults to custom. */
  source?: IconSource
  /** In-use vs unused; defaults to in-use. */
  usage?: IconUsage
  /** Free-form designer note. */
  note?: string
  /** Defaults to svg. */
  kind?: AssetKind
  /** Required when kind is image. */
  format?: ImageFormat
  /** Overwrites an existing library asset on Apply (designer confirmed). */
  replaceLibrary?: boolean
}

export interface StagedIcon {
  name: string
  path: string
  kind: AssetKind
  /** SVG only. */
  colorMode?: IconColorMode
  /** Image only. */
  format?: ImageFormat
  /** Custom asset category; empty string means no category. */
  category?: string
  /** Custom asset variant; defaults to regular. */
  variant?: IconVariant
  /** Designer source; defaults to custom. */
  source?: IconSource
  /** In-use vs unused; defaults to in-use. */
  usage?: IconUsage
  /** Free-form designer note. */
  note?: string
  /** Present on unpublished library entries that overwrote an existing asset. */
  changeKind?: 'add' | 'replace'
}

/** Tombstone in staging/remove — Apply deletes matching library SVG(s) and/or image. */
export interface StagedRemoval {
  name: string
  path: string
}

/** Thumbnail payload from Contents API (SVG text or image base64). */
export type AssetPreview =
  | { kind: 'svg'; text: string }
  | { kind: 'image'; base64: string; mime: 'image/png' | 'image/jpeg' }

export interface GithubAdminConfig {
  token: string
  repo: string
}

export interface PublishReadiness {
  /** Custom SVG/image adds/removes applied to the library since the last package version publish. */
  hasNewIcons: boolean
  /** Library assets modified (not new paths) since the last publish — semver minor when shipped. */
  hasReplacementChanges: boolean
  /** Staged adds + removal markers waiting for Apply. */
  stagedCount: number
  stagedAddCount: number
  stagedRemovalCount: number
}

/** One published package version (from a Changesets "Version packages" commit). */
export interface PublishHistoryEntry {
  version: string
  publishedAt: string
  commitSha: string
  adds: StagedIcon[]
  removals: StagedRemoval[]
  /** No custom asset adds or removals in this release — version bump only. */
  versionOnly: boolean
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
  /** Package semver bump for this publish (default patch). */
  versionBump?: 'patch' | 'minor' | 'major'
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
  /** Existing library files that collide with these kebab names. */
  findLibraryNameConflicts(names: string[]): Promise<IconNameConflict[]>
  /** Existing library / staging files that collide with these kebab names. */
  findIconNameConflicts(names: string[]): Promise<IconNameConflict[]>
  /** Delete all files under packages/custom-icons/staging (before re-upload on Apply). */
  clearRemoteStaging(): Promise<void>
  /**
   * Delete up to `maxFileDeletes` staging files (Worker subrequest budget).
   * Returns whether staging dirs are empty.
   */
  clearRemoteStagingBatch(maxFileDeletes: number): Promise<{ complete: boolean }>
  /** Load SVG text or image bytes for a library/staging path (thumbnails). */
  getAssetPreview(path: string): Promise<AssetPreview | null>
  /** First library path for a kebab name (svg / color / gradient / images). */
  findLibraryAssetPath(name: string): Promise<string | null>
  getPublishReadiness(): Promise<PublishReadiness>
  /** Current semver on main (`packages/react/package.json`, shared across icon packages). */
  getPublishedPackageVersion(): Promise<string>
  /** Past package publishes with library add/remove summaries (newest first). */
  listPublishHistory(options?: { limit?: number }): Promise<PublishHistoryEntry[]>
  dispatchApplyStaged(): Promise<void>
  dispatchPublish(options?: DispatchPublishOptions): Promise<void>
  getCustomMetadata(): Promise<CustomIconMetadata>
  updateIconCategory(name: string, category: string): Promise<void>
  updateIconMetadata(
    name: string,
    patch: {
      category?: string
      variant?: IconVariant
      source?: IconSource
      usage?: IconUsage
      note?: string
    },
  ): Promise<void>
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
const STAGING_META = `${STAGING_BASE}/meta`
const REMOVE_DIR = `${STAGING_BASE}/remove`
const IMAGES_DIR = 'packages/custom-icons/images'
const STAGING_IMAGES = `${STAGING_BASE}/images`
const METADATA_FILE = 'packages/custom-icons/metadata.json'
const DEFAULT_REPO = 'JasonTuTu2/icons-library'
const IMAGE_EXTS = ['png', 'jpg', 'jpeg'] as const

export type { CustomIconMetadata, CustomIconEntryMeta } from './metadata.js'
export {
  METADATA_PATH,
  STAGING_META_DIR,
  categoryLabel,
  createEmptyMetadata,
  detectVariantFromName,
  detectVariantSuffix,
  getIconCategory,
  getIconNote,
  getIconSource,
  getIconUsage,
  getIconVariant,
  mergeStagingMetaIntoMetadata,
  normalizeCategory,
  normalizeNote,
  normalizeSource,
  normalizeUsage,
  normalizeVariant,
  parseMetadataJson,
  parseStagingMetaFile,
  removeIconMetadata,
  serializeMetadata,
  setIconCategory,
  setIconMetadata,
  sourceLabel,
  usageLabel,
  variantLabel,
  noteLabel,
} from './metadata.js'

function stagingMetaPath(name: string): string {
  return `${STAGING_META}/${name}.json`
}

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

/** Next semver after a patch / minor / major bump (Changesets-style). */
export function bumpPackageVersion(
  current: string,
  bump: 'patch' | 'minor' | 'major',
): string {
  const match = current.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return current
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
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

/** Normalize and validate payloads before staging (local or GitHub). */
export function validateIconUploads(
  icons: IconUploadPayload[],
): IconUploadPayload[] {
  return validateIcons(icons)
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
      return {
        name,
        content,
        kind,
        format,
        category: normalizeCategory(icon.category),
        variant: normalizeVariant(icon.variant),
        source: normalizeSource(icon.source),
        usage: normalizeUsage(icon.usage),
        note: normalizeNote(icon.note),
        replaceLibrary: icon.replaceLibrary === true,
      }
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
      category: normalizeCategory(icon.category),
      variant: normalizeVariant(icon.variant),
      source: normalizeSource(icon.source),
      usage: normalizeUsage(icon.usage),
      note: normalizeNote(icon.note),
      replaceLibrary: icon.replaceLibrary === true,
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
        // Required by GitHub REST; Workers fetch omits a browser User-Agent → 403.
        'User-Agent': 'JasonTuTu2-icons-library-github-admin',
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

  function decodeBase64Utf8(base64: string): string {
    const binary = atob(base64.replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  }

  async function readContentFile(
    path: string,
    ref?: string,
  ): Promise<{ name: string; contentBase64: string } | null> {
    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ''
    const res = await githubFetch(`/contents/${path}${refQuery}`)
    if (res.status === 404) return null
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
    const body = (await res.json()) as {
      type?: string
      name?: string
      content?: string
      encoding?: string
    }
    if (body.type !== 'file' || !body.content) return null
    return {
      name: body.name ?? path.split('/').pop() ?? path,
      contentBase64: body.content.replace(/\s+/g, ''),
    }
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

  async function readMetadataFile(ref?: string): Promise<CustomIconMetadata> {
    const file = await readContentFile(METADATA_FILE, ref)
    if (!file) return createEmptyMetadata()
    return parseMetadataJson(decodeBase64Utf8(file.contentBase64))
  }

  async function readPackageVersionAtRef(ref: string): Promise<string> {
    const file = await readContentFile('packages/react/package.json', ref)
    if (!file) return 'unknown'
    try {
      const json = JSON.parse(decodeBase64Utf8(file.contentBase64)) as {
        version?: string
      }
      return json.version?.trim() || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async function writeMetadataFile(
    metadata: CustomIconMetadata,
    message: string,
  ): Promise<void> {
    await putTextFile(METADATA_FILE, serializeMetadata(metadata), message)
  }

  async function writeStagingMeta(
    name: string,
    category: string,
    variant: IconVariant = 'none',
    source: IconSource = 'custom',
    usage: IconUsage = 'in-use',
    note: string = '',
    replaceLibrary: boolean = false,
  ): Promise<void> {
    await putTextFile(
      stagingMetaPath(name),
      `${JSON.stringify({
        category: normalizeCategory(category),
        variant: normalizeVariant(variant),
        source: normalizeSource(source),
        usage: normalizeUsage(usage),
        note: normalizeNote(note),
        replaceLibrary: replaceLibrary ? true : undefined,
      })}\n`,
      `Stage metadata for ${name}`,
    )
  }

  async function deleteStagingMeta(name: string, message: string): Promise<void> {
    await deletePath(stagingMetaPath(name), message)
  }

  async function readStagingMetaMap(): Promise<
    Map<
      string,
      {
        category: string
        variant: IconVariant
        source: IconSource
        usage: IconUsage
        note: string
      }
    >
  > {
    const res = await githubFetch(`/contents/${STAGING_META}`)
    if (res.status === 404) return new Map()
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
    if (!Array.isArray(entries)) return new Map()

    const map = new Map<
      string,
      {
        category: string
        variant: IconVariant
        source: IconSource
        usage: IconUsage
        note: string
      }
    >()
    for (const entry of entries) {
      if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue
      const name = entry.name.replace(/\.json$/i, '')
      const file = await readContentFile(`${STAGING_META}/${entry.name}`)
      if (!file) continue
      const meta = parseStagingMetaFile(decodeBase64Utf8(file.contentBase64))
      map.set(name, meta)
    }
    return map
  }

  function attachMetadata(
    icons: StagedIcon[],
    stagingMeta: Map<
      string,
      {
        category: string
        variant: IconVariant
        source: IconSource
        usage: IconUsage
        note: string
      }
    >,
    libraryMetadata?: CustomIconMetadata,
  ): StagedIcon[] {
    return icons.map((icon) => {
      const staged = stagingMeta.get(icon.name)
      return {
        ...icon,
        category:
          staged?.category ??
          (libraryMetadata
            ? getIconCategory(libraryMetadata, icon.name)
            : undefined) ??
          '',
        variant:
          staged?.variant ??
          (libraryMetadata
            ? getIconVariant(libraryMetadata, icon.name)
            : undefined) ??
          'regular',
        source:
          staged?.source ??
          (libraryMetadata
            ? getIconSource(libraryMetadata, icon.name)
            : undefined) ??
          'custom',
        usage:
          staged?.usage ??
          (libraryMetadata
            ? getIconUsage(libraryMetadata, icon.name)
            : undefined) ??
          'in-use',
        note:
          staged?.note ??
          (libraryMetadata
            ? getIconNote(libraryMetadata, icon.name)
            : undefined) ??
          '',
      }
    })
  }

  async function listContentFileNames(
    dirPath: string,
    ref?: string,
  ): Promise<Set<string>> {
    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ''
    const res = await githubFetch(`/contents/${dirPath}${refQuery}`)
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

  type RepoCommit = { sha: string; commit: { message: string } }
  type RepoCommitWithDate = {
    sha: string
    commit: {
      message: string
      committer?: { date?: string }
      author?: { date?: string }
    }
  }

  /** Walk main history until the latest Changesets "Version packages" commit. */
  async function findLatestPublishCommit(): Promise<RepoCommit | null> {
    for (let page = 1; page <= 20; page++) {
      const commits = await githubJson<RepoCommit[]>(
        `/commits?sha=main&per_page=100&page=${page}`,
      )
      if (!Array.isArray(commits) || commits.length === 0) return null
      const found = commits.find((entry) => {
        const subject = entry.commit.message.split('\n', 1)[0] ?? ''
        return /^Version packages\b/i.test(subject)
      })
      if (found) return found
      if (commits.length < 100) return null
    }
    return null
  }

  /** Commits on main after `untilSha` (exclusive), newest first. */
  async function listCommitsSince(untilSha: string): Promise<RepoCommit[]> {
    const out: RepoCommit[] = []
    for (let page = 1; page <= 20; page++) {
      const commits = await githubJson<RepoCommit[]>(
        `/commits?sha=main&per_page=100&page=${page}`,
      )
      if (!Array.isArray(commits) || commits.length === 0) break
      for (const entry of commits) {
        if (entry.sha === untilSha) return out
        out.push(entry)
      }
      if (commits.length < 100) break
    }
    return out
  }

  /** Commits reachable from `headSha` after `baseSha` (exclusive), newest first. */
  async function listCommitsBetween(
    baseSha: string,
    headSha: string,
  ): Promise<RepoCommit[]> {
    const out: RepoCommit[] = []
    for (let page = 1; page <= 20; page++) {
      const commits = await githubJson<RepoCommit[]>(
        `/commits?sha=${encodeURIComponent(headSha)}&per_page=100&page=${page}`,
      )
      if (!Array.isArray(commits) || commits.length === 0) break
      for (const entry of commits) {
        if (entry.sha === baseSha) return out
        out.push(entry)
      }
      if (commits.length < 100) break
    }
    return out
  }

  function isVersionPackagesSubject(message: string): boolean {
    const subject = message.split('\n', 1)[0] ?? ''
    return /^Version packages\b/i.test(subject)
  }

  /** Newest-first publish commits on main. */
  async function listAllPublishCommits(
    max: number,
  ): Promise<Array<{ sha: string; publishedAt: string }>> {
    const out: Array<{ sha: string; publishedAt: string }> = []
    for (let page = 1; page <= 20 && out.length < max; page++) {
      const commits = await githubJson<RepoCommitWithDate[]>(
        `/commits?sha=main&per_page=100&page=${page}`,
      )
      if (!Array.isArray(commits) || commits.length === 0) break
      for (const entry of commits) {
        if (!isVersionPackagesSubject(entry.commit.message)) continue
        out.push({
          sha: entry.sha,
          publishedAt:
            entry.commit.committer?.date ??
            entry.commit.author?.date ??
            '',
        })
        if (out.length >= max) return out
      }
      if (commits.length < 100) break
    }
    return out
  }

  /** Names from "Apply staged icons from icon browser: ci:foo,img:bar" commits. */
  function iconNamesFromApplyCommitMessage(message: string): string[] {
    const match = message.match(
      /Apply staged icons from icon browser:\s*(.+)/i,
    )
    if (!match?.[1]) return []
    const names: string[] = []
    for (const part of match[1].split(',')) {
      const token = part.trim()
      if (!token) continue
      const colon = token.indexOf(':')
      const name = (colon >= 0 ? token.slice(colon + 1) : token)
        .trim()
        .toLowerCase()
      if (name && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) names.push(name)
    }
    return names
  }

  /** Resolve library path for a kebab name (mono → color → gradient → image). */
  async function buildLibraryPathByName(
    ref?: string,
  ): Promise<Map<string, string>> {
    const [
      libraryMono,
      libraryColor,
      libraryGradient,
      libraryImages,
    ] = await Promise.all([
      listContentFileNames('packages/custom-icons/svg', ref),
      listContentFileNames('packages/custom-icons/svg/color', ref),
      listContentFileNames('packages/custom-icons/svg/gradient', ref),
      listContentFileNames(IMAGES_DIR, ref),
    ])
    const map = new Map<string, string>()
    for (const file of libraryMono) {
      if (!file.endsWith('.svg')) continue
      const name = file.slice(0, -4)
      if (!map.has(name)) map.set(name, `packages/custom-icons/svg/${name}.svg`)
    }
    for (const file of libraryColor) {
      if (!file.endsWith('.svg')) continue
      const name = file.slice(0, -4)
      if (!map.has(name)) {
        map.set(name, `packages/custom-icons/svg/color/${name}.svg`)
      }
    }
    for (const file of libraryGradient) {
      if (!file.endsWith('.svg')) continue
      const name = file.slice(0, -4)
      if (!map.has(name)) {
        map.set(name, `packages/custom-icons/svg/gradient/${name}.svg`)
      }
    }
    for (const file of libraryImages) {
      const match = file.match(/^(.+)\.(png|jpe?g)$/i)
      if (!match) continue
      const name = match[1]!
      const ext = match[2]!.toLowerCase()
      if (!map.has(name)) map.set(name, `${IMAGES_DIR}/${name}.${ext}`)
    }
    return map
  }

  async function collectLibraryChanges(
    baseSha: string,
    headSha: string,
    options?: { light?: boolean },
  ): Promise<{
    adds: StagedIcon[]
    replacements: StagedIcon[]
    removals: StagedRemoval[]
  }> {
    const light = options?.light === true
    // Light mode: compare + metadata only (for publish history / Worker budget).
    // Full mode also walks apply commits and library trees (unpublished accuracy).
    const [compare, between, libraryMetadata, libraryAtBase] = await Promise.all([
      githubJson<{
        files?: Array<{ filename: string; status?: string }>
      }>(`/compare/${baseSha}...${headSha}`),
      light
        ? Promise.resolve([] as RepoCommit[])
        : listCommitsBetween(baseSha, headSha),
      readMetadataFile(headSha),
      light
        ? Promise.resolve(new Map<string, string>())
        : buildLibraryPathByName(baseSha),
    ])

    const applyIconNames = light
      ? []
      : [
          ...new Set(
            between.flatMap((entry) =>
              iconNamesFromApplyCommitMessage(entry.commit.message),
            ),
          ),
        ]

    const byName = new Map<
      string,
      { icon: StagedIcon; changeKind: 'add' | 'replace' }
    >()
    for (const file of compare.files ?? []) {
      if (file.status === 'removed') continue
      const staged = stagedFromLibraryPath(file.filename)
      if (!staged) continue
      let changeKind: 'add' | 'replace' = 'add'
      if (file.status === 'modified') {
        changeKind = 'replace'
      } else if (file.status === 'added') {
        changeKind = 'add'
      } else if (libraryAtBase.has(staged.name)) {
        changeKind = 'replace'
      }
      byName.set(staged.name, { icon: staged, changeKind })
    }

    if (applyIconNames.length > 0) {
      const libraryPaths = await buildLibraryPathByName(headSha)
      for (const name of applyIconNames) {
        if (byName.has(name)) continue
        const path = libraryPaths.get(name)
        if (!path) continue
        const staged = stagedFromLibraryPath(path)
        if (!staged) continue
        byName.set(name, {
          icon: staged,
          changeKind: libraryAtBase.has(name) ? 'replace' : 'add',
        })
      }
    }

    const removals: StagedRemoval[] = []
    for (const file of compare.files ?? []) {
      if (file.status !== 'removed') continue
      const staged = stagedFromLibraryPath(file.filename)
      if (staged) {
        removals.push({ name: staged.name, path: staged.path })
      }
    }

    const withMeta = attachMetadata(
      [...byName.values()].map((entry) => entry.icon),
      new Map(),
      libraryMetadata,
    ).map((icon) => {
      const entry = byName.get(icon.name)
      return {
        ...icon,
        changeKind: entry?.changeKind ?? 'add',
      }
    })

    const adds = withMeta.filter((icon) => icon.changeKind !== 'replace')
    const replacements = withMeta.filter((icon) => icon.changeKind === 'replace')

    return {
      adds: adds.sort((a, b) => a.name.localeCompare(b.name)),
      replacements: replacements.sort((a, b) => a.name.localeCompare(b.name)),
      removals: removals.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }

  /**
   * Diff main against the last "Version packages" commit.
   * Also collects icon names from Apply commits (wipe+re-add identical SVGs
   * produce no net file diff, but should still count as unpublished).
   */
  async function compareSinceLastPublish(): Promise<{
    publishSha: string | null
    headIsPublish: boolean
    files: Array<{ filename: string; status?: string }>
    applyIconNames: string[]
  }> {
    const publishCommit = await findLatestPublishCommit()
    if (!publishCommit) {
      return {
        publishSha: null,
        headIsPublish: false,
        files: [],
        applyIconNames: [],
      }
    }

    const since = await listCommitsSince(publishCommit.sha)
    if (since.length === 0) {
      return {
        publishSha: publishCommit.sha,
        headIsPublish: true,
        files: [],
        applyIconNames: [],
      }
    }

    const compare = await githubJson<{
      files?: Array<{ filename: string; status?: string }>
    }>(`/compare/${publishCommit.sha}...main`)

    const applyIconNames = [
      ...new Set(
        since.flatMap((entry) =>
          iconNamesFromApplyCommitMessage(entry.commit.message),
        ),
      ),
    ]

    return {
      publishSha: publishCommit.sha,
      headIsPublish: false,
      files: compare.files ?? [],
      applyIconNames,
    }
  }

  return {
    async stageIcons(icons: IconUploadPayload[]): Promise<void> {
      const normalized = validateIcons(icons)

      for (const icon of normalized) {
        // An add cancels a pending removal for the same name.
        await deletePath(
          removalMarkerPath(icon.name),
          `Cancel staged removal ${icon.kind === 'image' ? 'img' : 'ci'}:${icon.name}`,
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
          await writeStagingMeta(
            icon.name,
            icon.category ?? '',
            icon.variant ?? 'none',
            icon.source ?? 'custom',
            icon.usage ?? 'in-use',
            icon.note ?? '',
            icon.replaceLibrary === true,
          )
          continue
        }

        const dir = stagingDir(icon.colorMode ?? 'mono')
        // Keep a single staged SVG per name across mono/color/gradient.
        for (const other of ['mono', 'color', 'gradient'] as const) {
          if (other === dir) continue
          await deletePath(
            `${STAGING_BASE}/${other}/${icon.name}.svg`,
            `Cancel staged add ci:${icon.name} (${other})`,
          )
        }
        const path = `${STAGING_BASE}/${dir}/${icon.name}.svg`
        await putTextFile(
          path,
          `${icon.content}\n`,
          `Stage icon ci:${icon.name}`,
        )
        await writeStagingMeta(
          icon.name,
          icon.category ?? '',
          icon.variant ?? 'none',
          icon.source ?? 'custom',
          icon.usage ?? 'in-use',
          icon.note ?? '',
          icon.replaceLibrary === true,
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
            `${name} is not in the library (ci: or img:) — nothing to stage for removal.`,
          )
        }

        // A removal cancels a pending add for the same name.
        await deletePath(
          `${STAGING_BASE}/mono/${name}.svg`,
          `Cancel staged add ci:${name} (mono)`,
        )
        await deletePath(
          `${STAGING_BASE}/color/${name}.svg`,
          `Cancel staged add ci:${name} (color)`,
        )
        await deletePath(
          `${STAGING_BASE}/gradient/${name}.svg`,
          `Cancel staged add ci:${name} (gradient)`,
        )
        for (const ext of IMAGE_EXTS) {
          await deletePath(
            `${STAGING_IMAGES}/${name}.${ext}`,
            `Cancel staged image img:${name}`,
          )
        }
        await deleteStagingMeta(name, `Cancel staged metadata for ${name}`)

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
      const [mono, color, gradient, images, stagingMeta, libraryMetadata] =
        await Promise.all([
          listStagingDir('mono', 'mono') as Promise<StagedIcon[]>,
          listStagingDir('color', 'preserved') as Promise<StagedIcon[]>,
          listStagingDir('gradient', 'gradient') as Promise<StagedIcon[]>,
          listStagingDir('images') as Promise<StagedIcon[]>,
          readStagingMetaMap(),
          readMetadataFile(),
        ])
      return attachMetadata(
        [...mono, ...color, ...gradient, ...images].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        stagingMeta,
        libraryMetadata,
      )
    },

    async listStagedRemovals(): Promise<StagedRemoval[]> {
      return (await listStagingDir('remove')) as StagedRemoval[]
    },

    async listUnpublishedIcons(): Promise<StagedIcon[]> {
      const compare = await compareSinceLastPublish()
      if (!compare.publishSha || compare.headIsPublish) return []
      const { adds, replacements } = await collectLibraryChanges(
        compare.publishSha,
        'main',
      )
      return [...adds, ...replacements].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    },

    async listUnpublishedRemovals(): Promise<StagedRemoval[]> {
      const compare = await compareSinceLastPublish()
      if (!compare.publishSha || compare.headIsPublish) return []
      const { removals } = await collectLibraryChanges(compare.publishSha, 'main')
      return removals
    },

    async findLibraryNameConflicts(
      names: string[],
    ): Promise<IconNameConflict[]> {
      const unique = [
        ...new Set(
          names
            .map((n) => sanitizeIconName(n))
            .filter((n): n is string => Boolean(n)),
        ),
      ]
      if (unique.length === 0) return []

      const [libraryMono, libraryColor, libraryGradient, libraryImages] =
        await Promise.all([
          listContentFileNames('packages/custom-icons/svg'),
          listContentFileNames('packages/custom-icons/svg/color'),
          listContentFileNames('packages/custom-icons/svg/gradient'),
          listContentFileNames(IMAGES_DIR),
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
      }

      return conflicts
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

      const [
        libraryConflicts,
        stagingMono,
        stagingColor,
        stagingGradient,
        stagingImages,
        stagingRemove,
      ] = await Promise.all([
        this.findLibraryNameConflicts(unique),
        listContentFileNames(`${STAGING_BASE}/mono`),
        listContentFileNames(`${STAGING_BASE}/color`),
        listContentFileNames(`${STAGING_BASE}/gradient`),
        listContentFileNames(STAGING_IMAGES),
        listContentFileNames(`${STAGING_BASE}/remove`),
      ])

      const conflicts: IconNameConflict[] = [...libraryConflicts]
      for (const name of unique) {
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

    async clearRemoteStaging(): Promise<void> {
      for (;;) {
        const { complete } = await this.clearRemoteStagingBatch(500)
        if (complete) return
      }
    },

    async clearRemoteStagingBatch(
      maxFileDeletes: number,
    ): Promise<{ complete: boolean }> {
      const dirs = [
        `${STAGING_BASE}/mono`,
        `${STAGING_BASE}/color`,
        `${STAGING_BASE}/gradient`,
        STAGING_IMAGES,
        REMOVE_DIR,
        STAGING_META,
      ] as const

      let deleted = 0
      for (const dir of dirs) {
        const res = await githubFetch(`/contents/${dir}`)
        if (res.status === 404) continue
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
          path: string
          type: string
          name: string
        }>
        if (!Array.isArray(entries)) continue

        for (const entry of entries) {
          if (entry.type !== 'file' || entry.name.startsWith('.')) continue
          if (deleted >= maxFileDeletes) return { complete: false }
          await deletePath(entry.path, `Clear remote staging ${entry.path}`)
          deleted++
        }
      }
      return { complete: true }
    },

    async getAssetPreview(path: string): Promise<AssetPreview | null> {
      const file = await readContentFile(path)
      if (!file) return null
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.svg')) {
        return { kind: 'svg', text: decodeBase64Utf8(file.contentBase64) }
      }
      if (lower.endsWith('.png')) {
        return {
          kind: 'image',
          base64: file.contentBase64,
          mime: 'image/png',
        }
      }
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        return {
          kind: 'image',
          base64: file.contentBase64,
          mime: 'image/jpeg',
        }
      }
      return null
    },

    async findLibraryAssetPath(name: string): Promise<string | null> {
      const sanitized = sanitizeIconName(name)
      if (!sanitized) return null
      const candidates = [
        `packages/custom-icons/svg/${sanitized}.svg`,
        `packages/custom-icons/svg/color/${sanitized}.svg`,
        `packages/custom-icons/svg/gradient/${sanitized}.svg`,
        ...IMAGE_EXTS.map(
          (ext) => `${IMAGES_DIR}/${sanitized}.${ext}`,
        ),
      ]
      for (const candidate of candidates) {
        const sha = await getFileSha(candidate)
        if (sha) return candidate
      }
      return null
    },

    async listPublishHistory(options?: {
      limit?: number
    }): Promise<PublishHistoryEntry[]> {
      const limit = Math.min(Math.max(options?.limit ?? 12, 1), 20)
      const publishes = await listAllPublishCommits(limit + 1)
      const entries: PublishHistoryEntry[] = []

      for (let i = 0; i < publishes.length && entries.length < limit; i++) {
        const current = publishes[i]!
        const previous = publishes[i + 1]
        const [version, changes] = await Promise.all([
          readPackageVersionAtRef(current.sha),
          previous
            ? collectLibraryChanges(previous.sha, current.sha, { light: true })
            : Promise.resolve({
                adds: [] as StagedIcon[],
                replacements: [] as StagedIcon[],
                removals: [] as StagedRemoval[],
              }),
        ])
        entries.push({
          version,
          publishedAt: current.publishedAt,
          commitSha: current.sha,
          adds: [...changes.adds, ...changes.replacements],
          removals: changes.removals,
          versionOnly:
            changes.adds.length === 0 &&
            changes.replacements.length === 0 &&
            changes.removals.length === 0,
        })
      }

      return entries
    },

    async getPublishedPackageVersion(): Promise<string> {
      return readPackageVersionAtRef('main')
    },

    async getPublishReadiness(): Promise<PublishReadiness> {
      const [staged, removals] = await Promise.all([
        this.listStagedIcons(),
        this.listStagedRemovals(),
      ])
      const stagedAddCount = staged.length
      const stagedRemovalCount = removals.length
      const stagedCount = stagedAddCount + stagedRemovalCount

      const compare = await compareSinceLastPublish()

      // No prior publish on record — don't block with the "no new icons" warn.
      if (!compare.publishSha) {
        return {
          hasNewIcons: true,
          hasReplacementChanges: false,
          stagedCount,
          stagedAddCount,
          stagedRemovalCount,
        }
      }

      if (compare.headIsPublish) {
        return {
          hasNewIcons: false,
          hasReplacementChanges: false,
          stagedCount,
          stagedAddCount,
          stagedRemovalCount,
        }
      }

      const { replacements } = await collectLibraryChanges(
        compare.publishSha,
        'main',
      )

      const hasLibraryChange =
        compare.applyIconNames.length > 0 ||
        compare.files.some(
          (file) =>
            isLibraryAssetPath(file.filename) ||
            file.filename.replace(/\\/g, '/') ===
              'packages/custom-icons/metadata.json',
        )

      return {
        hasNewIcons: hasLibraryChange,
        hasReplacementChanges: replacements.length > 0,
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
            version_bump:
              options?.versionBump === 'major'
                ? 'major'
                : options?.versionBump === 'minor'
                  ? 'minor'
                  : 'patch',
          },
        }),
      })
    },

    async getCustomMetadata(): Promise<CustomIconMetadata> {
      return readMetadataFile()
    },

    async updateIconCategory(name: string, category: string): Promise<void> {
      await this.updateIconMetadata(name, { category })
    },

    async updateIconMetadata(
      name: string,
      patch: {
        category?: string
        variant?: IconVariant
        source?: IconSource
        usage?: IconUsage
        note?: string
      },
    ): Promise<void> {
      const sanitized = sanitizeIconName(name)
      if (!sanitized) {
        throw new Error(`Invalid icon name "${name}".`)
      }
      const metadata = setIconMetadata(
        await readMetadataFile(),
        sanitized,
        patch,
      )
      const parts: string[] = []
      if (patch.category !== undefined) parts.push('category')
      if (patch.variant !== undefined) parts.push('variant')
      if (patch.source !== undefined) parts.push('source')
      if (patch.usage !== undefined) parts.push('usage')
      if (patch.note !== undefined) parts.push('note')
      await writeMetadataFile(
        metadata,
        `[skip ci] Update ${parts.join(' and ') || 'metadata'} for ${sanitized}`,
      )
    },
  }
}
