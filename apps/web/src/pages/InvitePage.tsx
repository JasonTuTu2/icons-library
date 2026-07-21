import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  isAuthApiConfigured,
  peekInvite,
  redeemInvite,
  type AuthRole,
  useAuthSession,
} from '../lib/sessionAuth'

/** Public page: redeem an invite link and create an account. */
export function InvitePage() {
  const configured = isAuthApiConfigured()
  const session = useAuthSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = (params.get('t') ?? '').trim()

  const [role, setRole] = useState<AuthRole | null>(null)
  const [peekError, setPeekError] = useState<string | null>(null)
  const [peeking, setPeeking] = useState(Boolean(token))

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [session, navigate])

  useEffect(() => {
    if (!configured || !token) {
      setPeeking(false)
      return
    }
    let cancelled = false
    setPeeking(true)
    setPeekError(null)
    void peekInvite(token)
      .then((info) => {
        if (!cancelled) setRole(info.role)
      })
      .catch((err) => {
        if (!cancelled) {
          setPeekError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!cancelled) setPeeking(false)
      })
    return () => {
      cancelled = true
    }
  }, [configured, token])

  if (!configured) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <strong>Invites unavailable</strong>
          <p className="invite-lede">
            Auth API is not configured for this build.
          </p>
          <Link to="/">Back to browse</Link>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <strong>Invalid invite</strong>
          <p className="invite-lede">
            This link is missing an invite token. Ask a developer for a new
            invite.
          </p>
          <Link to="/">Sign in</Link>
        </div>
      </div>
    )
  }

  if (peeking) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <p className="invite-lede">Checking invite…</p>
        </div>
      </div>
    )
  }

  if (peekError || !role) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <strong>Invite unavailable</strong>
          <p className="invite-lede" role="alert">
            {peekError ?? 'Invite expired or not found'}
          </p>
          <Link to="/">Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>GenVoice Icons</strong>
            <p>
              Create your {role} account
            </p>
          </div>
        </div>
        <form
          className="auth-gate-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (password !== confirm) {
              setError('Passwords do not match')
              return
            }
            setBusy(true)
            setError(null)
            void redeemInvite(token, username, password)
              .then(() => navigate('/', { replace: true }))
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err))
              })
              .finally(() => setBusy(false))
          }}
        >
          <label>
            Username
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
              autoFocus
              minLength={2}
              maxLength={32}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*"
              title="Letters, numbers, . _ - (2–32 characters)"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              minLength={8}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              required
              minLength={8}
            />
          </label>
          <button type="submit" className="ghost accent" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <p className="invite-lede">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
