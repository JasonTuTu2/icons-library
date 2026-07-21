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
  fullIconBrowserUrl,
  type FigmaAssetFormat,
  type FigmaExportIcon,
} from '../lib/figmaHost'
import { putAccountStaging } from '../lib/stagingHandoff'
import { getAuthSession, isAuthApiConfigured, useAuthSession } from '../lib/sessionAuth'
import {
  pluginConflictCopy,
  usePluginLocale,
} from '../lib/pluginI18n'
import { ApplyAllFields } from './ApplyAllFields'
import { CategorySelect } from './CategorySelect'
import { VariantSelect } from './VariantSelect'
import { SourceSelect } from './SourceSelect'
import { UsageSelect } from './UsageSelect'
import { NoteToggleField } from './NoteToggleField'
import { DropdownCombobox } from './DropdownCombobox'
import { PluginLangToggle } from './PluginLangToggle'
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

function loadedStatusMessage(
  icons: Array<{ kind: 'svg' | 'image' }>,
  t: (key: 'loadedPrefix' | 'loadedEdit' | 'imageUnit' | 'noExportable', vars?: Record<string, string | number>) => string,
): string {
  if (icons.length === 0) return t('noExportable')
  const svgCount = icons.filter((i) => i.kind === 'svg').length
  const imgCount = icons.filter((i) => i.kind === 'image').length
  const parts: string[] = []
  if (svgCount) parts.push(`${svgCount} SVG`)
  if (imgCount) parts.push(`${imgCount} ${t('imageUnit')}`)
  return `${t('loadedPrefix')} ${parts.join(' + ') || icons.length}. ${t('loadedEdit')}`
}

/**
 * Figma plugin panel: Load, rename/color/category, Stage, link to full browser.
 * No catalog browse UI.
 */
