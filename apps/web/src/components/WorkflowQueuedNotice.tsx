import type { ReactNode } from 'react'

interface WorkflowQueuedNoticeProps {
  workflowLabel: string
  workflowUrl: string
  packagesHref?: string
  className?: string
  extra?: ReactNode
}

/** Shared post-Apply / post-Publish copy with Actions deep link. */
export function WorkflowQueuedNotice({
  workflowLabel,
  workflowUrl,
  packagesHref,
  className,
  extra,
}: WorkflowQueuedNoticeProps) {
  return (
    <p
      className={['copy-toast', 'workflow-toast', className]
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      {workflowLabel} queued.{' '}
      <a href={workflowUrl} target="_blank" rel="noreferrer">
        Track progress on Actions
      </a>
      . Expect about 1–2 minutes, then hard-refresh this page.
      {packagesHref ? (
        <>
          {' '}
          Packages appear under{' '}
          <a href={packagesHref} target="_blank" rel="noreferrer">
            GitHub Packages
          </a>
          .
        </>
      ) : null}
      {extra}
    </p>
  )
}
