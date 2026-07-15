import { useState } from 'react'
import {
  actionsUrl,
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
  hasUnpublishedSelectionLoaded,
  setUnpublishedIcons,
} from '../lib/unpublishedSelection'

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
  const [message, setMessage] = useState<string | null>(null)

  if (!repoConfigured) return null

  if (!enabled) {
    return <p className="admin-hint">Connect GitHub to publish</p>
  }

  async function handlePublish() {
    setBusy(true)
    setMessage(null)
    try {
      const readiness = await getPublishReadiness()
      let selected = getCheckedUnpublishedIcons()
      // Warm selection if Publish is used before opening Upload (all checked).
      if (readiness.hasNewIcons && !hasUnpublishedSelectionLoaded()) {
        setUnpublishedIcons(await listUnpublishedIcons())
        selected = getCheckedUnpublishedIcons()
      }
      const selectedList = formatPublishIconList(selected)

      if (readiness.stagedCount > 0) {
        const iconsNote =
          selected.length > 0
            ? `\n\nChecked unpublished icons:\n${selectedList}`
            : ''
        const ok = window.confirm(
          `${readiness.stagedCount} icon(s) are still in staging and will not be included in this publish.\n\nApply staged icons to the library first if you want them shipped.${iconsNote}\n\nPublish package versions anyway?`,
        )
        if (!ok) return
      } else if (!readiness.hasNewIcons) {
        const ok = window.confirm(
          'No new custom SVGs have been applied to the library since the last publish.\n\nPublishing now will only bump package versions — there are no new icons for consumers.\n\nPublish anyway?',
        )
        if (!ok) return
      } else if (selected.length === 0) {
        const ok = window.confirm(
          'No unpublished icons are checked.\n\nPublishing will bump package versions, but you have not selected any unpublished SVGs.\n\nPublish anyway?',
        )
        if (!ok) return
      } else {
        const ok = window.confirm(
          `Publish these unpublished icons?\n\n${selectedList}\n\nBump patch versions and publish all packages to GitHub Packages?`,
        )
        if (!ok) return
      }

      await dispatchPublish()
      setMessage(
        `Publish workflow queued. Packages will appear under ${packagesUrl()}. Track progress: ${actionsUrl()}`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
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
      {message ? <p className="copy-toast publish-toast">{message}</p> : null}
    </div>
  )
}
