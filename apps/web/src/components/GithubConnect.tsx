import { useCallback, useState } from 'react'
import {
  clearGithubSessionToken,
  setGithubSessionToken,
  useGithubSessionToken,
} from '../lib/githubAuth'
import { isGithubRepoConfigured } from '../lib/github'
import { useDialogAccessibility } from '../lib/useDialogAccessibility'

export function GithubConnect() {
  const repoConfigured = isGithubRepoConfigured()
  const token = useGithubSessionToken()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setDraft('')
    setError(null)
  }, [])

  const panelRef = useDialogAccessibility(open && !token, close)

  if (!repoConfigured) return null

  function connect() {
    const value = draft.trim()
    if (!value) {
      setError('Paste a GitHub PAT with contents:write and actions:write.')
      return
    }
    setGithubSessionToken(value)
    setDraft('')
    setError(null)
    setOpen(false)
  }

  function disconnect() {
    clearGithubSessionToken()
    setOpen(false)
    setDraft('')
    setError(null)
  }

  if (token) {
    return (
      <div className="upload-wrap">
        <button type="button" className="ghost" onClick={disconnect}>
          Disconnect GitHub
        </button>
      </div>
    )
  }

  return (
    <div className="upload-wrap">
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        Connect GitHub
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Close connect dialog"
            onClick={close}
          />
          <div
            ref={panelRef}
            className="upload-panel github-connect-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="github-connect-title"
          >
            <div className="upload-panel-header">
              <strong id="github-connect-title">Connect GitHub</strong>
              <button
                type="button"
                className="ghost upload-close"
                onClick={close}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p>
              Paste a fine-grained or classic PAT with{' '}
              <code>contents: write</code> and <code>actions: write</code> on
              this repo. Stored in <code>sessionStorage</code> for this tab
              only — never baked into the Pages build. Action pushes still use
              the <code>ICON_BROWSER_TOKEN</code> repo secret.
            </p>
            <label className="field">
              <span>Personal access token</span>
              <input
                type="password"
                autoComplete="off"
                data-autofocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ghp_… or github_pat_…"
              />
            </label>
            {error ? <p className="copy-toast">{error}</p> : null}
            <button type="button" className="ghost accent" onClick={connect}>
              Save for this session
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
