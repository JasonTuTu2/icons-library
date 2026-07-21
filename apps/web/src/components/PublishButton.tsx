import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  actionsWorkflowUrl,
  dispatchPublish,
  getPublishedPackageVersion,
  getPublishReadiness,
  listUnpublishedIcons,
  listUnpublishedRemovals,
  packagesUrl,
  usePublishEnabled,
  type StagedIcon,
  type StagedRemoval,
} from '../lib/github'
import { formatVersionBumpLabel } from '../lib/formatVersionBumpLabel'
import {
  getCheckedUnpublishedIcons,
  getUncheckedUnpublishedIcons,
  hasUnpublishedSelectionLoaded,
  setUnpublishedIcons,
} from '../lib/unpublishedSelection'
import { WorkflowQueuedNotice } from './WorkflowQueuedNotice'
import { PublishConfirmDialog } from './PublishConfirmDialog'
import { ChromeIcon } from './ChromeIcon'

function stagedWaitingSummary(addCount: number, removalCount: number): string {
  const parts: string[] = []
  if (addCount > 0) parts.push(`${addCount} staged add${addCount === 1 ? '' : 's'}`)
  if (removalCount > 0) {
    parts.push(
      `${removalCount} staged removal${removalCount === 1 ? '' : 's'}`,
    )
  }
  return parts.join(' and ')
}

type ConfirmState = {
  title: string
  body: string
  bumpLabel: string
  selected: StagedIcon[]
  deferred: StagedIcon[]
  removals: StagedRemoval[]
  deferPaths: string[]
  versionBump: 'patch' | 'minor' | 'major'
}

export function PublishButton() {
  const enabled = usePublishEnabled()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<ReactNode>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const runPublish = useCallback(
    async (state: ConfirmState) => {
      setBusy(true)
      setNotice(null)
      try {
        await dispatchPublish({
          deferPaths: state.deferPaths,
          versionBump: state.versionBump,
        })
        setConfirm(null)
        setNotice(
          <WorkflowQueuedNotice
            className="publish-toast"
            workflowLabel="Publish workflow"
            workflowUrl={actionsWorkflowUrl('publish-packages.yml')}
            packagesHref={packagesUrl()}
          />,
        )
      } catch (err) {
        setNotice(
          <p className="copy-toast publish-toast" role="status">
            {err instanceof Error ? err.message : String(err)}
          </p>,
        )
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const handlePublish = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    try {
      const readiness = await getPublishReadiness()
      const [unpublished, removals] = await Promise.all([
        readiness.hasNewIcons && !hasUnpublishedSelectionLoaded()
          ? listUnpublishedIcons()
          : Promise.resolve(null),
        listUnpublishedRemovals(),
      ])
      if (unpublished) setUnpublishedIcons(unpublished)

      const selected = getCheckedUnpublishedIcons()
      const deferred = getUncheckedUnpublishedIcons()
      const publishingReplacements = selected.some(
        (icon) => icon.changeKind === 'replace',
      )
      const publishingRemovals = removals.length > 0
      let versionBump: 'patch' | 'minor' | 'major' = 'patch'
      if (publishingReplacements) versionBump = 'minor'
      if (publishingRemovals) versionBump = 'major'

      const currentVersion = await getPublishedPackageVersion()
      const bumpLabel = formatVersionBumpLabel(currentVersion, versionBump)

      let title = 'Publish package?'
      let body = 'Ship checked unpublished icons to GitHub Packages.'

      if (readiness.stagedCount > 0) {
        const waiting = stagedWaitingSummary(
          readiness.stagedAddCount,
          readiness.stagedRemovalCount,
        )
        title = 'Publish while queue is waiting?'
        body = `${waiting} still in your staging queue and will not be included. Apply first if you want those shipped.`
      } else if (!readiness.hasNewIcons) {
        title = 'Version bump only?'
        body =
          'No custom SVG adds or removals since the last publish. This only bumps package versions.'
      } else if (selected.length === 0 && removals.length === 0) {
        title = 'Nothing checked to publish?'
        body = `No unpublished adds are checked and there are no applied removals. Unchecked adds (${deferred.length}) stay out of this package.`
      } else if (selected.length === 0) {
        title = 'Publish removals only?'
        body = 'No unpublished adds are checked. Removals below will ship; deferred adds stay unpublished.'
      }

      setConfirm({
        title,
        body,
        bumpLabel,
        selected,
        deferred,
        removals,
        deferPaths: deferred.map((icon) => icon.path),
        versionBump,
      })
    } catch (err) {
      setNotice(
        <p className="copy-toast publish-toast" role="status">
          {err instanceof Error ? err.message : String(err)}
        </p>,
      )
    } finally {
      setBusy(false)
    }
  }, [])

  if (!enabled) return null

  return (
    <div className="upload-wrap">
      <button
        type="button"
        className="toolbar-btn toolbar-btn-publish"
        disabled={busy}
        onClick={() => void handlePublish()}
      >
        <ChromeIcon name="ci:checkmark-circle-filled" />
        {busy && !confirm ? 'Preparing…' : 'Publish'}
      </button>
      {notice}
      {confirm
        ? createPortal(
            <PublishConfirmDialog
              open
              title={confirm.title}
              body={confirm.body}
              bumpLabel={confirm.bumpLabel}
              selected={confirm.selected}
              deferred={confirm.deferred}
              removals={confirm.removals}
              busy={busy}
              onCancel={() => setConfirm(null)}
              onConfirm={() => void runPublish(confirm)}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
