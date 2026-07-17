import { useEffect, useState, type ReactNode } from 'react'
import {
  findIconNameConflicts,
  isGithubAdminEnabled,
  sanitizeIconName,
  stageIcons,
  type IconColorMode,
} from '../lib/github'
import {
  fullIconBrowserUrl,
  notifyFigmaUiReady,
  openExternalUrl,
  requestFigmaExport,
  subscribeFigmaPluginMessages,
  type FigmaExportIcon,
} from '../lib/figmaHost'

interface PendingIcon {
  id: string
  name: string
  content: string
  previewUrl: string
  colorMode: IconColorMode
}

function toPending(icon: FigmaExportIcon): PendingIcon {
  const name = sanitizeIconName(icon.name) ?? icon.name
  return {
    id: icon.id,
    name,
    content: icon.content,
    previewUrl: URL.createObjectURL(
      new Blob([icon.content], { type: 'image/svg+xml' }),
    ),
    colorMode: 'mono',
  }
}

function revokeAll(icons: PendingIcon[]): void {
  for (const icon of icons) URL.revokeObjectURL(icon.previewUrl)
}

function formatConflicts(
  conflicts: Array<{ name: string; location: string }>,
): string {
  return conflicts
    .map((c) => `• gv:${c.name} (${c.location})`)
    .join('\n')
}

/**
 * Figma plugin panel: Load, rename/color, Stage, link to full browser.
 * No catalog browse UI.
 */
export function FigmaDock() {
  const [pending, setPending] = useState<PendingIcon[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<ReactNode>(null)
  const githubOk = isGithubAdminEnabled()
  const browserUrl = fullIconBrowserUrl()

  useEffect(() => {
    notifyFigmaUiReady()
    return subscribeFigmaPluginMessages((msg) => {
      if (msg.type !== 'export-result') return
      setBusy(false)
      setPending((prev) => {
        revokeAll(prev)
        return msg.icons.map(toPending)
      })
      if (msg.error) {
        setMessage(msg.error)
      } else if (msg.icons.length === 0) {
        setMessage('No exportable nodes in selection.')
      } else {
        setMessage(`Loaded ${msg.icons.length} icon(s). Edit names, then Stage.`)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      setPending((prev) => {
        revokeAll(prev)
        return []
      })
    }
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
      const payloads = pending.map((icon) => {
        const name = sanitizeIconName(icon.name)
        if (!name) {
          throw new Error(
            `Invalid icon name "${icon.name}". Use kebab-case, e.g. billing-alert.`,
          )
        }
        return {
          name,
          content: icon.content,
          colorMode: icon.colorMode,
        }
      })

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
      setPending((prev) => {
        revokeAll(prev)
        return []
      })
      setMessage(
        `Staged ${count} icon(s). Open the icon browser to Apply or Publish.`,
      )
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
          Load from the canvas, set Mono/Multi and names, then Stage.
        </p>
      )}
      {pending.length > 0 ? (
        <ul className="figma-dock-list">
          {pending.map((icon, index) => (
            <li key={icon.id}>
              <img src={icon.previewUrl} alt="" width={24} height={24} />
              <label>
                <span>gv:</span>
                <input
                  type="text"
                  value={icon.name}
                  onChange={(e) => {
                    const value = e.target.value
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, name: value } : row,
                      ),
                    )
                  }}
                />
              </label>
              <select
                aria-label={`Color mode for gv:${icon.name || 'icon'}`}
                value={icon.colorMode}
                onChange={(e) => {
                  const colorMode =
                    e.target.value === 'preserved' ? 'preserved' : 'mono'
                  setPending((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, colorMode } : row,
                    ),
                  )
                }}
              >
                <option value="mono">Mono</option>
                <option value="preserved">Multi</option>
              </select>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setPending((prev) => {
                    const target = prev[index]
                    if (target) URL.revokeObjectURL(target.previewUrl)
                    return prev.filter((_, i) => i !== index)
                  })
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p className="figma-dock-message" role="status">
          {message}
        </p>
      ) : null}
      <p className="figma-dock-link">
        <a
          href={browserUrl}
          onClick={(e) => {
            e.preventDefault()
            openExternalUrl(browserUrl)
          }}
        >
          Open full icon browser
        </a>
      </p>
    </section>
  )
}
