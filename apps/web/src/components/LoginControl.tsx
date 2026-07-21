import { useState } from 'react'
import {
  clearAuthSession,
  isAuthApiConfigured,
  loginWithPassword,
  useAuthSession,
} from '../lib/sessionAuth'
import { usePluginLocale } from '../lib/pluginI18n'

/** Topbar session control (Sign out). Sign-in UI lives in AuthGate. */
export function LoginControl({
  variant = 'topbar',
}: {
  /** Plugin: only signed-in user + Sign out (login is AuthGate). */
  variant?: 'topbar' | 'plugin-session'
}) {
  const configured = isAuthApiConfigured()
  const session = useAuthSession()
  const { t } = usePluginLocale()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!configured) return null

  if (session) {
    const signedInTitle =
      variant === 'plugin-session'
        ? `${t('signedInAs')} ${session.role}`
        : `Signed in as ${session.role}`
    return (
      <div
        className={
          variant === 'plugin-session'
            ? 'login-control login-control-plugin'
            : 'login-control'
        }
      >
        <span className="login-user" title={signedInTitle}>
          {session.username}
          <span className="login-role"> · {session.role}</span>
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() => clearAuthSession()}
        >
          {variant === 'plugin-session' ? t('signOut') : 'Sign out'}
        </button>
      </div>
    )
  }

  if (variant === 'plugin-session') {
    return null
  }

  return (
    <div className="login-control">
      {open ? (
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            void loginWithPassword(username, password)
              .then(() => {
                setPassword('')
                setOpen(false)
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err))
              })
              .finally(() => setBusy(false))
          }}
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            required
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
          <button type="submit" className="ghost accent" disabled={busy}>
            {busy ? '…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              setError(null)
            }}
          >
            Cancel
          </button>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          className="ghost accent"
          onClick={() => setOpen(true)}
        >
          Sign in
        </button>
      )}
    </div>
  )
}
