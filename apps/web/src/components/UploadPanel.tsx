import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  actionsWorkflowUrl,
  dispatchApplyStaged,
  detectVariantFromName,
  detectVariantSuffix,
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
  type IconSource,
  type IconUsage,
  type IconVariant,
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
import { convertAssetFormat } from '../lib/convertAssetFormat'
import { conflictMessagesForItems } from '../lib/nameConflicts'
import { WorkflowQueuedNotice } from './WorkflowQueuedNotice'
import { GithubAssetPreview } from './GithubAssetPreview'
import { ApplyAllFields } from './ApplyAllFields'
import { CategorySelect, categoryLabel } from './CategorySelect'
import { VariantSelect, variantLabel } from './VariantSelect'
import { SourceSelect, sourceLabel } from './SourceSelect'
import { UsageSelect, usageLabel } from './UsageSelect'
import {
  loadCategoryRegistry,
  mergeCategoryIntoRegistry,
} from '../lib/categories'

interface UploadItem {
  fileName: string
  name: string
  content: string
  previewUrl: string
  kind: 'svg' | 'image'
  colorMode: IconColorMode
  format?: ImageFormat
  category: string
  variant: IconVariant
  source: IconSource
  usage: IconUsage
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
    category: '',
    variant: detectVariantFromName(name),
    source: 'custom',
    usage: 'in-use',
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
            category: '',
            variant: detectVariantFromName(name),
            source: 'custom',
            usage: 'in-use',
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
          category: '',
          variant: detectVariantFromName(name),
          source: 'custom',
          usage: 'in-use',
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

function stagedAssetLabel(icon: StagedIcon): string {
  if (icon.kind === 'image') {
    return `img:${icon.name} (${icon.format ?? 'image'}) · ${categoryLabel(icon.category)} · ${variantLabel(icon.variant)} · ${sourceLabel(icon.source)} · ${usageLabel(icon.usage)}`
  }
  const mode =
    icon.colorMode === 'preserved'
      ? 'multi-color'
      : icon.colorMode === 'gradient'
        ? 'gradient'
        : 'mono'
  return `ci:${icon.name} (${mode}) · ${categoryLabel(icon.category)} · ${variantLabel(icon.variant)} · ${sourceLabel(icon.source)} · ${usageLabel(icon.usage)}`
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
  const [nameConflictMsgs, setNameConflictMsgs] = useState<string[]>([])
  const [conflictsChecking, setConflictsChecking] = useState(false)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const { unpublished, checkedPaths, allChecked } = useUnpublishedSelection()
  const wasOpenRef = useRef(open)

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const panelRef = useDialogAccessibility(open, close)

  const namesValid = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => sanitizeIconName(item.name) !== null),
    [items],
  )

  const hasNameConflicts = nameConflictMsgs.some((msg) => msg.length > 0)

  const canSubmit = namesValid && !hasNameConflicts && !conflictsChecking

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

  // Strict live name checks — Stage stays disabled until every name is free.
  useEffect(() => {
    if (mode !== 'github' || !githubAuthed || items.length === 0) {
      setNameConflictMsgs([])
      setConflictsChecking(false)
      return
    }

    const batchDupes = conflictMessagesForItems(
      items.map((item) => ({
        name: item.name,
        kind: item.kind === 'image' ? 'image' : 'svg',
      })),
      [],
    )
    setNameConflictMsgs(batchDupes)

    const names = [
      ...new Set(
        items
          .map((item) => sanitizeIconName(item.name))
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
          setNameConflictMsgs(
            conflictMessagesForItems(
              items.map((item) => ({
                name: item.name,
                kind: item.kind === 'image' ? 'image' : 'svg',
              })),
              remote,
            ),
          )
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
  }, [items, mode, githubAuthed])

  useEffect(() => {
    if (!open) return
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
  }, [open])

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

  async function handleStage() {
    if (mode !== 'github' || !canSubmit || !githubAuthed) return
    setBusy(true)
    setMessage(null)
    try {
      const names = [
        ...new Set(
          items
            .map((item) => sanitizeIconName(item.name))
            .filter((n): n is string => Boolean(n)),
        ),
      ]
      const remote = await findIconNameConflicts(names)
      const blocking = conflictMessagesForItems(
        items.map((item) => ({
          name: item.name,
          kind: item.kind === 'image' ? 'image' : 'svg',
        })),
        remote,
      )
      if (blocking.some((msg) => msg.length > 0)) {
        setNameConflictMsgs(blocking)
        setMessage(
          'Rename assets that already exist in the library or staging before adding.',
        )
        return
      }

      const count = items.length
      await stageIcons(
        items.map((item) =>
          item.kind === 'image'
            ? {
                name: item.name,
                content: item.content,
                kind: 'image' as const,
                format: item.format!,
                category: item.category,
                variant: item.variant,
                source: item.source,
                usage: item.usage,
              }
            : {
                name: item.name,
                content: item.content,
                kind: 'svg' as const,
                colorMode: item.colorMode,
                category: item.category,
                variant: item.variant,
                source: item.source,
                usage: item.usage,
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
          first.kind === 'image' ? `img:${first.name}` : `ci:${first.name}`,
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
            category: item.category,
            variant: item.variant,
            source: item.source,
            usage: item.usage,
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
                    <code>ci:kebab-name</code> Images become <code>img:kebab-name</code> (not
                    usable with <code>&lt;Icon /&gt;</code>).
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
                  <>
                    <ApplyAllFields
                      categories={categoryRegistry}
                      formatDisabled={busy}
                      onCreateCategory={(name) =>
                        setCategoryRegistry((prev) =>
                          mergeCategoryIntoRegistry(prev, name),
                        )
                      }
                      onApplyCategory={(category) =>
                        setItems((prev) =>
                          prev.map((row) => ({ ...row, category })),
                        )
                      }
                      onApplyVariant={(variant) =>
                        setItems((prev) =>
                          prev.map((row) => ({ ...row, variant })),
                        )
                      }
                      onApplySource={(source) =>
                        setItems((prev) =>
                          prev.map((row) => ({ ...row, source })),
                        )
                      }
                      onApplyUsage={(usage) =>
                        setItems((prev) =>
                          prev.map((row) => ({ ...row, usage })),
                        )
                      }
                      onApplyFormat={(format) => {
                        if (busy || items.length === 0) return
                        setBusy(true)
                        setMessage(null)
                        void (async () => {
                          try {
                            const next = await Promise.all(
                              items.map((row) => convertAssetFormat(row, format)),
                            )
                            setItems(next)
                            setMessage(
                              `Converted ${next.length} asset(s) to ${format.toUpperCase()}.`,
                            )
                          } catch (err) {
                            setMessage(
                              err instanceof Error ? err.message : String(err),
                            )
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                      onApplyColorMode={(colorMode) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.kind === 'svg' ? { ...row, colorMode } : row,
                          ),
                        )
                      }
                    />
                  <ul className="upload-list">
                    {items.map((item, index) => {
                      const conflictMsg = nameConflictMsgs[index] ?? ''
                      return (
                      <li
                        key={`${item.fileName}-${index}`}
                        className={
                          conflictMsg ? 'has-name-conflict' : undefined
                        }
                      >
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
                          <span>{item.kind === 'image' ? 'img:' : 'ci:'}</span>
                          <input
                            value={item.name}
                            aria-invalid={Boolean(conflictMsg)}
                            onChange={(e) => {
                              const value = e.target.value
                              setItems((prev) =>
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
                        {item.kind === 'svg' ? (
                          <select
                            className="color-mode-select"
                            aria-label={`Color mode for ci:${item.name || 'icon'}`}
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
                        <CategorySelect
                          value={item.category}
                          onChange={(category) =>
                            setItems((prev) =>
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
                          ariaLabel={`Category for ${item.kind === 'image' ? 'img' : 'ci'}:${item.name || 'asset'}`}
                        />
                        <VariantSelect
                          value={item.variant}
                          onChange={(variant) =>
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, variant } : row,
                              ),
                            )
                          }
                          ariaLabel={`Variant for ${item.kind === 'image' ? 'img' : 'ci'}:${item.name || 'asset'}`}
                        />
                        <SourceSelect
                          value={item.source}
                          onChange={(source) =>
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, source } : row,
                              ),
                            )
                          }
                          ariaLabel={`Source for ${item.kind === 'image' ? 'img' : 'ci'}:${item.name || 'asset'}`}
                        />
                        <UsageSelect
                          value={item.usage}
                          onChange={(usage) =>
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, usage } : row,
                              ),
                            )
                          }
                          ariaLabel={`Usage for ${item.kind === 'image' ? 'img' : 'ci'}:${item.name || 'asset'}`}
                        />
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => removeItem(index)}
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
                                    : `ci:${icon.name}`
                                }
                              />
                              <code>
                                {icon.kind === 'image'
                                  ? `img:${icon.name}`
                                  : `ci:${icon.name}`}
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
                                        : `ci:${icon.name}`
                                    }
                                  />
                                  <code>
                                    {icon.kind === 'image'
                                      ? `img:${icon.name}`
                                      : `ci:${icon.name}`}
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
