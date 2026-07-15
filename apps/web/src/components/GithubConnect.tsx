import { useState } from 'react'
import {
  clearGithubSessionToken,
  setGithubSessionToken,
  useGithubSessionToken,
} from '../lib/githubAuth'
import { isGithubRepoConfigured } from '../lib/github'

export function GithubConnect() {
  const repoConfigured = isGithubRepoConfigured()
  const token = useGithubSessionToken()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

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
        <div className="upload-panel github-connect-panel">
          <div className="upload-panel-header">
            <strong>Connect GitHub</strong>
            <button
              type="button"
              className="ghost upload-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p>
            Paste a fine-grained or classic PAT with{' '}
            <code>contents: write</code> and <code>actions: write</code> on this
            repo. Stored in <code>sessionStorage</code> for this tab only — never
            baked into the Pages build. Action pushes still use the{' '}
            <code>ICON_BROWSER_TOKEN</code> repo secret.
          </p>
          <label className="field">
            <span>Personal access token</span>
            <input
              type="password"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="ghp_… or github_pat_…"
            />
          </label>
          {error ? <p className="copy-toast">{error}</p> : null}
          <button
            type="button"
            className="ghost accent"
            onClick={connect}
          >
            Save for this session
          </button>
        </div>
      ) : null}
    </div>
  )
}
