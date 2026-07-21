import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  buildInviteUrl,
  createAuthInvite,
  isAuthApiConfigured,
  listAuthInvites,
  listAuthUsers,
  revokeAuthInvite,
  type AuthInvite,
  type AuthRole,
  type AuthUserRow,
  useAuthSession,
} from '../lib/sessionAuth'

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

/** Dev-only: create invite links and see KV accounts. */
export function UsersPage() {
  const configured = isAuthApiConfigured()
  const session = useAuthSession()
  const [users, setUsers] = useState<AuthUserRow[]>([])
  const [invites, setInvites] = useState<AuthInvite[]>([])
  const [role, setRole] = useState<AuthRole>('designer')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    const [nextUsers, nextInvites] = await Promise.all([
      listAuthUsers(),
      listAuthInvites(),
    ])
    setUsers(nextUsers)
    setInvites(nextInvites)
  }, [])

  useEffect(() => {
    if (!configured || session?.role !== 'dev') {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void refresh()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [configured, session?.role, refresh])

  if (!configured) {
    return <Navigate to="/" replace />
  }
  if (!session || session.role !== 'dev') {
    return <Navigate to="/" replace />
  }

  return (
    <article className="users-page">
      <h1>Accounts</h1>
      <p className="lede">
        Invite designers (or other devs) with a one-time link. They choose their
        own username and password — no Wrangler secret edits.
      </p>

      <section className="users-create">
        <h2>New invite</h2>
        <form
          className="users-invite-form"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            setCopied(false)
            void createAuthInvite(role)
              .then(async (invite) => {
                const url = buildInviteUrl(invite.token)
                setLastLink(url)
                await refresh()
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : String(err))
              })
              .finally(() => setBusy(false))
          }}
        >
          <label>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AuthRole)}
              disabled={busy}
            >
              <option value="designer">designer</option>
              <option value="dev">dev</option>
            </select>
          </label>
          <button type="submit" className="ghost accent" disabled={busy}>
            {busy ? 'Creating…' : 'Create invite link'}
          </button>
        </form>
        {lastLink ? (
          <div className="users-invite-result">
            <label>
              Copy and send this link
              <input type="text" readOnly value={lastLink} />
            </label>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(lastLink).then(() => {
                  setCopied(true)
                })
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2>Pending invites</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="muted">No open invites.</p>
        ) : (
          <ul className="users-list">
            {invites.map((invite) => (
              <li key={invite.token}>
                <div>
                  <strong>{invite.role}</strong>
                  <span className="muted">
                    {' '}
                    · by {invite.createdBy} · expires{' '}
                    {formatWhen(invite.expiresAt)}
                  </span>
                </div>
                <div className="users-list-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const url = buildInviteUrl(invite.token)
                      void navigator.clipboard.writeText(url)
                    }}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setBusy(true)
                      setError(null)
                      void revokeAuthInvite(invite.token)
                        .then(() => refresh())
                        .catch((err) => {
                          setError(
                            err instanceof Error ? err.message : String(err),
                          )
                        })
                        .finally(() => setBusy(false))
                    }}
                    disabled={busy}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Accounts</h2>
        <p className="muted users-hint">
          Accounts created via invite (and secret users after their first sign-in)
          appear here.
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="muted">No KV accounts yet — sign in once to migrate, or invite someone.</p>
        ) : (
          <ul className="users-list">
            {users.map((user) => (
              <li key={user.username}>
                <div>
                  <strong>{user.username}</strong>
                  <span className="muted">
                    {' '}
                    · {user.role} · since {formatWhen(user.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
