import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  actionsWorkflowUrl,
  dispatchApplyStaged,
  findIconNameConflicts,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  useGithubDevEnabled,
  listStagedIcons,
  listStagedRemovals,
  listUnpublishedIcons,
  sanitizeIconName,
  stageIcons,
  unstageRemoval,
  type IconColorMode,
  type IconNameConflict,
  type ImageFormat,
  type StagedIcon,
  type StagedRemoval,
} from '../lib/github'
import {
  parseFigmaHandoffFile,
  takeFigmaHandoffError,
  takeOpenUploadPanelFlag,
  takePendingFigmaUploads,
  type FigmaHandoffIcon,
} from '../lib/figmaHandoff'
import {
  setAllUnpublishedChecked,
  setUnpublishedChecked,
  setUnpublishedIcons,
  useUnpublishedSelection,
} from '../lib/unpublishedSelection'
import { useDialogAccessibility } from '../lib/useDialogAccessibility'
import { detectSvgColorMode } from '../lib/detectSvgColorMode'
import { WorkflowQueuedNotice } from './WorkflowQueuedNotice'
import { GithubAssetPreview } from './GithubAssetPreview'

interface UploadItem {
  fileName: string
  name: string
  content: string
  previewUrl: string
  kind: 'svg' | 'image'
  colorMode: IconColorMode
  format?: ImageFormat
}

interface UploadPanelProps {
  localUploadEnabled: boolean
  onUploaded: (id: string) => void
}

function handoffToUploadItem(icon: FigmaHandoffIcon): UploadItem {
  const name = sanitizeIconName(icon.name) ?? icon.name
  return {
    fileName: `${name}.svg`,
    name,
    content: icon.content,
    previewUrl: URL.createObjectURL(
      new Blob([icon.content], { type: 'image/svg+xml' }),
    ),
    kind: 'svg',
    colorMode: icon.colorMode || detectSvgColorMode(icon.content),
  }
}

function readInitialHandoff(): {
  open: boolean
  items: UploadItem[]
  message: ReactNode
} {
  const pending = takePendingFigmaUploads()
  const openPanel = takeOpenUploadPanelFlag()
  const handoffError = takeFigmaHandoffError()

  if (pending && pending.length > 0) {
    return {
      open: true,
      items: pending.map(handoffToUploadItem),
      message: `Loaded ${pending.length} icon(s) from Figma.`,
    }
  }
  if (handoffError) {
    return { open: true, items: [], message: handoffError }
  }
  if (openPanel) {
    return {
      open: true,
      items: [],
      message:
        'Drop gv-icons-handoff.json (or SVGs) here, then Stage.',
    }
  }
  return { open: false, items: [], message: null }
}

function parseImageFormat(fileName: string): ImageFormat | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.jpg')) return 'jpg'
  if (lower.endsWith('.jpeg')) return 'jpeg'
  return null
}

function fileToUploadItem(file: File): Promise<UploadItem[]> {
  return new Promise((resolve, reject) => {
    const imageFormat = parseImageFormat(file.name)
    if (imageFormat) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '')
        const base64 = dataUrl.includes(',')
          ? dataUrl.slice(dataUrl.indexOf(',') + 1)
          : dataUrl
        const base = file.name.replace(/\.(png|jpe?g)$/i, '')
        const name = sanitizeIconName(base) ?? ''
        resolve([
          {
            fileName: file.name,
            name,
            content: base64,
            previewUrl: URL.createObjectURL(file),
            kind: 'image',
            colorMode: 'mono',
            format: imageFormat,
          },
        ])
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      if (file.name.toLowerCase().endsWith('.json')) {
        const handoff = parseFigmaHandoffFile(content)
        if (!handoff) {
          reject(new Error(`Not a valid Figma handoff JSON: ${file.name}`))
          return
        }
        resolve(handoff.map(handoffToUploadItem))
        return
      }
      const base = file.name.replace(/\.svg$/i, '')
      const name = sanitizeIconName(base) ?? ''
      resolve([
        {
          fileName: file.name,
          name,
          content,
          previewUrl: URL.createObjectURL(file),
          kind: 'svg',
          colorMode: detectSvgColorMode(content),
        },
      ])
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function revokePreviewUrls(items: UploadItem[]): void {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl)
  }
}

