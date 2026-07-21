import {
  actionsUrl as sharedActionsUrl,
  actionsWorkflowUrl as sharedActionsWorkflowUrl,
  createGithubAdminClient,
  GithubAuthError,
  isValidRepo,
  packagesUrl as sharedPackagesUrl,
  sanitizeIconName,
  type AssetPreview,
  type DispatchPublishOptions,
  type IconNameConflict,
  type IconUploadPayload,
  type PublishReadiness,
  type PublishHistoryEntry,
  type StagedIcon,
  type StagedRemoval,
  type CustomIconMetadata,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from '@JasonTuTu2/github-admin'
import {
  clearLocalStaging,
  exportIconUploadPayloads,
  exportRemovalNames,
  findLocalStagingNameConflicts,
  getLocalAssetPreview,
  listStagedIconsLocal,
  listStagedRemovalsLocal,
  stageIconsLocal,
  stageRemovalsLocal,
  unstageRemovalLocal,
} from './localStagingStore.js'
import { clearAccountStaging } from './stagingHandoff.js'
import {
  clearGithubSessionToken,
  getGithubSessionToken,
  useGithubSessionToken,
} from './githubAuth.js'
import {
  authApiFetch,
  getAuthSession,
  isAuthApiConfigured,
  useAuthSession,
} from './sessionAuth.js'

export type {
  AssetKind,
  AssetPreview,
  CustomIconEntryMeta,
  CustomIconMetadata,
  DispatchPublishOptions,
  IconColorMode,
  IconNameConflict,
  IconUploadPayload,
  ImageFormat,
  IconSource,
  IconUsage,
  IconVariant,
  PublishReadiness,
  PublishHistoryEntry,
  StagedIcon,
  StagedRemoval,
} from '@JasonTuTu2/github-admin'
export {
  sanitizeIconName,
  detectVariantFromName,
  detectVariantSuffix,
  bumpPackageVersion,
} from '@JasonTuTu2/github-admin'

function getRepo(): string {
  return import.meta.env.VITE_GITHUB_REPO?.trim() ?? ''
}

/**
 * Legacy client PAT for local/dev when the auth API is not configured.
 * Production Pages uses the auth API + server GITHUB_TOKEN only.
 */
function getLegacyToken(): string {
  if (isAuthApiConfigured()) return ''
  return (
    getGithubSessionToken() ||
    import.meta.env.VITE_GITHUB_TOKEN?.trim() ||
    ''
  )
}

/**
 * Apply/Publish client token when auth API is unset (local + optional hash PAT).
 */
function getDevToken(): string {
  if (isAuthApiConfigured()) return ''
  const session = getGithubSessionToken()
  if (session) return session
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_GITHUB_TOKEN?.trim() || ''
  }
  return ''
}

function getStagingClient() {
  return createGithubAdminClient({
    token: getLegacyToken(),
    repo: getRepo(),
  })
}

function getDevClient() {
  const token = getDevToken()
  if (!token) {
    throw new Error(
      'Apply/Publish require Sign in (auth API) or a personal PAT via #gv-github-token=…',
    )
  }
  return createGithubAdminClient({ token, repo: getRepo() })
}

async function withAuthClear<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof GithubAuthError) {
      clearGithubSessionToken()
    }
    throw err
  }
}

async function authApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authApiFetch(path, init)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(
      (typeof body === 'object' && body && 'error' in body && body.error) ||
        `Request failed (${res.status})`,
    )
  }
  return body
}

