import type { StagedIcon, StagedRemoval } from '../lib/github'
import { GithubAssetPreview } from './GithubAssetPreview'

interface PublishConfirmDialogProps {
  open: boolean
  title: string
  body: string
  bumpLabel: string
  selected: StagedIcon[]
  deferred: StagedIcon[]
  removals: StagedRemoval[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ThumbRow({
  label,
  icons,
}: {
  label: string
  icons: StagedIcon[]
}) {
  if (icons.length === 0) return null
  return (
    <div className="publish-confirm-group">
      <strong>
        {label} ({icons.length})
      </strong>
      <ul className="publish-confirm-thumbs">
        {icons.map((icon) => (
          <li key={icon.path || `${icon.kind}:${icon.name}`}>
            <GithubAssetPreview
              path={icon.path}
              colorMode={icon.colorMode}
              isImage={icon.kind === 'image'}
              title={icon.name}
            />
            <span>
              {icon.kind === 'image' ? 'img:' : 'ci:'}
              {icon.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Publish confirmation with thumbnails (replaces window.confirm name lists).
 */
export function PublishConfirmDialog({
  open,
  title,
  body,
  bumpLabel,
  selected,
  deferred,
  removals,
  busy,
  onCancel,
  onConfirm,
}: PublishConfirmDialogProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="panel-backdrop"
        aria-label="Cancel publish"
        onClick={onCancel}
      />
      <div
        className="publish-confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-confirm-title"
      >
        <div className="upload-panel-header">
          <strong id="publish-confirm-title">{title}</strong>
          <button
            type="button"
            className="ghost upload-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="publish-confirm-body">{body}</p>
        <ThumbRow label="Publishing" icons={selected} />
        <ThumbRow
          label="Deferred (stay unpublished)"
          icons={deferred}
        />
        {removals.length > 0 ? (
          <div className="publish-confirm-group">
            <strong>Removals ({removals.length})</strong>
            <ul className="publish-confirm-thumbs">
              {removals.map((row) => (
                <li key={row.path || row.name}>
                  <GithubAssetPreview libraryName={row.name} title={row.name} />
                  <span>{row.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="publish-confirm-bump">{bumpLabel}</p>
        <div className="publish-confirm-actions">
          <button type="button" className="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="ghost accent"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </>
  )
}