function formatConflicts(conflicts: IconNameConflict[]): string {
  return conflicts
    .map((c) => {
      const where =
        c.location === 'library-mono'
          ? 'library (mono SVG)'
          : c.location === 'library-color'
            ? 'library (multi-color SVG)'
            : c.location === 'library-gradient'
              ? 'library (gradient SVG)'
              : c.location === 'library-image'
                ? 'library (brand image)'
                : c.location === 'staging-mono'
                  ? 'staging (mono SVG)'
                  : c.location === 'staging-color'
                    ? 'staging (multi-color SVG)'
                    : c.location === 'staging-gradient'
                      ? 'staging (gradient SVG)'
                      : c.location === 'staging-image'
                        ? 'staging (brand image)'
                        : 'staged removals'
      return `• ${c.name} — already in ${where}`
    })
    .join('\n')
}

function stagedAssetLabel(icon: StagedIcon): string {
  if (icon.kind === 'image') {
    return `img:${icon.name} (${icon.format ?? 'image'})`
  }
  const mode =
    icon.colorMode === 'preserved'
      ? 'multi-color'
      : icon.colorMode === 'gradient'
        ? 'gradient'
        : 'mono'
  return `gv:${icon.name} (${mode})`
}

function colorModeLabel(mode: IconColorMode | undefined): string {
  if (mode === 'preserved') return 'multi-color'
  if (mode === 'gradient') return 'gradient'
  return 'mono'
}

