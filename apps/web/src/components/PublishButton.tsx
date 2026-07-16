import { useCallback, useState, type ReactNode } from 'react'
import {
  actionsWorkflowUrl,
  dispatchPublish,
  getPublishReadiness,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  listUnpublishedIcons,
  listUnpublishedRemovals,
  packagesUrl,
  type StagedRemoval,
} from '../lib/github'
import { useGithubSessionToken } from '../lib/githubAuth'
import {
  getCheckedUnpublishedIcons,
  getUncheckedUnpublishedIcons,
  hasUnpublishedSelectionLoaded,
  setUnpublishedIcons,
} from '../lib/unpublishedSelection'
import { WorkflowQueuedNotice } from './WorkflowQueuedNotice'

function formatPublishIconList(
  icons: Array<{ name: string; colorMode: string }>,
): string {
  return icons
    .map(
      (icon) =>
        `• gv:${icon.name} (${icon.colorMode === 'preserved' ? 'multi-color' : 'mono'})`,
    )
    .join('\n')
}

function formatRemovalList(removals: StagedRemoval[]): string {
  return removals.map((icon) => `• gv:${icon.name}`).join('\n')
}

function addsNote(
  icons: Array<{ name: string; colorMode: string }>,
  label = 'Adds',
): string {
  if (icons.length === 0) return ''
  return `\n\n${label} (${icons.length}):\n${formatPublishIconList(icons)}`
}

function removalsNote(removals: StagedRemoval[]): string {
  if (removals.length === 0) return ''
  return `\n\nRemovals (${removals.length}):\n${formatRemovalList(removals)}`
}

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

export function PublishButton() {
  useGithubSessionToken()
  const repoConfigured = isGithubRepoConfigured()
  const enabled = isGithubAdminEnabled()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<ReactNode>(null)

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
      const addSection = addsNote(selected)
      const deferSection = addsNote(
        deferred,
        'Unchecked adds (stay out of this package, then return to the library)',
      )
      const removeSection = removalsNote(removals)

      if (readiness.stagedCount > 0) {
        const waiting = stagedWaitingSummary(
          readiness.stagedAddCount,
          readiness.stagedRemovalCount,
        )
        const ok = window.confirm(
          `${waiting} still waiting and will not be included in this publish.\n\nApply staged changes to the library first if you want them shipped.${addSection}${deferSection}${removeSection}\n\nPublish package versions anyway?`,
        )
        if (!ok) return
      } else if (!readiness.hasNewIcons) {
        const ok = window.confirm(
          'No custom SVG adds or removals have been applied to the library since the last publish.\n\nPublishing now will only bump package versions — there are no library changes for consumers.\n\nPublish anyway?',
        )
        if (!ok) return
      } else if (selected.length === 0 && removals.length === 0) {
        const ok = window.confirm(
          `No unpublished adds are checked and there are no applied removals.\n\nUnchecked adds (${deferred.length}) stay out of this package, then return to the library as unpublished. Publishing will only bump package versions.${deferSection}\n\nPublish anyway?`,
        )
        if (!ok) return
      } else if (selected.length === 0) {
        const ok = window.confirm(
          `No unpublished adds are checked.${removeSection}${deferSection}\n\nBump patch versions and publish to GitHub Packages?`,
        )
        if (!ok) return
      } else {
        const ok = window.confirm(
          `Publish these changes?${addSection}${removeSection}${deferSection}\n\nBump patch versions and publish to GitHub Packages?`,
        )
        if (!ok) return
      }

      await dispatchPublish({
        deferPaths: deferred.map((icon) => icon.path),
      })
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
  }, [])

  if (!repoConfigured) return null

  if (!enabled) {
    return <p className="admin-hint">Connect GitHub to publish</p>
  }

  return (
    <div className="upload-wrap">
      <button
        type="button"
        className="ghost accent"
        disabled={busy}
        onClick={() => void handlePublish()}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
      {notice}
    </div>
  )
}