function mergeConflicts(
  lists: IconNameConflict[][],
): IconNameConflict[] {
  const seen = new Set<string>()
  const out: IconNameConflict[] = []
  for (const list of lists) {
    for (const c of list) {
      const key = `${c.name}:${c.location}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

export function isGithubRepoConfigured(): boolean {
  return isValidRepo(getRepo())
}

/**
 * True when library admin reads/writes are available.
 * With auth API: any signed-in designer/dev. Otherwise: legacy client PAT.
 */
export function isGithubAdminEnabled(): boolean {
  if (!isGithubRepoConfigured()) return false
  if (isAuthApiConfigured()) {
    const session = getAuthSession()
    return Boolean(
      session && (session.role === 'designer' || session.role === 'dev'),
    )
  }
  return Boolean(getLegacyToken())
}

/** True when Apply is available (auth API session, or legacy PAT). */
export function isGithubDevEnabled(): boolean {
  if (isAuthApiConfigured()) {
    const session = getAuthSession()
    return Boolean(
      session && (session.role === 'designer' || session.role === 'dev'),
    )
  }
  return isGithubRepoConfigured() && Boolean(getDevToken())
}

/** True when Publish is available (dev role via auth API, or legacy PAT). */
export function isPublishEnabled(): boolean {
  if (isAuthApiConfigured()) {
    return getAuthSession()?.role === 'dev'
  }
  return isGithubDevEnabled()
}

/** Reactive admin gate (metadata, Releases, conflicts). */
export function useGithubAdminEnabled(): boolean {
  useGithubSessionToken()
  useAuthSession()
  return isGithubAdminEnabled()
}

/** Reactive Apply gate. */
export function useGithubDevEnabled(): boolean {
  useGithubSessionToken()
  useAuthSession()
  return isGithubDevEnabled()
}

/** Reactive Publish gate. */
export function usePublishEnabled(): boolean {
  useGithubSessionToken()
  useAuthSession()
  return isPublishEnabled()
}

export function actionsUrl(): string {
  return sharedActionsUrl(getRepo())
}

export function actionsWorkflowUrl(workflowFile: string): string {
  return sharedActionsWorkflowUrl(getRepo(), workflowFile)
}

export function packagesUrl(): string {
  return sharedPackagesUrl(getRepo())
}

export function commitUrl(sha: string): string {
  const repo = getRepo()
  if (!isValidRepo(repo)) return '#'
  return `https://github.com/${repo}/commit/${sha}`
}

/** Queue icons in this browser (IndexedDB) until Apply. */
export async function stageIcons(icons: IconUploadPayload[]): Promise<void> {
  if (!isGithubRepoConfigured()) {
    throw new Error('GitHub repo is not configured.')
  }
  return stageIconsLocal(icons)
}

/**
 * Figma plugin only: stage to shared GitHub staging via Contents API (auth API).
 */
export async function stageIconsToGithubStaging(
  icons: IconUploadPayload[],
): Promise<void> {
  if (!isGithubRepoConfigured()) {
    throw new Error('GitHub repo is not configured.')
  }
  if (!isAuthApiConfigured()) {
    throw new Error('Sign in to stage from the Figma plugin.')
  }
  const res = await authApiFetch('/api/stage-icons', {
    method: 'POST',
    body: JSON.stringify({ icons }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error || `Stage failed (${res.status})`)
  }
}

/**
 * After opening the full browser from the plugin (`gv-upload=1`), copy remote
 * staging into this tab's IndexedDB so Upload/Apply behave like the browser.
 */
export async function importRemoteGithubStagingToLocal(): Promise<void> {
  if (!isAuthApiConfigured()) return
  const [staged, removals] = await Promise.all([
    authApiJson<StagedIcon[]>('/api/staged-icons'),
    authApiJson<StagedRemoval[]>('/api/staged-removals'),
  ])
  const payloads: IconUploadPayload[] = []
  for (const icon of staged) {
    const preview = await getAssetPreview(icon.path)
    if (!preview) continue
    if (icon.kind === 'image') {
      if (preview.kind !== 'image') continue
      payloads.push({
        name: icon.name,
        kind: 'image',
        format: icon.format ?? 'png',
        content: preview.base64,
        category: icon.category,
        variant: icon.variant,
        source: icon.source,
        usage: icon.usage,
        note: icon.note,
      })
    } else {
      if (preview.kind !== 'svg') continue
      payloads.push({
        name: icon.name,
        kind: 'svg',
        content: preview.text,
        colorMode: icon.colorMode ?? 'mono',
        category: icon.category,
        variant: icon.variant,
        source: icon.source,
        usage: icon.usage,
        note: icon.note,
      })
    }
  }
  await clearLocalStaging()
  if (payloads.length > 0) await stageIconsLocal(payloads)
  if (removals.length > 0) {
    await stageRemovalsLocal(removals.map((r) => r.name))
  }
}

/** Stage library icon names for removal on next Apply. */
export async function stageRemovals(names: string[]): Promise<void> {
  if (!isGithubRepoConfigured()) {
    throw new Error('GitHub repo is not configured.')
  }
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
  if (isGithubAdminEnabled()) {
    for (const name of unique) {
      const path = await findLibraryAssetPath(name)
      if (!path) {
        throw new Error(
          `${name} is not in the library (ci: or img:) — nothing to stage for removal.`,
        )
      }
    }
  }
  return stageRemovalsLocal(unique)
}

/** Cancel a staged removal marker. */
export async function unstageRemoval(name: string): Promise<void> {
  return unstageRemovalLocal(name)
}

/** List staged adds in this browser. */
export async function listStagedIcons(): Promise<StagedIcon[]> {
  return listStagedIconsLocal()
}

/** List staged removal markers in this browser. */
export async function listStagedRemovals(): Promise<StagedRemoval[]> {
  return listStagedRemovalsLocal()
}

/** Custom SVGs applied to the library since the last package publish. */
export async function listUnpublishedIcons(): Promise<StagedIcon[]> {
  if (isAuthApiConfigured()) {
    return authApiJson<StagedIcon[]>('/api/unpublished-icons')
  }
  return withAuthClear(() => getStagingClient().listUnpublishedIcons())
}

/** Library SVGs removed since the last package publish (after Apply). */
export async function listUnpublishedRemovals(): Promise<StagedRemoval[]> {
  if (isAuthApiConfigured()) {
    return authApiJson<StagedRemoval[]>('/api/unpublished-removals')
  }
  return withAuthClear(() => getStagingClient().listUnpublishedRemovals())
}

export async function listPublishHistory(options?: {
  limit?: number
}): Promise<PublishHistoryEntry[]> {
  if (isAuthApiConfigured()) {
    const q =
      options?.limit != null
        ? `?limit=${encodeURIComponent(String(options.limit))}`
        : ''
    return authApiJson<PublishHistoryEntry[]>(`/api/publish-history${q}`)
  }
  return withAuthClear(() => getStagingClient().listPublishHistory(options))
}

export async function findIconNameConflicts(
  names: string[],
): Promise<IconNameConflict[]> {
  const local = await findLocalStagingNameConflicts(names)
  if (!isGithubAdminEnabled()) {
    return local
  }
  if (isAuthApiConfigured()) {
    const body = await authApiJson<{ conflicts: IconNameConflict[] }>(
      '/api/library-conflicts',
      {
        method: 'POST',
        body: JSON.stringify({ names }),
      },
    )
    return mergeConflicts([body.conflicts, local])
  }
  const library = await withAuthClear(() =>
    getStagingClient().findLibraryNameConflicts(names),
  )
  return mergeConflicts([library, local])
}

export async function getAssetPreview(
  path: string,
): Promise<AssetPreview | null> {
  const local = await getLocalAssetPreview(path)
  if (local) return local
  if (!isGithubAdminEnabled()) return null
  if (isAuthApiConfigured()) {
    const body = await authApiJson<{ preview: AssetPreview | null }>(
      `/api/asset-preview?path=${encodeURIComponent(path)}`,
    )
    return body.preview
  }
  return withAuthClear(() => getStagingClient().getAssetPreview(path))
}

export async function findLibraryAssetPath(
  name: string,
): Promise<string | null> {
  if (!isGithubAdminEnabled()) return null
  if (isAuthApiConfigured()) {
    const body = await authApiJson<{ path: string | null }>(
      `/api/library-asset-path?name=${encodeURIComponent(name)}`,
    )
    return body.path
  }
  return withAuthClear(() => getStagingClient().findLibraryAssetPath(name))
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

export type ApplyProgress = {
  phase: 'clear' | 'stage' | 'removals' | 'dispatch'
  label: string
  done: number
  total: number
}

async function applyStagedViaAuthApi(
  icons: IconUploadPayload[],
  removals: string[],
  onProgress?: (progress: ApplyProgress) => void,
): Promise<void> {
  let clearRound = 0
  for (;;) {
    clearRound += 1
    onProgress?.({
      phase: 'clear',
      label: 'Clearing remote staging…',
      done: clearRound,
      total: Math.max(clearRound, 1),
    })
    const res = await authApiFetch('/api/clear-remote-staging', {
      method: 'POST',
    })
    const body = (await res.json().catch(() => ({}))) as {
      complete?: boolean
      error?: string
    }
    if (!res.ok) {
      throw new Error(body.error || `Clear remote staging failed (${res.status})`)
    }
    if (body.complete) break
  }

  const iconBatches = chunkArray(icons, 3)
  for (let i = 0; i < iconBatches.length; i++) {
    const batch = iconBatches[i]!
    onProgress?.({
      phase: 'stage',
      label: `Uploading icons…`,
      done: i + 1,
      total: iconBatches.length,
    })
    const res = await authApiFetch('/api/stage-icons', {
      method: 'POST',
      body: JSON.stringify({ icons: batch }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(body.error || `Stage failed (${res.status})`)
    }
  }

  const removalBatches = chunkArray(removals, 2)
  for (let i = 0; i < removalBatches.length; i++) {
    const batch = removalBatches[i]!
    onProgress?.({
      phase: 'removals',
      label: 'Uploading removals…',
      done: i + 1,
      total: removalBatches.length,
    })
    const res = await authApiFetch('/api/stage-removals', {
      method: 'POST',
      body: JSON.stringify({ removals: batch }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(body.error || `Stage removals failed (${res.status})`)
    }
  }

  onProgress?.({
    phase: 'dispatch',
    label: 'Starting Apply workflow…',
    done: 1,
    total: 1,
  })
  const res = await authApiFetch('/api/dispatch-apply-staged', {
    method: 'POST',
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error || `Apply failed (${res.status})`)
  }
}

/**
 * Upload this browser's staging queue, run Apply, then clear local staging.
 * Uses the auth API when configured; otherwise a session/dev PAT.
 */
export async function applyLocalStagedToLibrary(
  onProgress?: (progress: ApplyProgress) => void,
): Promise<void> {
  const icons = await exportIconUploadPayloads()
  const removals = await exportRemovalNames()
  if (icons.length === 0 && removals.length === 0) {
    throw new Error('Nothing is staged in this browser.')
  }

  if (isAuthApiConfigured()) {
    await applyStagedViaAuthApi(icons, removals, onProgress)
    await clearLocalStaging()
    await clearAccountStaging().catch(() => {
      // Local already cleared; server queue TTL will expire if delete fails.
    })
    return
  }

  onProgress?.({
    phase: 'dispatch',
    label: 'Applying via GitHub…',
    done: 1,
    total: 1,
  })
  const client = getDevClient()
  await withAuthClear(async () => {
    await client.clearRemoteStaging()
    if (icons.length > 0) await client.stageIcons(icons)
    if (removals.length > 0) await client.stageRemovals(removals)
    await client.dispatchApplyStaged()
  })
  await clearLocalStaging()
}

/** Promote remote staging into the library (legacy; prefer applyLocalStagedToLibrary). */
export async function dispatchApplyStaged(
  onProgress?: (progress: ApplyProgress) => void,
): Promise<void> {
  return applyLocalStagedToLibrary(onProgress)
}

export async function getPublishedPackageVersion(): Promise<string> {
  if (!isGithubAdminEnabled()) return 'unknown'
  if (isAuthApiConfigured()) {
    const body = await authApiJson<{ version: string }>('/api/published-version')
    return body.version
  }
  return withAuthClear(() => getStagingClient().getPublishedPackageVersion())
}

export async function getPublishReadiness(): Promise<PublishReadiness> {
  let readiness: PublishReadiness
  if (isAuthApiConfigured()) {
    readiness = await authApiJson<PublishReadiness>('/api/publish-readiness')
  } else {
    const readClient = getLegacyToken() ? getStagingClient() : getDevClient()
    readiness = await withAuthClear(() => readClient.getPublishReadiness())
  }
  const [staged, removals] = await Promise.all([
    listStagedIconsLocal(),
    listStagedRemovalsLocal(),
  ])
  const stagedAddCount = staged.length
  const stagedRemovalCount = removals.length
  return {
    ...readiness,
    stagedCount: stagedAddCount + stagedRemovalCount,
    stagedAddCount,
    stagedRemovalCount,
  }
}

export async function dispatchPublish(
  options?: DispatchPublishOptions,
): Promise<void> {
  if (isAuthApiConfigured()) {
    const res = await authApiFetch('/api/publish', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(body.error || `Publish failed (${res.status})`)
    }
    return
  }
  return withAuthClear(() => getDevClient().dispatchPublish(options))
}

export async function getCustomMetadata(): Promise<CustomIconMetadata> {
  if (isAuthApiConfigured()) {
    return authApiJson<CustomIconMetadata>('/api/metadata')
  }
  return withAuthClear(() => getStagingClient().getCustomMetadata())
}

export async function updateIconCategory(
  name: string,
  category: string,
): Promise<void> {
  return updateIconMetadata(name, { category })
}

export async function updateIconMetadata(
  name: string,
  patch: {
    category?: string
    variant?: IconVariant
    source?: IconSource
    usage?: IconUsage
    note?: string
  },
): Promise<void> {
  if (isAuthApiConfigured()) {
    await authApiJson<{ ok: boolean }>('/api/icon-metadata', {
      method: 'POST',
      body: JSON.stringify({ name, patch }),
    })
    return
  }
  return withAuthClear(() => getStagingClient().updateIconMetadata(name, patch))
}
