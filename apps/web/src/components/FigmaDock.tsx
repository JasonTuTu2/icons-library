import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  detectVariantFromName,
  detectVariantSuffix,
  findIconNameConflicts,
  isGithubRepoConfigured,
  sanitizeIconName,
  type IconColorMode,
  type IconSource,
  type IconUsage,
  type IconVariant,
  type ImageFormat,
} from '../lib/github'
import { detectSvgColorMode } from '../lib/detectSvgColorMode'
import {
  analyzeItemConflicts,
  confirmLibraryReplacements,
} from '../lib/nameConflicts'
import {
  isFigmaHost,
  notifyFigmaUiReady,
  openIconBrowserWithStaging,
  stageIconsInPlugin,
  requestFigmaExport,
  requestFigmaReexport,
  requestFigmaReexportBatch,
  subscribeFigmaPluginMessages,
  type FigmaAssetFormat,
  type FigmaExportIcon,
} from '../lib/figmaHost'
import { putAccountStaging } from '../lib/stagingHandoff'
import { getAuthSession, isAuthApiConfigured } from '../lib/sessionAuth'
import { ApplyAllFields } from './ApplyAllFields'
import { CategorySelect } from './CategorySelect'
import { VariantSelect } from './VariantSelect'
import { SourceSelect } from './SourceSelect'
import { UsageSelect } from './UsageSelect'
import { NoteToggleField } from './NoteToggleField'
import { DropdownCombobox } from './DropdownCombobox'
import {
  loadCategoryRegistry,
  mergeCategoryIntoRegistry,
} from '../lib/categories'

interface PendingIcon {
  id: string
  name: string
  content: string
  previewUrl: string
  /** Designer-selected export format (may override auto-detect). */
  assetFormat: FigmaAssetFormat
  kind: 'svg' | 'image'
  format?: ImageFormat
  colorMode: IconColorMode
  category: string
  variant: IconVariant
  source: IconSource
  usage: IconUsage
  note: string
}

function assetFormatFromExport(icon: FigmaExportIcon): FigmaAssetFormat {
  if (icon.kind === 'image') {
    return icon.format === 'jpg' || icon.format === 'jpeg' ? 'jpg' : 'png'
  }
  return 'svg'
}

function previewUrlForExport(icon: FigmaExportIcon): string {
  if (icon.kind === 'image') {
    const format = icon.format === 'jpg' || icon.format === 'jpeg' ? 'jpeg' : 'png'
    const binary = atob(icon.content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: `image/${format}` }))
  }
  return URL.createObjectURL(
    new Blob([icon.content], { type: 'image/svg+xml' }),
  )
}

function toPending(icon: FigmaExportIcon): PendingIcon {
  const name = sanitizeIconName(icon.name) ?? icon.name
  const kind = icon.kind === 'image' ? 'image' : 'svg'
  const assetFormat = assetFormatFromExport(icon)
  return {
    id: icon.id,
    name,
    content: icon.content,
    previewUrl: previewUrlForExport(icon),
    assetFormat,
    kind,
    format: kind === 'image' ? (icon.format === 'jpg' ? 'jpg' : 'png') : undefined,
    colorMode: kind === 'image' ? 'mono' : detectSvgColorMode(icon.content),
    category: '',
    variant: detectVariantFromName(name),
    source: 'custom',
    usage: 'in-use',
    note: '',
  }
}

function applyReexport(
  row: PendingIcon,
  icon: FigmaExportIcon,
): PendingIcon {
  const kind = icon.kind === 'image' ? 'image' : 'svg'
  const assetFormat = assetFormatFromExport(icon)
  URL.revokeObjectURL(row.previewUrl)
  return {
    ...row,
    content: icon.content,
    previewUrl: previewUrlForExport(icon),
    assetFormat,
    kind,
    format: kind === 'image' ? (icon.format === 'jpg' ? 'jpg' : 'png') : undefined,
    colorMode:
      kind === 'image'
        ? 'mono'
        : detectSvgColorMode(icon.content),
  }
}

