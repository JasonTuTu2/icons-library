import { useCallback, useEffect, useState } from 'react'
import {
  getPublishReadiness,
  listStagedIcons,
  listStagedRemovals,
  listUnpublishedIcons,
  useGithubAdminEnabled,
  usePublishEnabled,
  type PublishReadiness,
} from '../lib/github'
import { getAuthSession, isAuthApiConfigured, useAuthSession } from '../lib/sessionAuth'

/**
 * One-line ops status under the browse toolbar: account, queue, unpublished, ready.
 */
export function BrowserStatusStrip() {
  const session = useAuthSession()
  const adminEnabled = useGithubAdminEnabled()
  const publishEnabled = usePublishEnabled()
  const [stagedCount, setStagedCount] = useState(0)
  const [unpublishedCount, setUnpublishedCount] = useState(0)
  const [readiness, setReadiness] = useState<PublishReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!adminEnabled) return
    setError(null)
    try {
      const [staged, removals, unpublished, ready] = await Promise.all([
        listStagedIcons().catch(() => []),
        listStagedRemovals().catch(() => []),
        listUnpublishedIcons().catch(() => []),
        getPublishReadiness().catch(() => null),
      ])
      setStagedCount(staged.length + removals.length)
      setUnpublishedCount(unpublished.length)
      setReadiness(ready)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [adminEnabled])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh, session?.username])

  if (!isAuthApiConfigured() && !adminEnabled) return null

  const signedIn = session
    ? `${session.username} (${session.role})`
    : getAuthSession()
      ? 'Signed in'
      : isAuthApiConfigured()
        ? 'Not signed in'
        : null

  const queueLabel =
    stagedCount === 0
      ? 'Queue empty'
      : `${stagedCount} in queue`

  const unpublishedLabel =
    unpublishedCount === 0
      ? 'Nothing unpublished'
      : `${unpublishedCount} unpublished`

  let readyLabel = '—'
  if (readiness) {
    if (stagedCount > 0) readyLabel = 'Apply ready'
    else if (publishEnabled && readiness.hasNewIcons) readyLabel = 'Publish ready'
    else if (publishEnabled) readyLabel = 'Publish (version bump only)'
    else if (stagedCount === 0) readyLabel = 'Queue clear'
  }

  return (
    <p className="browser-status-strip" role="status">
      {signedIn ? <span>{signedIn}</span> : null}
      {signedIn ? <span className="browser-status-sep" aria-hidden>·</span> : null}
      <span>{queueLabel}</span>
      <span className="browser-status-sep" aria-hidden>·</span>
      <span>{unpublishedLabel}</span>
      <span className="browser-status-sep" aria-hidden>·</span>
      <span>{readyLabel}</span>
      {error ? (
        <>
          <span className="browser-status-sep" aria-hidden>·</span>
          <span className="browser-status-error">{error}</span>
        </>
      ) : null}
    </p>
  )
}
