import {
  actionsUrl as sharedActionsUrl,
  actionsWorkflowUrl as sharedActionsWorkflowUrl,
  createGithubAdminClient,
  GithubAuthError,
  isValidRepo,
  packagesUrl as sharedPackagesUrl,
  sanitizeIconName,
  type DispatchPublishOptions,
  type IconColorMode,
  type IconNameConflict,
  type IconUploadPayload,
  type PublishReadiness,
  type StagedIcon,
  type StagedRemoval,
} from '@JasonTuTu2/github-admin'
import {
  clearGithubSessionToken,
  getGithubSessionToken,
} from './githubAuth.js'

export type {
  DispatchPublishOptions,
  IconColorMode,
  IconNameConflict,
  IconUploadPayload,
  PublishReadiness,
  StagedIcon,
  StagedRemoval,
}
export { sanitizeIconName }

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

function getClient() {
  return createGithubAdminClient({ token: getToken(), repo: getRepo() })
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

/** True when the UI can call GitHub write/dispatch APIs. */
export function isGithubAdminEnabled(): boolean {
  return isGithubRepoConfigured() && Boolean(getToken())
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

/** Write icons into the shared staging folder (Contents API, no Action). */
export async function stageIcons(icons: IconUploadPayload[]): Promise<void> {
  return withAuthClear(() => getClient().stageIcons(icons))
}

/** Stage library icon names for removal on next Apply. */
export async function stageRemovals(names: string[]): Promise<void> {
  return withAuthClear(() => getClient().stageRemovals(names))
}

/** Cancel a staged removal marker. */
export async function unstageRemoval(name: string): Promise<void> {
  return withAuthClear(() => getClient().unstageRemoval(name))
}

/** List all staged SVGs currently on main. */
export async function listStagedIcons(): Promise<StagedIcon[]> {
  return withAuthClear(() => getClient().listStagedIcons())
}

/** List staged removal markers. */
export async function listStagedRemovals(): Promise<StagedRemoval[]> {
  return withAuthClear(() => getClient().listStagedRemovals())
}

/** Custom SVGs applied to the library since the last package publish. */
export async function listUnpublishedIcons(): Promise<StagedIcon[]> {
  return withAuthClear(() => getClient().listUnpublishedIcons())
}

/** Library SVGs removed since the last package publish (after Apply). */
export async function listUnpublishedRemovals(): Promise<StagedRemoval[]> {
  return withAuthClear(() => getClient().listUnpublishedRemovals())
}

export async function findIconNameConflicts(
  names: string[],
): Promise<IconNameConflict[]> {
  return withAuthClear(() => getClient().findIconNameConflicts(names))
}

/** Promote whatever is staged now into the library (one Action). */
export async function dispatchApplyStaged(): Promise<void> {
  return withAuthClear(() => getClient().dispatchApplyStaged())
}

export async function getPublishReadiness(): Promise<PublishReadiness> {
  return withAuthClear(() => getClient().getPublishReadiness())
}

export async function dispatchPublish(
  options?: DispatchPublishOptions,
): Promise<void> {
  return withAuthClear(() => getClient().dispatchPublish(options))
}
