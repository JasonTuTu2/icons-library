import { useState, type ReactNode } from 'react'
import { LoginControl } from './LoginControl'
import { PluginLangToggle } from './PluginLangToggle'
import {
  isAuthApiConfigured,
  loginWithPassword,
  useAuthSession,
} from '../lib/sessionAuth'
import { usePluginLocale } from '../lib/pluginI18n'

interface AuthGateProps {
  children: ReactNode
  /** Compact layout for the Figma plugin panel. */
  compact?: boolean
}

/**
 * When the auth API is configured, block the site/plugin until Sign in.
 * Local/dev without VITE_AUTH_API_URL keeps the old open access.
 */
export function AuthGate({ children, compact = false }: AuthGateProps) {
  const configured = isAuthApiConfigured()
  const session = useAuthSession()
  const { t } = usePluginLocale()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!configured || session) {
    if (configured && session && compact) {
      return (
        <div className="plugin-auth-shell">
          <div className="plugin-session-bar">
            <PluginLangToggle />
            <LoginControl variant="plugin-session" />
          </div>
          {children}
        </div>
      )
    }
    return children
  }

  return (
    <div className={compact ? 'auth-gate auth-gate-compact' : 'auth-gate'}>
      <div className="auth-gate-card">
        {compact ? (
          <div className="auth-gate-lang">
            <PluginLangToggle />
          </div>
        ) : null}
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>{compact ? t('brandTitle') : 'GenVoice Icons'}</strong>
            <p>
              {compact ? t('signInPlugin') : 'Sign in to continue'}
            </p>
          </div>
        </div>
        <form
          className="auth-gate-form"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            void loginWithPassword(username, password)
              .then(() => {
                setPassword('')
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err))
              })
              .finally(() => setBusy(false))
          }}
        >
          <label>
            {compact ? t('username') : 'Username'}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
              autoFocus
            />
          </label>
          <label>
            {compact ? t('password') : 'Password'}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="ghost accent" disabled={busy}>
            {busy
              ? compact
                ? t('signingIn')
                : 'Signing in…'
              : compact
                ? t('signIn')
                : 'Sign in'}
          </button>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
