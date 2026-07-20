import {
  actionsUrl as sharedActionsUrl,
  actionsWorkflowUrl as sharedActionsWorkflowUrl,
  createGithubAdminClient,
  GithubAuthError,
  isValidRepo,
  packagesUrl as sharedPackagesUrl,
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
 * Token for staging (Contents API). Pages bakes ICON_BROWSER_TOKEN into
 * VITE_GITHUB_TOKEN so designers can stage without a personal PAT.
 * Session PAT (magic URL) overrides when present.
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

export function isGithubRepoConfigured(): boolean {
  return isValidRepo(getRepo())
}

/** True when staging / Contents API writes are available. */
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

/** Write icons into the shared staging folder (Contents API, no Action). */
export async function stageIcons(icons: IconUploadPayload[]): Promise<void> {
  return withAuthClear(() => getStagingClient().stageIcons(icons))
}

/** Stage library icon names for removal on next Apply. */
export async function stageRemovals(names: string[]): Promise<void> {
  return withAuthClear(() => getStagingClient().stageRemovals(names))
}

/** Cancel a staged removal marker. */
export async function unstageRemoval(name: string): Promise<void> {
  return withAuthClear(() => getStagingClient().unstageRemoval(name))
}

/** List all staged SVGs currently on main. */
export async function listStagedIcons(): Promise<StagedIcon[]> {
  return withAuthClear(() => getStagingClient().listStagedIcons())
}

/** List staged removal markers. */
export async function listStagedRemovals(): Promise<StagedRemoval[]> {
  return withAuthClear(() => getStagingClient().listStagedRemovals())
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
  return withAuthClear(() => getStagingClient().findIconNameConflicts(names))
}

export async function getAssetPreview(
  path: string,
): Promise<AssetPreview | null> {
  return withAuthClear(() => getStagingClient().getAssetPreview(path))
}

export async function findLibraryAssetPath(
  name: string,
): Promise<string | null> {
  return withAuthClear(() => getStagingClient().findLibraryAssetPath(name))
}

/** Promote whatever is staged now into the library (one Action). */
export async function dispatchApplyStaged(): Promise<void> {
  return withAuthClear(() => getDevClient().dispatchApplyStaged())
}

export async function getPublishReadiness(): Promise<PublishReadiness> {
  return withAuthClear(() => getDevClient().getPublishReadiness())
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
