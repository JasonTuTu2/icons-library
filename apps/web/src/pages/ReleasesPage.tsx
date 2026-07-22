import { useEffect, useState } from 'react'
import type { PublishHistoryEntry, StagedIcon, StagedRemoval } from '../lib/github'
import {
  commitUrl,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  listUnpublishedIcons,
  listUnpublishedRemovals,
  packagesUrl,
} from '../lib/github'
import { loadPublishHistory } from '../lib/loadPublishHistory'
import {
  formatPublishedDate,
  iconListLabel,
  summarizeRelease,
} from '../lib/releaseSummary'

function IconNameList({
  adds,
  removals,
}: {
  adds: StagedIcon[]
  removals: StagedRemoval[]
}) {
  if (adds.length === 0 && removals.length === 0) return null
  return (
    <div className="release-detail-lists">
      {adds.length > 0 ? (
        <div>
          <h4>Added</h4>
          <ul>
            {adds.map((icon) => (
              <li key={`add-${icon.path}`}>
                <code>{iconListLabel(icon)}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {removals.length > 0 ? (
        <div>
          <h4>Removed</h4>
          <ul>
            {removals.map((icon) => (
              <li key={`rm-${icon.path}`}>{icon.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ReleaseCard({ entry }: { entry: PublishHistoryEntry }) {
  const [open, setOpen] = useState(false)
  const hasDetail = entry.adds.length > 0 || entry.removals.length > 0
  const summary = summarizeRelease(entry)

  return (
    <article className="release-card">
      <div className="release-card-head">
        <div>
          <h2>
            <a href={packagesUrl()} target="_blank" rel="noreferrer">
              v{entry.version}
            </a>
          </h2>
          <p className="release-meta">
            {formatPublishedDate(entry.publishedAt)}
            {' · '}
            <a href={commitUrl(entry.commitSha)} target="_blank" rel="noreferrer">
              View commit
            </a>
          </p>
        </div>
        {hasDetail ? (
          <button
            type="button"
            className="release-expand"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide icons' : 'Show icons'}
          </button>
        ) : null}
      </div>
      <p className="release-summary">{summary}</p>
      {open && hasDetail ? (
        <IconNameList adds={entry.adds} removals={entry.removals} />
      ) : null}
    </article>
  )
}

export function ReleasesPage() {
  const [history, setHistory] = useState<PublishHistoryEntry[] | null>(null)
  const [pendingAdds, setPendingAdds] = useState<StagedIcon[]>([])
  const [pendingRemovals, setPendingRemovals] = useState<StagedRemoval[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      setLoading(true)
      setError(null)
      try {
        const entries = await loadPublishHistory()
        if (cancelled) return
        setHistory(entries)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isGithubRepoConfigured() || !isGithubAdminEnabled()) return
    let cancelled = false
    setPendingLoading(true)
    void Promise.all([listUnpublishedIcons(), listUnpublishedRemovals()])
      .then(([adds, removals]) => {
        if (cancelled) return
        setPendingAdds(adds)
        setPendingRemovals(removals)
      })
      .catch(() => {
        // Pending section is optional; static history still works.
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pendingSummary =
    pendingAdds.length === 0 && pendingRemovals.length === 0
      ? null
      : [
          pendingAdds.length > 0
            ? `${pendingAdds.length} add${pendingAdds.length === 1 ? '' : 's'}`
            : null,
          pendingRemovals.length > 0
            ? `${pendingRemovals.length} removal${pendingRemovals.length === 1 ? '' : 's'}`
            : null,
        ]
          .filter(Boolean)
          .join(', ')

  return (
    <article className="docs releases">
      <h1>Release history</h1>
      <p className="lede">
        What shipped in each published package version — new icons, removals, and
        version-only bumps. Maintainers publish from Browse; this list updates
        after each release.
      </p>

      {loading ? (
        <p className="release-muted" role="status">
          Loading release history…
        </p>
      ) : error ? (
        <p className="release-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          {pendingSummary ? (
            <section className="release-pending">
              <h2>Since last publish (not released yet)</h2>
              <p>
                Applied to the library but not in a package yet:{' '}
                <strong>{pendingSummary}</strong>.
              </p>
              <IconNameList adds={pendingAdds} removals={pendingRemovals} />
              <p className="release-muted">
                After a maintainer runs <strong>Publish</strong>, these changes
                appear in the next version below.
              </p>
            </section>
          ) : pendingLoading ? (
            <p className="release-muted" role="status">
              Checking for unpublished library changes…
            </p>
          ) : null}

          {history && history.length > 0 ? (
            <section className="release-list">
              {history.map((entry) => (
                <ReleaseCard key={entry.commitSha} entry={entry} />
              ))}
            </section>
          ) : (
            <p className="release-muted" role="status">
              No published versions found yet.
            </p>
          )}
        </>
      )}
    </article>
  )
}