function revokeAll(icons: PendingIcon[]): void {
  for (const icon of icons) URL.revokeObjectURL(icon.previewUrl)
}

function asConflictItems(icons: PendingIcon[]) {
  return icons.map((icon) => ({
    name: icon.name,
    kind: icon.kind,
  }))
}

/**
 * Figma plugin panel: Load, rename/color/category, Stage, link to full browser.
 * No catalog browse UI.
 */
export function FigmaDock() {
  const [pending, setPending] = useState<PendingIcon[]>([])
  const [busy, setBusy] = useState(false)
  const [reexportingId, setReexportingId] = useState<string | null>(null)
  const [message, setMessage] = useState<ReactNode>(null)
  const [nameConflictMsgs, setNameConflictMsgs] = useState<string[]>([])
  const [replaceHintMsgs, setReplaceHintMsgs] = useState<string[]>([])
  const [conflictsChecking, setConflictsChecking] = useState(false)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const githubOk = isGithubRepoConfigured() && isFigmaHost()
  const namesValid = useMemo(
    () =>
      pending.length > 0 &&
      pending.every((icon) => sanitizeIconName(icon.name) !== null),
    [pending],
  )
  const hasNameConflicts = nameConflictMsgs.some((msg) => msg.length > 0)
  const canStage =
    githubOk &&
    namesValid &&
    !hasNameConflicts &&
    !conflictsChecking &&
    !busy &&
    !reexportingId

  useEffect(() => {
    notifyFigmaUiReady()
    return subscribeFigmaPluginMessages((msg) => {
      if (msg.type === 'reexport-batch-result') {
        setReexportingId(null)
        if (msg.error && msg.icons.length === 0) {
          setMessage(msg.error)
          return
        }
        const byId = new Map(msg.icons.map((icon) => [icon.id, icon]))
        setPending((prev) =>
          prev.map((row) => {
            const updated = byId.get(row.id)
            return updated ? applyReexport(row, updated) : row
          }),
        )
        setMessage(
          msg.error
            ? `Updated formats with some errors: ${msg.error}`
            : `Applied format to ${msg.icons.length} asset(s).`,
        )
        return
      }

      if (msg.type === 'reexport-result') {
        setReexportingId(null)
        if (msg.error) {
          setMessage(msg.error)
          return
        }
        if (!msg.icon) return
        const updated = msg.icon
        setPending((prev) =>
          prev.map((row) =>
            row.id === updated.id ? applyReexport(row, updated) : row,
          ),
        )
        setMessage(
          updated.kind === 'image'
            ? `Switched to ${updated.format?.toUpperCase() ?? 'PNG'} (img:).`
            : 'Switched to SVG (ci:).',
        )
        return
      }

      if (msg.type !== 'export-result') return
      setBusy(false)
      setReexportingId(null)
      setPending((prev) => {
        revokeAll(prev)
        return msg.icons.map(toPending)
      })
      if (msg.error) {
        setMessage(msg.error)
      } else if (msg.icons.length === 0) {
        setMessage('No exportable nodes in selection.')
      } else {
        const svgCount = msg.icons.filter((i) => i.kind !== 'image').length
        const imgCount = msg.icons.filter((i) => i.kind === 'image').length
        const parts: string[] = []
        if (svgCount) parts.push(`${svgCount} SVG`)
        if (imgCount) parts.push(`${imgCount} image`)
        setMessage(
          `Loaded ${parts.join(' + ') || msg.icons.length}. Edit format/names, then Stage.`,
        )
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
      setReplaceHintMsgs([])
      setConflictsChecking(false)
      return
    }

    const items = asConflictItems(pending)
    const batch = analyzeItemConflicts(items, [])
    setNameConflictMsgs(batch.messages)
    setReplaceHintMsgs(batch.replaceHints)

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
          const analysis = analyzeItemConflicts(items, remote)
          setNameConflictMsgs(analysis.messages)
          setReplaceHintMsgs(analysis.replaceHints)
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
    setReexportingId(null)
    requestFigmaExport()
  }

  function handleFormatChange(index: number, format: FigmaAssetFormat): void {
    const row = pending[index]
    if (!row || row.assetFormat === format || reexportingId || busy) return
    setMessage(null)
    setReexportingId(row.id)
    requestFigmaReexport(row.id, format)
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
        if (icon.kind === 'image') {
          return {
            name,
            content: icon.content,
            kind: 'image' as const,
            format: icon.format ?? 'png',
            category: icon.category,
            variant: icon.variant,
            source: icon.source,
            usage: icon.usage,
            note: icon.note,
          }
        }
        return {
          name,
          content: icon.content,
          kind: 'svg' as const,
          colorMode: icon.colorMode,
          category: icon.category,
          variant: icon.variant,
          source: icon.source,
          usage: icon.usage,
          note: icon.note,
        }
      })

      const conflictItems = payloads.map((p) => ({
        name: p.name,
        kind: p.kind === 'image' ? ('image' as const) : ('svg' as const),
      }))
      const remote = await findIconNameConflicts(payloads.map((p) => p.name))
      const analysis = analyzeItemConflicts(conflictItems, remote)
      if (analysis.messages.some((msg) => msg.length > 0)) {
        setNameConflictMsgs(analysis.messages)
        setReplaceHintMsgs(analysis.replaceHints)
        setMessage(
          'Fix staging conflicts or batch duplicates before staging.',
        )
        return
      }
      if (!confirmLibraryReplacements(analysis.replaceKeys)) {
        return
      }
      const replaceKeySet = new Set(analysis.replaceKeys)
      const stagedPayloads = payloads.map((p) => ({
        ...p,
        replaceLibrary: replaceKeySet.has(
          `${p.kind === 'image' ? 'image' : 'svg'}:${p.name}`,
        ),
      }))

      const count = stagedPayloads.length
      await stageIconsInPlugin(stagedPayloads)
      if (isAuthApiConfigured() && getAuthSession()) {
        await putAccountStaging({ v: 1, icons: stagedPayloads, removals: [] })
      }
      setPending((prev) => {
        revokeAll(prev)
        return []
      })
      setNameConflictMsgs([])
      setMessage(
        count === 1
          ? isAuthApiConfigured() && getAuthSession()
            ? 'Staged 1 asset to your account. Open the icon browser (signed in) to Apply.'
            : 'Staged 1 asset. Sign in, then open icon browser to Apply.'
          : isAuthApiConfigured() && getAuthSession()
            ? `Staged ${count} assets to your account. Open the icon browser (signed in) to Apply.`
            : `Staged ${count} assets. Sign in, then open icon browser to Apply.`,
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
          disabled={busy || Boolean(reexportingId)}
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
          Open this panel from the Figma plugin (Pages figma.html). Sign in to
          stage and open the icon browser.
        </p>
      ) : (
        <p className="figma-dock-hint">
          Load from the canvas, set format (SVG / PNG / JPG), properties, and
          names, then Stage (saved to your account when signed in). Use{' '}
          <strong>Open icon browser</strong> to Apply / Publish — or open the
          site signed in and open Upload. Mono/Multi/Gradient only apply to SVG.
        </p>
      )}
      {pending.length > 0 ? (
        <>
          <ApplyAllFields
            categories={categoryRegistry}
            formatDisabled={busy || Boolean(reexportingId)}
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
            onApplyNote={(note) =>
              setPending((prev) => prev.map((row) => ({ ...row, note })))
            }
            onApplyFormat={(format) => {
              if (pending.length === 0 || reexportingId || busy) return
              setMessage(null)
              setReexportingId('__all__')
              requestFigmaReexportBatch(
                pending.map((row) => ({ nodeId: row.id, format })),
              )
            }}
            onApplyColorMode={(colorMode) =>
              setPending((prev) =>
                prev.map((row) =>
                  row.kind === 'svg' ? { ...row, colorMode } : row,
                ),
              )
            }
          />
          <ul className="figma-dock-list">
          {pending.map((icon, index) => {
            const conflictMsg = nameConflictMsgs[index] ?? ''
            const replaceHint = replaceHintMsgs[index] ?? ''
            const prefix = icon.kind === 'image' ? 'img:' : 'ci:'
            const formatBusy = reexportingId === icon.id
            return (
              <li
                key={icon.id}
                className={conflictMsg ? 'has-name-conflict' : undefined}
              >
                <img src={icon.previewUrl} alt="" width={24} height={24} />
                <label>
                  <span>{prefix}</span>
                  <input
                    type="text"
                    value={icon.name}
                    aria-invalid={Boolean(conflictMsg)}
                    disabled={formatBusy}
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
                <DropdownCombobox
                  className="figma-dock-format"
                  ariaLabel={`Export format for ${icon.name || 'asset'}`}
                  value={icon.assetFormat}
                  disabled={Boolean(reexportingId) || busy}
                  searchable
                  placeholder="Format…"
                  options={[
                    { value: 'svg', label: 'SVG' },
                    { value: 'png', label: 'PNG' },
                    { value: 'jpg', label: 'JPG' },
                  ]}
                  onChange={(value) => {
                    if (value !== 'svg' && value !== 'png' && value !== 'jpg') {
                      return
                    }
                    handleFormatChange(index, value)
                  }}
                />
                {icon.kind === 'svg' ? (
                  <DropdownCombobox
                    ariaLabel={`Color mode for ci:${icon.name || 'icon'}`}
                    value={icon.colorMode}
                    disabled={formatBusy}
                    searchable
                    placeholder="Color…"
                    displayValue={(v) => {
                      if (v === 'preserved') return 'Multi'
                      if (v === 'gradient') return 'Gradient'
                      return 'Mono'
                    }}
                    options={[
                      { value: 'mono', label: 'Mono' },
                      { value: 'preserved', label: 'Multi' },
                      { value: 'gradient', label: 'Gradient' },
                    ]}
                    onChange={(value) => {
                      const colorMode =
                        value === 'preserved'
                          ? 'preserved'
                          : value === 'gradient'
                            ? 'gradient'
                            : 'mono'
                      setPending((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, colorMode } : row,
                        ),
                      )
                    }}
                  />
                ) : null}
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
                  ariaLabel={`Category for ${prefix}${icon.name || 'asset'}`}
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
                  ariaLabel={`Variant for ${prefix}${icon.name || 'asset'}`}
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
                  ariaLabel={`Source for ${prefix}${icon.name || 'asset'}`}
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
                  ariaLabel={`Usage for ${prefix}${icon.name || 'asset'}`}
                />
                <NoteToggleField
                  value={icon.note}
                  disabled={formatBusy}
                  ariaLabel={`Note for ${prefix}${icon.name || 'asset'}`}
                  onChange={(note) =>
                    setPending((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, note } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="figma-btn figma-btn-quiet"
                  disabled={formatBusy}
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
                {formatBusy ? (
                  <p className="figma-dock-reexporting" role="status">
                    Re-exporting…
                  </p>
                ) : null}
                {conflictMsg ? (
                  <p className="name-conflict-msg" role="alert">
                    {conflictMsg}
                  </p>
                ) : replaceHint ? (
                  <p className="name-replace-hint">{replaceHint}</p>
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
        <button
          type="button"
          className="figma-dock-link-btn"
          onClick={() => {
            void openIconBrowserWithStaging().catch((err) => {
              setMessage(err instanceof Error ? err.message : String(err))
            })
          }}
        >
          Open icon browser
        </button>
      </p>
    </section>
  )
}
