import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  detectVariantFromName,
  detectVariantSuffix,
  findIconNameConflicts,
  isGithubAdminEnabled,
  sanitizeIconName,
  stageIcons,
  type IconColorMode,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from '../lib/github'
import { detectSvgColorMode } from '../lib/detectSvgColorMode'
import { conflictMessagesForItems } from '../lib/nameConflicts'
import {
  fullIconBrowserUrl,
  notifyFigmaUiReady,
  openExternalUrl,
  requestFigmaExport,
  subscribeFigmaPluginMessages,
  type FigmaExportIcon,
} from '../lib/figmaHost'
import { ApplyAllFields } from './ApplyAllFields'
import { CategorySelect } from './CategorySelect'
import { VariantSelect } from './VariantSelect'
import { SourceSelect } from './SourceSelect'
import { UsageSelect } from './UsageSelect'
import {
  loadCategoryRegistry,
  mergeCategoryIntoRegistry,
} from '../lib/categories'

interface PendingIcon {
  id: string
  name: string
  content: string
  previewUrl: string
  colorMode: IconColorMode
  category: string
  variant: IconVariant
  source: IconSource
  usage: IconUsage
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
    colorMode: detectSvgColorMode(icon.content),
    category: '',
    variant: detectVariantFromName(name),
    source: 'custom',
    usage: 'in-use',
  }
}

function revokeAll(icons: PendingIcon[]): void {
  for (const icon of icons) URL.revokeObjectURL(icon.previewUrl)
}

/**
 * Figma plugin panel: Load, rename/color/category, Stage, link to full browser.
 * No catalog browse UI.
 */
