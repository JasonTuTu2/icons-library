import {
  actionsUrl as sharedActionsUrl,
  createGithubAdminClient,
  GithubAuthError,
  isValidRepo,
  packagesUrl as sharedPackagesUrl,
  sanitizeIconName,
  type IconColorMode,
  type IconUploadPayload,
  type PublishReadiness,
  type StagedIcon,
} from '@JasonTuTu2/github-admin'
import {
  clearGithubSessionToken,
  getGithubSessionToken,
} from './githubAuth.js'

export type { IconColorMode, IconUploadPayload, PublishReadiness, StagedIcon }
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

export function packagesUrl(): string {
  return sharedPackagesUrl(getRepo())
}

/** Write icons into the shared staging folder (Contents API, no Action). */
export async function stageIcons(icons: IconUploadPayload[]): Promise<void> {
  return withAuthClear(() => getClient().stageIcons(icons))
}

/** List all staged SVGs currently on main. */
export async function listStagedIcons(): Promise<StagedIcon[]> {
  return withAuthClear(() => getClient().listStagedIcons())
}

/** Promote whatever is staged now into the library (one Action). */
export async function dispatchApplyStaged(): Promise<void> {
  return withAuthClear(() => getClient().dispatchApplyStaged())
}

export async function getPublishReadiness(): Promise<PublishReadiness> {
  return withAuthClear(() => getClient().getPublishReadiness())
}

export async function dispatchPublish(): Promise<void> {
  return withAuthClear(() => getClient().dispatchPublish())
}
