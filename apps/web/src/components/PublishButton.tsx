import { useState } from 'react'
import {
  actionsUrl,
  dispatchPublish,
  isGithubAdminEnabled,
  packagesUrl,
} from '../lib/github'

export function PublishButton() {
  const enabled = isGithubAdminEnabled()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!enabled) return null

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