export function FigmaDock() {
  const { t, locale } = usePluginLocale()
  const conflictCopy = useMemo(() => pluginConflictCopy(t), [t])
  const [pending, setPending] = useState<PendingIcon[]>([])
  const [busy, setBusy] = useState(false)
  const [reexportingId, setReexportingId] = useState<string | null>(null)
  const [message, setMessage] = useState<ReactNode>(null)
  /** When true, status is derived from pending + locale (re-translates on toggle). */
  const [showLoadedStatus, setShowLoadedStatus] = useState(false)
  const [nameConflictMsgs, setNameConflictMsgs] = useState<string[]>([])
  const [replaceHintMsgs, setReplaceHintMsgs] = useState<string[]>([])
  const [conflictsChecking, setConflictsChecking] = useState(false)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const session = useAuthSession()
  const githubOk = isGithubRepoConfigured() && isFigmaHost()
  const showHeaderToggle = !(isAuthApiConfigured() && session)
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

  const statusMessage = showLoadedStatus
    ? loadedStatusMessage(pending, t)
    : message

  function clearStatus(): void {
    setShowLoadedStatus(false)
    setMessage(null)
  }

  function setStatus(node: ReactNode): void {
    setShowLoadedStatus(false)
    setMessage(node)
  }

  function markLoadedStatus(): void {
    setShowLoadedStatus(true)
    setMessage(null)
  }

  useEffect(() => {
    notifyFigmaUiReady()
    return subscribeFigmaPluginMessages((msg) => {
      if (msg.type === 'reexport-batch-result') {
        setReexportingId(null)
        if (msg.error && msg.icons.length === 0) {
          setStatus(msg.error)
          return
        }
        const byId = new Map(msg.icons.map((icon) => [icon.id, icon]))
        setPending((prev) =>
          prev.map((row) => {
            const updated = byId.get(row.id)
            return updated ? applyReexport(row, updated) : row
          }),
        )
        setStatus(
          msg.error
            ? t('appliedFormatErrors', { error: msg.error })
            : t('appliedFormat', { count: msg.icons.length }),
        )
        return
      }

      if (msg.type === 'reexport-result') {
        setReexportingId(null)
        if (msg.error) {
          setStatus(msg.error)
          return
        }
        if (!msg.icon) return
        const updated = msg.icon
        setPending((prev) =>
          prev.map((row) =>
            row.id === updated.id ? applyReexport(row, updated) : row,
          ),
        )
        setStatus(
          updated.kind === 'image'
            ? t('switchedImg', {
                format: updated.format?.toUpperCase() ?? 'PNG',
              })
            : t('switchedSvg'),
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
        setStatus(msg.error)
      } else if (msg.icons.length === 0) {
        setStatus(t('noExportable'))
      } else {
        markLoadedStatus()
      }
    })
  }, [t])

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
    const batch = analyzeItemConflicts(items, [], conflictCopy)
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
          const analysis = analyzeItemConflicts(items, remote, conflictCopy)
          setNameConflictMsgs(analysis.messages)
          setReplaceHintMsgs(analysis.replaceHints)
        })
        .catch((err) => {
          if (cancelled) return
          setStatus(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (!cancelled) setConflictsChecking(false)
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pending, githubOk, conflictCopy, locale])

  function handleLoad(): void {
    clearStatus()
    setBusy(true)
    setReexportingId(null)
    requestFigmaExport()
  }

  function handleFormatChange(index: number, format: FigmaAssetFormat): void {
    const row = pending[index]
    if (!row || row.assetFormat === format || reexportingId || busy) return
    clearStatus()
    setReexportingId(row.id)
    requestFigmaReexport(row.id, format)
  }

  async function handleStage(): Promise<void> {
    if (!canStage || pending.length === 0) return
    setBusy(true)
    clearStatus()
    try {
      const payloads = pending.map((icon) => {
        const name = sanitizeIconName(icon.name)
        if (!name) {
          throw new Error(t('invalidName', { name: icon.name }))
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
      const analysis = analyzeItemConflicts(conflictItems, remote, conflictCopy)
      if (analysis.messages.some((msg) => msg.length > 0)) {
        setNameConflictMsgs(analysis.messages)
        setReplaceHintMsgs(analysis.replaceHints)
        setStatus(t('fixConflicts'))
        return
      }
      if (!confirmLibraryReplacements(analysis.replaceKeys, conflictCopy)) {
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
      setStatus(
        count === 1
          ? isAuthApiConfigured() && getAuthSession()
            ? t('stagedOneAccount')
            : t('stagedOneLocal')
          : isAuthApiConfigured() && getAuthSession()
            ? t('stagedManyAccount', { count })
            : t('stagedManyLocal', { count }),
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="figma-dock" aria-label={t('ariaExport')}>
      <div className="figma-dock-header">
        <h1 className="figma-dock-title">{t('brandTitle')}</h1>
        {showHeaderToggle ? <PluginLangToggle /> : null}
      </div>
      <div className="figma-dock-actions">
        <button
          type="button"
          className="figma-btn"
          disabled={busy || Boolean(reexportingId)}
          onClick={handleLoad}
        >
          {busy ? t('working') : t('loadSelection')}
        </button>
        <button
          type="button"
          className="figma-btn figma-btn-primary"
          disabled={!canStage}
          onClick={() => void handleStage()}
        >
          {t('stage')}
        </button>
      </div>
      {!githubOk ? (
        <p className="figma-dock-hint">{t('hintOffline')}</p>
      ) : (
        <p className="figma-dock-hint">
          {t('hintOnlineBefore')}
          <strong>{t('stage')}</strong>
          {t('hintOnlineAfter')}
          <a
            className="figma-dock-docs-link"
            href={`${fullIconBrowserUrl().replace(/\/?$/, '/')}docs#designer-ops`}
            target="_blank"
            rel="noreferrer"
          >
            {t('designerOps')}
          </a>
          {t('hintOnlineOptional')}
          <strong>{t('openIconBrowser')}</strong>
          {t('hintOnlineSvg')}
        </p>
      )}
      {pending.length > 0 ? (
        <>
          <ApplyAllFields
            categories={categoryRegistry}
            formatDisabled={busy || Boolean(reexportingId)}
            labels={{
              applyToAll: t('applyToAll'),
              formatPlaceholder: t('formatPlaceholder'),
              colorPlaceholder: t('colorPlaceholder'),
              ariaApplyFormat: t('ariaApplyFormat'),
              ariaApplyColor: t('ariaApplyColor'),
              ariaApplyCategory: t('ariaApplyCategory'),
              ariaApplyVariant: t('ariaApplyVariant'),
              ariaApplySource: t('ariaApplySource'),
              ariaApplyUsage: t('ariaApplyUsage'),
              ariaApplyNote: t('ariaApplyNote'),
              note: t('note'),
              notePlaceholder: t('notePlaceholder'),
              addNote: t('addNote'),
              editNote: t('editNote'),
            }}
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
              clearStatus()
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
            const nameOrAsset = icon.name || t('assetFallback')
            const nameOrIcon = icon.name || t('iconFallback')
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
                  ariaLabel={t('ariaFormat', { name: nameOrAsset })}
                  value={icon.assetFormat}
                  disabled={Boolean(reexportingId) || busy}
                  searchable
                  placeholder={t('formatPlaceholder')}
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
                    ariaLabel={t('ariaColor', { name: nameOrIcon })}
                    value={icon.colorMode}
                    disabled={formatBusy}
                    searchable
                    placeholder={t('colorPlaceholder')}
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
                  ariaLabel={t('ariaCategory', { id: `${prefix}${nameOrAsset}` })}
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
                  ariaLabel={t('ariaVariant', { id: `${prefix}${nameOrAsset}` })}
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
                  ariaLabel={t('ariaSource', { id: `${prefix}${nameOrAsset}` })}
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
                  ariaLabel={t('ariaUsage', { id: `${prefix}${nameOrAsset}` })}
                />
                <NoteToggleField
                  value={icon.note}
                  disabled={formatBusy}
                  ariaLabel={t('ariaNote', { id: `${prefix}${nameOrAsset}` })}
                  labels={{
                    note: t('note'),
                    placeholder: t('notePlaceholder'),
                    addTitle: t('addNote'),
                    editTitle: t('editNote'),
                  }}
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
                      const next = prev.filter((_, i) => i !== index)
                      markLoadedStatus()
                      return next
                    })
                  }}
                >
                  {t('remove')}
                </button>
                {formatBusy ? (
                  <p className="figma-dock-reexporting" role="status">
                    {t('reexporting')}
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
      {statusMessage ? (
        <p className="figma-dock-message" role="status">
          {statusMessage}
        </p>
      ) : null}
      <p className="figma-dock-link">
        <button
          type="button"
          className="figma-dock-link-btn"
          onClick={() => {
            void openIconBrowserWithStaging().catch((err) => {
              setStatus(err instanceof Error ? err.message : String(err))
            })
          }}
        >
          {t('openIconBrowser')}
        </button>
        <span className="figma-dock-link-note">{t('openBrowserNote')}</span>
      </p>
    </section>
  )
}
