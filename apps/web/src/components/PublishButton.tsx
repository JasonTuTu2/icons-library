import { useState } from 'react'
import {
  actionsUrl,
  dispatchPublish,
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
    const ok = window.confirm(
      'Bump patch versions and publish all packages to GitHub Packages?',
    )
    if (!ok) return

    setBusy(true)
    setMessage(null)
    try {
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
