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
import {
  clearGithubSessionToken,
  getGithubSessionToken,
  useGithubSessionToken,
} from './githubAuth.js'

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
} from '@JasonTuTu2/github-admin'

function getRepo(): string {
  return import.meta.env.VITE_GITHUB_REPO?.trim() ?? ''
}

/**
 * Token for library reads (conflicts, removal validation, thumbnails).
 * Session PAT overrides when present.
 */
function getStagingToken(): string {
  return (
    getGithubSessionToken() ||
    import.meta.env.VITE_GITHUB_TOKEN?.trim() ||
    ''
  )
}

/**
 * Token for Apply / Publish (workflow_dispatch). On Pages, only a session
 * PAT from `#gv-github-token=…`. Locally, `.env` VITE_GITHUB_TOKEN also works.
 */
function getDevToken(): string {
  const session = getGithubSessionToken()
  if (session) return session
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_GITHUB_TOKEN?.trim() || ''
  }
  return ''
}

function getStagingClient() {
  return createGithubAdminClient({
    token: getStagingToken(),
    repo: getRepo(),
  })
}

function getDevClient() {
  const token = getDevToken()
  if (!token) {
    throw new Error(
      'Apply/Publish require a personal PAT. Open the icon browser with #gv-github-token=YOUR_PAT (contents:write + actions:write).',
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

/** True when Contents API reads are available (library conflict checks, metadata edits). */
export function isGithubAdminEnabled(): boolean {
  return isGithubRepoConfigured() && Boolean(getStagingToken())
}

/** True when Apply / Publish UI and dispatches are available. */
export function isGithubDevEnabled(): boolean {
  return isGithubRepoConfigured() && Boolean(getDevToken())
}

/** Reactive Apply/Publish gate (updates after magic-URL PAT is stored). */
export function useGithubDevEnabled(): boolean {
  useGithubSessionToken()
  return isGithubDevEnabled()
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
  if (getStagingToken()) {
    for (const name of unique) {
      const path = await withAuthClear(() =>
        getStagingClient().findLibraryAssetPath(name),
      )
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
  return withAuthClear(() => getStagingClient().listUnpublishedIcons())
}

/** Library SVGs removed since the last package publish (after Apply). */
export async function listUnpublishedRemovals(): Promise<StagedRemoval[]> {
  return withAuthClear(() => getStagingClient().listUnpublishedRemovals())
}

export async function listPublishHistory(options?: {
  limit?: number
}): Promise<PublishHistoryEntry[]> {
  return withAuthClear(() => getStagingClient().listPublishHistory(options))
}

export async function findIconNameConflicts(
  names: string[],
): Promise<IconNameConflict[]> {
  const local = await findLocalStagingNameConflicts(names)
  if (!getStagingToken()) {
    return local
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
  if (!getStagingToken()) return null
  return withAuthClear(() => getStagingClient().getAssetPreview(path))
}

export async function findLibraryAssetPath(
  name: string,
): Promise<string | null> {
  if (!getStagingToken()) return null
  return withAuthClear(() => getStagingClient().findLibraryAssetPath(name))
}

/**
 * Upload this browser's staging queue to GitHub, run Apply, then clear local staging.
 */
export async function applyLocalStagedToLibrary(): Promise<void> {
  const icons = await exportIconUploadPayloads()
  const removals = await exportRemovalNames()
  if (icons.length === 0 && removals.length === 0) {
    throw new Error('Nothing is staged in this browser.')
  }

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
export async function dispatchApplyStaged(): Promise<void> {
  return applyLocalStagedToLibrary()
}

export async function getPublishReadiness(): Promise<PublishReadiness> {
  const readiness = await withAuthClear(() =>
    getDevClient().getPublishReadiness(),
  )
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
  return withAuthClear(() => getDevClient().dispatchPublish(options))
}

export async function getCustomMetadata(): Promise<CustomIconMetadata> {
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
  return withAuthClear(() => getStagingClient().updateIconMetadata(name, patch))
}
