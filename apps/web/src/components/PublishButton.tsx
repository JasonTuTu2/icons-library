import { useCallback, useState, type ReactNode } from 'react'
import {
  actionsWorkflowUrl,
  dispatchPublish,
  getPublishReadiness,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  listUnpublishedIcons,
  packagesUrl,
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
      if (readiness.hasNewIcons && !hasUnpublishedSelectionLoaded()) {
        setUnpublishedIcons(await listUnpublishedIcons())
      }

      const selected = getCheckedUnpublishedIcons()
      const deferred = getUncheckedUnpublishedIcons()
      const selectedList = formatPublishIconList(selected)
      const deferredList = formatPublishIconList(deferred)

      if (readiness.stagedCount > 0) {
        const iconsNote =
          selected.length > 0
            ? `\n\nChecked icons that will ship:\n${selectedList}`
            : ''
        const deferNote =
          deferred.length > 0
            ? `\n\nUnchecked icons stay out of this package, then return to the library as unpublished:\n${deferredList}`
            : ''
        const ok = window.confirm(
          `${readiness.stagedCount} staged add(s)/removal(s) are still waiting and will not be included in this publish.\n\nApply staged changes to the library first if you want them shipped.${iconsNote}${deferNote}\n\nPublish package versions anyway?`,
        )
        if (!ok) return
      } else if (!readiness.hasNewIcons) {
        const ok = window.confirm(
          'No custom SVG adds or removals have been applied to the library since the last publish.\n\nPublishing now will only bump package versions — there are no library changes for consumers.\n\nPublish anyway?',
        )
        if (!ok) return
      } else if (selected.length === 0) {
        const ok = window.confirm(
          `No unpublished icons are checked.\n\nAll ${deferred.length} unpublished icon(s) stay out of this package, then return to the library as unpublished for a later release. Publishing will only bump package versions.\n\n${deferredList}\n\nPublish anyway?`,
        )
        if (!ok) return
      } else if (deferred.length > 0) {
        const ok = window.confirm(
          `Publish these icons?\n\n${selectedList}\n\nUnchecked icons stay out of this package, then return to the library as unpublished:\n${deferredList}\n\nBump patch versions and publish to GitHub Packages?`,
        )
        if (!ok) return
      } else {
        const ok = window.confirm(
          `Publish these unpublished icons?\n\n${selectedList}\n\nBump patch versions and publish all packages to GitHub Packages?`,
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
