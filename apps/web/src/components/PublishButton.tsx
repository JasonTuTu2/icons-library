import { useState } from 'react'
import {
  actionsUrl,
  dispatchPublish,
  getPublishReadiness,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  packagesUrl,
} from '../lib/github'
import { useGithubSessionToken } from '../lib/githubAuth'

export function PublishButton() {
  useGithubSessionToken()
  const repoConfigured = isGithubRepoConfigured()
  const enabled = isGithubAdminEnabled()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!repoConfigured) return null

  if (!enabled) {
    return <p className="admin-hint">Connect GitHub to publish</p>
  }

  async function handlePublish() {
    setBusy(true)
    setMessage(null)
    try {
      const readiness = await getPublishReadiness()

      if (readiness.stagedCount > 0) {
        const ok = window.confirm(
          `${readiness.stagedCount} icon(s) are still in staging and will not be included in this publish.\n\nApply staged icons to the library first if you want them shipped.\n\nPublish package versions anyway?`,
        )
        if (!ok) return
      } else if (!readiness.hasNewIcons) {
        const ok = window.confirm(
          'No new custom SVGs have been applied to the library since the last publish.\n\nPublishing now will only bump package versions — there are no new icons for consumers.\n\nPublish anyway?',
        )
        if (!ok) return
      } else {
        const ok = window.confirm(
          'Bump patch versions and publish all packages to GitHub Packages?',
        )
        if (!ok) return
      }

      await dispatchPublish()
      setMessage(
        `Publish workflow queued. Packages will appear under ${packagesUrl()}. Track progress: ${actionsUrl()}`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="upload-wrap">
      <button
        type="button"
        className="ghost accent"
        disabled={busy}
        onClick={() => void handlePublish()}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
      {message ? <p className="copy-toast publish-toast">{message}</p> : null}
    </div>
  )
}