export function FigmaDock() {
  const [pending, setPending] = useState<PendingIcon[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<ReactNode>(null)
  const [nameConflictMsgs, setNameConflictMsgs] = useState<string[]>([])
  const [conflictsChecking, setConflictsChecking] = useState(false)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const githubOk = isGithubAdminEnabled()
  const browserUrl = fullIconBrowserUrl()

  const namesValid = useMemo(
    () =>
      pending.length > 0 &&
      pending.every((icon) => sanitizeIconName(icon.name) !== null),
    [pending],
  )
  const hasNameConflicts = nameConflictMsgs.some((msg) => msg.length > 0)
  const canStage =
    githubOk && namesValid && !hasNameConflicts && !conflictsChecking && !busy

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
    if (!githubOk) return
    let cancelled = false
    void loadCategoryRegistry()
      .then(({ categories }) => {
        if (!cancelled) setCategoryRegistry(categories)
      })
      .catch(() => {
        if (!cancelled) setCategoryRegistry([])
      })
    return () => {
      cancelled = true
    }
  }, [githubOk])

  useEffect(() => {
    return () => {
      setPending((prev) => {
        revokeAll(prev)
        return []
      })
    }
  }, [])

  useEffect(() => {
    if (!githubOk || pending.length === 0) {
      setNameConflictMsgs([])
      setConflictsChecking(false)
      return
    }

    const asSvg = pending.map((icon) => ({
      name: icon.name,
      kind: 'svg' as const,
    }))
    setNameConflictMsgs(conflictMessagesForItems(asSvg, []))

    const names = [
      ...new Set(
        pending
          .map((icon) => sanitizeIconName(icon.name))
          .filter((n): n is string => Boolean(n)),
      ),
    ]
    if (names.length === 0) {
      setConflictsChecking(false)
      return
    }

    let cancelled = false
    setConflictsChecking(true)
    const timer = window.setTimeout(() => {
      void findIconNameConflicts(names)
        .then((remote) => {
          if (cancelled) return
          setNameConflictMsgs(conflictMessagesForItems(asSvg, remote))
        })
        .catch((err) => {
          if (cancelled) return
          setMessage(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (!cancelled) setConflictsChecking(false)
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pending, githubOk])

  function handleLoad(): void {
    setMessage(null)
    setBusy(true)
    requestFigmaExport()
  }

  async function handleStage(): Promise<void> {
    if (!canStage || pending.length === 0) return
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
          category: icon.category,
          variant: icon.variant,
          source: icon.source,
          usage: icon.usage,
        }
      })

      const remote = await findIconNameConflicts(payloads.map((p) => p.name))
      const blocking = conflictMessagesForItems(
        payloads.map((p) => ({ name: p.name, kind: 'svg' as const })),
        remote,
      )
      if (blocking.some((msg) => msg.length > 0)) {
        setNameConflictMsgs(blocking)
        setMessage(
          'Rename icons that already exist in the library or staging before staging.',
        )
        return
      }

      const count = payloads.length
      await stageIcons(payloads)
      setPending((prev) => {
        revokeAll(prev)
        return []
      })
      setNameConflictMsgs([])
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
          className="figma-btn"
          disabled={busy}
          onClick={handleLoad}
        >
          {busy ? 'Working…' : 'Load selection'}
        </button>
        <button
          type="button"
          className="figma-btn figma-btn-primary"
          disabled={!canStage}
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
          Load from the canvas, set Mono/Multi, category, variant, source,
          usage, and names, then Stage. Names already in the library or staging
          must be changed first.
        </p>
      )}
      {pending.length > 0 ? (
        <>
          <ApplyAllFields
            categories={categoryRegistry}
            onCreateCategory={(name) =>
              setCategoryRegistry((prev) => mergeCategoryIntoRegistry(prev, name))
            }
            onApplyCategory={(category) =>
              setPending((prev) => prev.map((row) => ({ ...row, category })))
            }
            onApplyVariant={(variant) =>
              setPending((prev) => prev.map((row) => ({ ...row, variant })))
            }
            onApplySource={(source) =>
              setPending((prev) => prev.map((row) => ({ ...row, source })))
            }
            onApplyUsage={(usage) =>
              setPending((prev) => prev.map((row) => ({ ...row, usage })))
            }
          />
          <ul className="figma-dock-list">
          {pending.map((icon, index) => {
            const conflictMsg = nameConflictMsgs[index] ?? ''
            return (
              <li
                key={icon.id}
                className={conflictMsg ? 'has-name-conflict' : undefined}
              >
                <img src={icon.previewUrl} alt="" width={24} height={24} />
                <label>
                  <span>ci:</span>
                  <input
                    type="text"
                    value={icon.name}
                    aria-invalid={Boolean(conflictMsg)}
                    onChange={(e) => {
                      const value = e.target.value
                      setPending((prev) =>
                        prev.map((row, i) => {
                          if (i !== index) return row
                          const suffix = detectVariantSuffix(value)
                          return {
                            ...row,
                            name: value,
                            variant: suffix ?? row.variant,
                          }
                        }),
                      )
                    }}
                  />
                </label>
                <select
                  aria-label={`Color mode for ci:${icon.name || 'icon'}`}
                  value={icon.colorMode}
                  onChange={(e) => {
                    const colorMode =
                      e.target.value === 'preserved'
                        ? 'preserved'
                        : e.target.value === 'gradient'
                          ? 'gradient'
                          : 'mono'
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, colorMode } : row,
                      ),
                    )
                  }}
                >
                  <option value="mono">Mono</option>
                  <option value="preserved">Multi</option>
                  <option value="gradient">Gradient</option>
                </select>
                <CategorySelect
                  value={icon.category}
                  onChange={(category) =>
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, category } : row,
                      ),
                    )
                  }
                  categories={categoryRegistry}
                  onCreateCategory={(name) =>
                    setCategoryRegistry((prev) =>
                      mergeCategoryIntoRegistry(prev, name),
                    )
                  }
                  ariaLabel={`Category for ci:${icon.name || 'icon'}`}
                />
                <VariantSelect
                  value={icon.variant}
                  onChange={(variant) =>
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, variant } : row,
                      ),
                    )
                  }
                  ariaLabel={`Variant for ci:${icon.name || 'icon'}`}
                />
                <SourceSelect
                  value={icon.source}
                  onChange={(source) =>
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, source } : row,
                      ),
                    )
                  }
                  ariaLabel={`Source for ci:${icon.name || 'icon'}`}
                />
                <UsageSelect
                  value={icon.usage}
                  onChange={(usage) =>
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, usage } : row,
                      ),
                    )
                  }
                  ariaLabel={`Usage for ci:${icon.name || 'icon'}`}
                />
                <button
                  type="button"
                  className="figma-btn figma-btn-quiet"
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
                {conflictMsg ? (
                  <p className="name-conflict-msg" role="alert">
                    {conflictMsg}
                  </p>
                ) : null}
              </li>
            )
          })}
          </ul>
        </>
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
          Open icon browser
        </a>
        <span className="figma-dock-link-note">
          {' '}
          — upload PNG/JPG brand images there
        </span>
      </p>
    </section>
  )
}
