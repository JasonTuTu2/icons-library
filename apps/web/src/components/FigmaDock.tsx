import { useEffect, useState, type ReactNode } from 'react'
import {
  findIconNameConflicts,
  isGithubAdminEnabled,
  sanitizeIconName,
  stageIcons,
} from '../lib/github'
import {
  notifyFigmaUiReady,
  requestFigmaExport,
  subscribeFigmaPluginMessages,
  type FigmaExportIcon,
} from '../lib/figmaHost'

interface PendingIcon {
  name: string
  content: string
}

function toPending(icon: FigmaExportIcon): PendingIcon | null {
  const name = sanitizeIconName(icon.name)
  if (!name) return null
  return { name, content: icon.content }
}

function formatConflicts(
  conflicts: Array<{ name: string; location: string }>,
): string {
  return conflicts
    .map((c) => `• gv:${c.name} (${c.location})`)
    .join('\n')
}

/** Figma plugin UI: Load selection + Stage only. */
export function FigmaDock() {
  const [pending, setPending] = useState<PendingIcon[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<ReactNode>(null)
  const githubOk = isGithubAdminEnabled()

  useEffect(() => {
    notifyFigmaUiReady()
    return subscribeFigmaPluginMessages((msg) => {
      if (msg.type !== 'export-result') return
      setBusy(false)
      const next = msg.icons
        .map(toPending)
        .filter((icon): icon is PendingIcon => icon !== null)
      setPending(next)
      if (msg.error) {
        setMessage(msg.error)
      } else if (next.length === 0) {
        setMessage(
          msg.icons.length === 0
            ? 'No exportable nodes in selection.'
            : 'Loaded icons had invalid names (use kebab-case layer names).',
        )
      } else {
        setMessage(
          `Loaded ${next.length} icon(s): ${next.map((i) => `gv:${i.name}`).join(', ')}`,
        )
      }
    })
  }, [])

  function handleLoad(): void {
    setMessage(null)
    setBusy(true)
    requestFigmaExport()
  }

  async function handleStage(): Promise<void> {
    if (pending.length === 0 || !githubOk) return
    setBusy(true)
    setMessage(null)
    try {
      const payloads = pending.map((icon) => ({
        name: icon.name,
        content: icon.content,
        colorMode: 'mono' as const,
      }))

      const conflicts = await findIconNameConflicts(
        payloads.map((p) => p.name),
      )
      if (conflicts.length > 0) {
        const ok = window.confirm(
          `Name conflict(s) found — staging will overwrite existing files:\n\n${formatConflicts(conflicts)}\n\nContinue?`,
        )
        if (!ok) return
      }

      const count = payloads.length
      await stageIcons(payloads)
      setPending([])
      setMessage(`Staged ${count} icon(s).`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="figma-dock" aria-label="Figma export">
      <h1 className="figma-dock-title">GenVoice Icons</h1>
      <div className="figma-dock-actions">
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={handleLoad}
        >
          {busy ? 'Working…' : 'Load selection'}
        </button>
        <button
          type="button"
          className="ghost accent"
          disabled={busy || pending.length === 0 || !githubOk}
          onClick={() => void handleStage()}
        >
          Stage
        </button>
      </div>
      {!githubOk ? (
        <p className="figma-dock-hint">
          GitHub write token missing — redeploy Pages with{' '}
          <code>ICON_BROWSER_TOKEN</code>.
        </p>
      ) : (
        <p className="figma-dock-hint">
          Select frames on the canvas, Load, then Stage.
        </p>
      )}
      {message ? (
        <p className="figma-dock-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  )
}