export function UploadPanel({
  localUploadEnabled,
  onUploaded,
}: UploadPanelProps) {
  const githubRepoConfigured = isGithubRepoConfigured()
  const githubAuthed = isGithubAdminEnabled()
  const canApplyPublish = useGithubDevEnabled()
  const uploadEnabled = localUploadEnabled || githubRepoConfigured
  const mode: 'local' | 'github' | 'none' = localUploadEnabled
    ? 'local'
    : githubRepoConfigured
      ? 'github'
      : 'none'

  const [handoffBoot] = useState(readInitialHandoff)
  const [open, setOpen] = useState(handoffBoot.open)
  const [items, setItems] = useState<UploadItem[]>(handoffBoot.items)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<ReactNode>(handoffBoot.message)
  const [staged, setStaged] = useState<StagedIcon[]>([])
  const [stagedRemovals, setStagedRemovals] = useState<StagedRemoval[]>([])
  const [stagedLoading, setStagedLoading] = useState(false)
  const { unpublished, checkedPaths, allChecked } = useUnpublishedSelection()
  const wasOpenRef = useRef(open)

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const panelRef = useDialogAccessibility(open, close)

  const canSubmit = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => sanitizeIconName(item.name) !== null),
    [items],
  )

  const hasStagedWork = staged.length > 0 || stagedRemovals.length > 0

  const refreshStaged = useCallback(async () => {
    if (mode !== 'github' || !githubAuthed) return
    setStagedLoading(true)
    try {
      const [nextStaged, nextRemovals, nextUnpublished] = await Promise.all([
        listStagedIcons(),
        listStagedRemovals(),
        listUnpublishedIcons(),
      ])
      setStaged(nextStaged)
      setStagedRemovals(nextRemovals)
      setUnpublishedIcons(nextUnpublished)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setStagedLoading(false)
    }
  }, [mode, githubAuthed])

  // Only clear when the dialog closes — not on the initial mount (handoff opens it).
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      setItems((prev) => {
        if (prev.length > 0) revokePreviewUrls(prev)
        return []
      })
      setMessage(null)
    }
    wasOpenRef.current = open
  }, [open])

  useEffect(() => {
    if (open && mode === 'github' && githubAuthed) {
      void refreshStaged()
    }
  }, [open, mode, githubAuthed, refreshStaged])

  useEffect(() => {
    function onFigmaOpenUpload(): void {
      const pending = takePendingFigmaUploads()
      const handoffError = takeFigmaHandoffError()
      if (pending && pending.length > 0) {
        setItems((prev) => {
          revokePreviewUrls(prev)
          return pending.map(handoffToUploadItem)
        })
        setMessage(
          handoffError ??
            `Loaded ${pending.length} icon(s) from Figma for manual fix.`,
        )
      } else if (handoffError) {
        setMessage(handoffError)
      }
      setOpen(true)
    }
    window.addEventListener('gv-figma-open-upload', onFigmaOpenUpload)
    return () =>
      window.removeEventListener('gv-figma-open-upload', onFigmaOpenUpload)
  }, [])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const files = Array.from(fileList).filter((f) => {
      const lower = f.name.toLowerCase()
      return (
        lower.endsWith('.svg') ||
        lower.endsWith('.json') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg')
      )
    })
    if (files.length === 0) return
    try {
      const batches = await Promise.all(files.map(fileToUploadItem))
      const next = batches.flat()
      setItems((prev) => [...prev, ...next])
      setMessage(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function confirmNameConflicts(
    names: string[],
  ): Promise<boolean> {
    if (mode !== 'github' || !githubAuthed) return true
    const conflicts = await findIconNameConflicts(names)
    if (conflicts.length === 0) return true
    return window.confirm(
      `Name conflict(s) found — staging will overwrite existing files:\n\n${formatConflicts(conflicts)}\n\nContinue?`,
    )
  }

  async function handleStage() {
    if (mode !== 'github' || !canSubmit || !githubAuthed) return
    setBusy(true)
    setMessage(null)
    try {
      const names = items.map((item) => item.name)
      if (!(await confirmNameConflicts(names))) return

      const count = items.length
      await stageIcons(
        items.map((item) =>
          item.kind === 'image'
            ? {
                name: item.name,
                content: item.content,
                kind: 'image' as const,
                format: item.format!,
              }
            : {
                name: item.name,
                content: item.content,
                kind: 'svg' as const,
                colorMode: item.colorMode,
              },
        ),
      )
      setItems((prev) => {
        revokePreviewUrls(prev)
        return []
      })
      await refreshStaged()
      setMessage(
        `Staged ${count} asset(s) on GitHub (shared queue). Maintainers Apply when ready — no Action ran yet.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleApplyStaged() {
    if (mode !== 'github' || !githubAuthed) return
    setBusy(true)
    setMessage(null)
    try {
      const [current, currentRemovals] = await Promise.all([
        listStagedIcons(),
        listStagedRemovals(),
      ])
      setStaged(current)
      setStagedRemovals(currentRemovals)
      if (current.length === 0 && currentRemovals.length === 0) {
        setMessage('Nothing is staged on GitHub right now.')
        return
      }

      const addNames = current.map((icon) => `• ${stagedAssetLabel(icon)}`).join('\n')
      const removeNames = currentRemovals
        .map((icon) => `• ${icon.name}`)
        .join('\n')
      const addSection =
        current.length > 0 ? `Adds (${current.length}):\n${addNames}` : ''
      const removeSection =
        currentRemovals.length > 0
          ? `Removals (${currentRemovals.length}):\n${removeNames}`
          : ''
      const summary = [addSection, removeSection].filter(Boolean).join('\n\n')
      const ok = window.confirm(
        `Apply staged changes to the library?\n\n${summary}\n\nApplies whatever is staged on GitHub right now. If someone else is still editing staging, they will not be included unless they click Apply again after.`,
      )
      if (!ok) return

      await dispatchApplyStaged()
      const first = current[0]
      if (first) {
        onUploaded(
          first.kind === 'image' ? `img:${first.name}` : `gv:${first.name}`,
        )
      }
      setMessage(
        <WorkflowQueuedNotice
          workflowLabel="Apply workflow"
          workflowUrl={actionsWorkflowUrl('apply-staged-icons.yml')}
        />,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnstageRemoval(name: string) {
    if (mode !== 'github' || !githubAuthed) return
    setBusy(true)
    setMessage(null)
    try {
      await unstageRemoval(name)
      await refreshStaged()
      setMessage(`Unstaged removal of ${name}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleLocalUpload() {
    if (mode !== 'local' || !canSubmit) return
    setBusy(true)
    setMessage(null)
    try {
      let lastId = ''
      const count = items.length
      for (const item of items) {
        const res = await fetch('/__gv/icons/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            content: item.content,
            colorMode: item.colorMode,
            kind: item.kind,
            format: item.format,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          id?: string
          error?: string
        }
        if (!res.ok || !data.ok || !data.id) {
          throw new Error(data.error || `Upload failed for ${item.name}`)
        }
        lastId = data.id
      }
      setItems((prev) => {
        revokePreviewUrls(prev)
        return []
      })
      setMessage(`Uploaded ${count} asset(s). Catalog regenerated.`)
      if (lastId) onUploaded(lastId)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="upload-wrap">
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        Upload
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Close upload dialog"
            onClick={close}
          />
          <div
            ref={panelRef}
            className="upload-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-panel-title"
          >
            <div className="upload-panel-header">
              <strong id="upload-panel-title">Upload SVG / PNG / JPG</strong>
              <button
                type="button"
                className="ghost upload-close"
                onClick={close}
                aria-label="Close upload"
                data-autofocus
              >
                ×
              </button>
            </div>
            {!uploadEnabled ? (
              <p>
                Upload is not configured. Locally, run <code>pnpm dev</code>. On
                GitHub Pages, ensure <code>ICON_BROWSER_TOKEN</code> and{' '}
                <code>VITE_GITHUB_REPO</code> are set for the Pages build.
              </p>
            ) : (
              <>
                {mode === 'github' && !githubAuthed ? (
                  <p>
                    GitHub write access is not configured. Redeploy Pages with
                    the <code>ICON_BROWSER_TOKEN</code> secret (
                    <code>contents: write</code> + <code>actions: write</code>
                    ), or set <code>VITE_GITHUB_TOKEN</code> in local{' '}
                    <code>.env.local</code>.
                  </p>
                ) : (
                  <p>
                    Drop SVG icons or PNG/JPG brand images. SVGs become{' '}
                    <code>gv:kebab-name</code> (set mono / multi-color /
                    gradient). Images become <code>img:kebab-name</code> (not
                    usable with <code>&lt;Icon /&gt;</code>).
                    {mode === 'github'
                      ? " On Pages, files go to a shared staging folder first; Apply promotes everyone's staged assets in one Action."
                      : ' Writes to disk and regenerates the catalog locally.'}
                  </p>
                )}
                <label className="upload-drop">
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.json,image/svg+xml,image/png,image/jpeg,application/json"
                    multiple
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                  <span>Choose SVG / PNG / JPG files or drop them here</span>
                </label>

                {items.length > 0 ? (
                  <ul className="upload-list">
                    {items.map((item, index) => (
                      <li key={`${item.fileName}-${index}`}>
                        <span
                          className={
                            item.kind === 'image'
                              ? 'upload-preview upload-preview-image'
                              : item.colorMode === 'preserved' ||
                                  item.colorMode === 'gradient'
                                ? 'upload-preview upload-preview-color'
                                : 'upload-preview upload-preview-mono'
                          }
                          title={
                            item.kind === 'image'
                              ? `Brand image (${item.format})`
                              : item.colorMode === 'preserved'
                                ? 'Multi-color preview'
                                : item.colorMode === 'gradient'
                                  ? 'Gradient preview'
                                  : 'Monochrome preview (tinted)'
                          }
                        >
                          <img
                            src={item.previewUrl}
                            alt=""
                            width={28}
                            height={28}
                          />
                        </span>
                        <label>
                          <span>{item.kind === 'image' ? 'img:' : 'gv:'}</span>
                          <input
                            value={item.name}
                            onChange={(e) => {
                              const value = e.target.value
                              setItems((prev) =>
                                prev.map((row, i) =>
                                  i === index ? { ...row, name: value } : row,
                                ),
                              )
                            }}
                          />
                        </label>
                        {item.kind === 'svg' ? (
                          <select
                            className="color-mode-select"
                            aria-label={`Color mode for gv:${item.name || 'icon'}`}
                            value={item.colorMode}
                            onChange={(e) => {
                              const value = e.target.value as IconColorMode
                              setItems((prev) =>
                                prev.map((row, i) =>
                                  i === index
                                    ? {
                                        ...row,
                                        colorMode:
                                          value === 'preserved'
                                            ? 'preserved'
                                            : value === 'gradient'
                                              ? 'gradient'
                                              : 'mono',
                                      }
                                    : row,
                                ),
                              )
                            }}
                          >
                            <option value="mono">Monochrome</option>
                            <option value="preserved">Multi-color</option>
                            <option value="gradient">Gradient</option>
                          </select>
                        ) : (
                          <span className="upload-format-tag">
                            {(item.format ?? 'image').toUpperCase()}
                          </span>
                        )}
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => removeItem(index)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {mode === 'github' ? (
                  <>
                    <button
                      type="button"
                      className="ghost accent"
                      disabled={!canSubmit || busy || !githubAuthed}
                      onClick={() => void handleStage()}
                    >
                      {busy
                        ? 'Working…'
                        : githubAuthed
                          ? 'Add to staging'
                          : 'GitHub token required'}
                    </button>

                    <div className="staged-block">
                      <div className="staged-header">
                        <strong>Staged on GitHub</strong>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy || stagedLoading}
                          onClick={() => void refreshStaged()}
                        >
                          {stagedLoading ? 'Refreshing…' : 'Refresh'}
                        </button>
                      </div>
                      {staged.length === 0 ? (
                        <p className="staged-empty">No staged adds.</p>
                      ) : (
                        <ul className="staged-list">
                          {staged.map((icon) => (
                            <li key={icon.path} className="staged-asset-row">
                              <GithubAssetPreview
                                path={icon.path}
                                colorMode={icon.colorMode}
                                isImage={icon.kind === 'image'}
                                title={
                                  icon.kind === 'image'
                                    ? `img:${icon.name}`
                                    : `gv:${icon.name}`
                                }
                              />
                              <code>
                                {icon.kind === 'image'
                                  ? `img:${icon.name}`
                                  : `gv:${icon.name}`}
                              </code>
                              <span>
                                {icon.kind === 'image'
                                  ? (icon.format ?? 'image').toUpperCase()
                                  : colorModeLabel(icon.colorMode)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <strong className="staged-subheader">
                        Staged removals
                      </strong>
                      {stagedRemovals.length === 0 ? (
                        <p className="staged-empty">No staged removals.</p>
                      ) : (
                        <ul className="staged-list">
                          {stagedRemovals.map((icon) => (
                            <li
                              key={icon.path}
                              className="staged-removal-row staged-asset-row"
                            >
                              <GithubAssetPreview
                                libraryName={icon.name}
                                title={icon.name}
                              />
                              <code>{icon.name}</code>
                              <button
                                type="button"
                                className="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void handleUnstageRemoval(icon.name)
                                }
                              >
                                Unstage
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canApplyPublish ? (
                        <button
                          type="button"
                          className="ghost accent"
                          disabled={busy || !hasStagedWork}
                          onClick={() => void handleApplyStaged()}
                        >
                          {busy ? 'Working…' : 'Apply staged to library'}
                        </button>
                      ) : null}
                    </div>

                    {canApplyPublish ? (
                    <div className="staged-block">
                      <div className="staged-header">
                        <strong>In library (unpublished)</strong>
                      </div>
                      <p className="staged-hint">
                        Checked icons ship on Publish. Unchecked stay out of
                        this package, then return to the library as unpublished
                        for a later release.
                      </p>
                      {unpublished.length === 0 ? (
                        <p className="staged-empty">No unpublished icons.</p>
                      ) : (
                        <>
                          <label className="check-all">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={(e) =>
                                setAllUnpublishedChecked(e.target.checked)
                              }
                            />
                            <span>Check all</span>
                          </label>
                          <ul className="staged-list check-list">
                            {unpublished.map((icon) => (
                              <li key={icon.path}>
                                <label className="check-row staged-asset-row">
                                  <input
                                    type="checkbox"
                                    checked={checkedPaths.has(icon.path)}
                                    onChange={(e) =>
                                      setUnpublishedChecked(
                                        icon.path,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  <GithubAssetPreview
                                    path={icon.path}
                                    colorMode={icon.colorMode}
                                    isImage={icon.kind === 'image'}
                                    title={
                                      icon.kind === 'image'
                                        ? `img:${icon.name}`
                                        : `gv:${icon.name}`
                                    }
                                  />
                                  <code>
                                    {icon.kind === 'image'
                                      ? `img:${icon.name}`
                                      : `gv:${icon.name}`}
                                  </code>
                                  <span>
                                    {icon.kind === 'image'
                                      ? (icon.format ?? 'image').toUpperCase()
                                      : colorModeLabel(icon.colorMode)}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="ghost accent"
                    disabled={!canSubmit || busy}
                    onClick={() => void handleLocalUpload()}
                  >
                    {busy ? 'Uploading…' : 'Save to library'}
                  </button>
                )}
              </>
            )}
            {message ? (
              typeof message === 'string' ? (
                <p className="copy-toast">{message}</p>
              ) : (
                message
              )
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
