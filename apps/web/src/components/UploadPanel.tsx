import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  actionsWorkflowUrl,
  dispatchApplyStaged,
  detectVariantFromName,
  detectVariantSuffix,
  findIconNameConflicts,
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
  importStagingHandoff,
  parseStagingHandoffFile,
  retryPendingStagingHandoffImport,
  takePendingStagingHandoff,
  takeStagingImportMessage,
} from '../lib/stagingHandoff'
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
import {
  analyzeItemConflicts,
  confirmLibraryReplacements,
} from '../lib/nameConflicts'
import { isAuthApiConfigured } from '../lib/sessionAuth'
import { WorkflowQueuedNotice } from './WorkflowQueuedNotice'
import { GithubAssetPreview } from './GithubAssetPreview'
import { ApplyAllFields } from './ApplyAllFields'
import { CategorySelect, categoryLabel } from './CategorySelect'
import { VariantSelect, variantLabel } from './VariantSelect'
import { SourceSelect, sourceLabel } from './SourceSelect'
import { UsageSelect, usageLabel } from './UsageSelect'
import { NoteToggleField } from './NoteToggleField'
import { DropdownCombobox } from './DropdownCombobox'
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
  note: string
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
    note: '',
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
  const stagingMsg = takeStagingImportMessage()
  if (stagingMsg) {
    return { open: true, items: [], message: stagingMsg }
  }
  if (openPanel) {
    return {
      open: true,
      items: [],
      message:
        'Drop gv-staging-handoff.json (or SVG / PNG / JPG) here, then Stage.',
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
            note: '',
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
          reject(
            new Error(
              `Not a valid Figma handoff JSON: ${file.name}. For plugin staging, drop gv-staging-handoff.json after Open icon browser downloads it.`,
            ),
          )
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
          note: '',
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
  const [replaceHintMsgs, setReplaceHintMsgs] = useState<string[]>([])
  const [conflictsChecking, setConflictsChecking] = useState(false)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const { unpublished, checkedPaths, allChecked } = useUnpublishedSelection()
  const wasOpenRef = useRef(open)
  const stagingImportStarted = useRef(false)

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
    if (mode !== 'github' || !githubRepoConfigured) return
    setStagedLoading(true)
    try {
      const [nextStaged, nextRemovals, nextUnpublished] = await Promise.all([
        listStagedIcons(),
        listStagedRemovals(),
        listUnpublishedIcons().catch(() => [] as StagedIcon[]),
      ])
      setStaged(nextStaged)
      setStagedRemovals(nextRemovals)
      setUnpublishedIcons(nextUnpublished)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setStagedLoading(false)
    }
  }, [mode, githubRepoConfigured])

  const handoffRetryStarted = useRef(false)

  useEffect(() => {
    if (handoffRetryStarted.current) return
    handoffRetryStarted.current = true
    void retryPendingStagingHandoffImport().then((did) => {
      if (did) void refreshStaged()
    })
  }, [refreshStaged])

  useEffect(() => {
    if (stagingImportStarted.current) return
    const payload = takePendingStagingHandoff()
    if (!payload) return
    stagingImportStarted.current = true
    void (async () => {
      try {
        await importStagingHandoff(payload)
        await refreshStaged()
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [refreshStaged])

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
    if (open && mode === 'github' && githubRepoConfigured) {
      void refreshStaged()
    }
  }, [open, mode, githubRepoConfigured, refreshStaged])

  // Strict live name checks — Stage stays disabled until every name is free.
  useEffect(() => {
    if (mode !== 'github' || !githubRepoConfigured || items.length === 0) {
      setNameConflictMsgs([])
      setReplaceHintMsgs([])
      setConflictsChecking(false)
      return
    }

    const conflictItems = items.map((item) => ({
      name: item.name,
      kind: item.kind === 'image' ? ('image' as const) : ('svg' as const),
    }))
    const batchDupes = analyzeItemConflicts(conflictItems, [])
    setNameConflictMsgs(batchDupes.messages)
    setReplaceHintMsgs(batchDupes.replaceHints)

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
          const analysis = analyzeItemConflicts(conflictItems, remote)
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
  }, [items, mode, githubRepoConfigured])

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
      const stagingFiles = files.filter((f) =>
        f.name.toLowerCase().endsWith('.json'),
      )
      const otherFiles = files.filter(
        (f) => !f.name.toLowerCase().endsWith('.json'),
      )

      for (const file of stagingFiles) {
        const content = await file.text()
        const staging = parseStagingHandoffFile(content)
        if (staging) {
          await importStagingHandoff(staging)
          await refreshStaged()
          setMessage(
            `Imported ${staging.icons.length} staged add(s) and ${staging.removals.length} removal(s) from ${file.name}.`,
          )
          continue
        }
        const handoff = parseFigmaHandoffFile(content)
        if (!handoff) {
          throw new Error(`Not a valid handoff JSON: ${file.name}`)
        }
        setItems((prev) => [...prev, ...handoff.map(handoffToUploadItem)])
      }

      if (otherFiles.length > 0) {
        const batches = await Promise.all(otherFiles.map(fileToUploadItem))
        setItems((prev) => [...prev, ...batches.flat()])
      }
      if (stagingFiles.length === 0) setMessage(null)
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
    if (mode !== 'github' || !canSubmit || !githubRepoConfigured) return
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
      const conflictItems = items.map((item) => ({
        name: item.name,
        kind: item.kind === 'image' ? ('image' as const) : ('svg' as const),
      }))
      const analysis = analyzeItemConflicts(conflictItems, remote)
      if (analysis.messages.some((msg) => msg.length > 0)) {
        setNameConflictMsgs(analysis.messages)
        setReplaceHintMsgs(analysis.replaceHints)
        setMessage(
          'Fix staging conflicts or batch duplicates before adding.',
        )
        return
      }
      if (!confirmLibraryReplacements(analysis.replaceKeys)) {
        return
      }

      const replaceKeySet = new Set(analysis.replaceKeys)
      const count = items.length
      await stageIcons(
        items.map((item) => {
          const kind = item.kind === 'image' ? 'image' : 'svg'
          const name = sanitizeIconName(item.name) ?? item.name
          const replaceLibrary = replaceKeySet.has(`${kind}:${name}`)
          return item.kind === 'image'
            ? {
                name: item.name,
                content: item.content,
                kind: 'image' as const,
                format: item.format!,
                category: item.category,
                variant: item.variant,
                source: item.source,
                usage: item.usage,
                note: item.note,
                replaceLibrary,
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
                note: item.note,
                replaceLibrary,
              }
        }),
      )
      setItems((prev) => {
        revokePreviewUrls(prev)
        return []
      })
      await refreshStaged()
      setMessage(
        `Staged ${count} asset(s) locally in this browser. Apply uploads your queue to GitHub when ready.`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleApplyStaged() {
    if (mode !== 'github' || !canApplyPublish) return
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
        setMessage('Nothing is staged in this browser.')
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
        `Apply staged changes to the library?\n\n${summary}\n\nThis uploads your local queue to GitHub and runs Apply. Only what you staged in this browser is included.`,
      )
      if (!ok) return

      await dispatchApplyStaged()
      await refreshStaged()
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
    if (mode !== 'github' || !githubRepoConfigured) return
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
            note: item.note,
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

      {open
        ? createPortal(
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
                {mode === 'github' ? (
                  <p>
                    Drop SVG icons or PNG/JPG brand images. Staging is saved in
                    this browser until Apply. SVGs become{' '}
                    <code>ci:kebab-name</code> Images become{' '}
                    <code>img:kebab-name</code> (not usable with{' '}
                    <code>&lt;Icon /&gt;</code>).
                    {!canApplyPublish ? (
                      <>
                        {' '}
                        {isAuthApiConfigured() ? (
                          <>
                            Sign in (designer or dev) to Apply.
                          </>
                        ) : (
                          <>
                            Apply needs a maintainer PAT (
                            <code>#gv-github-token=…</code>).
                          </>
                        )}
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p>
                    Drop SVG icons or PNG/JPG brand images. SVGs become{' '}
                    <code>ci:kebab-name</code> Images become{' '}
                    <code>img:kebab-name</code> (not usable with{' '}
                    <code>&lt;Icon /&gt;</code>).
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
                      onApplyNote={(note) =>
                        setItems((prev) =>
                          prev.map((row) => ({ ...row, note })),
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
                      const replaceHint = replaceHintMsgs[index] ?? ''
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
                          <DropdownCombobox
                            className="color-mode-dropdown"
                            ariaLabel={`Color mode for ci:${item.name || 'icon'}`}
                            value={item.colorMode}
                            searchable
                            placeholder="Color…"
                            displayValue={(v) => {
                              if (v === 'preserved') return 'Multi-color'
                              if (v === 'gradient') return 'Gradient'
                              return 'Monochrome'
                            }}
                            options={[
                              { value: 'mono', label: 'Monochrome' },
                              { value: 'preserved', label: 'Multi-color' },
                              { value: 'gradient', label: 'Gradient' },
                            ]}
                            onChange={(value) => {
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
                          />
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
                        <NoteToggleField
                          value={item.note}
                          ariaLabel={`Note for ${item.kind === 'image' ? 'img' : 'ci'}:${item.name || 'asset'}`}
                          onChange={(note) =>
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, note } : row,
                              ),
                            )
                          }
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
                        ) : replaceHint ? (
                          <p className="name-replace-hint">{replaceHint}</p>
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
                      disabled={!canSubmit || busy || !githubRepoConfigured}
                      onClick={() => void handleStage()}
                    >
                      {busy ? 'Working…' : 'Add to staging'}
                    </button>

                    <div className="staged-block">
                      <div className="staged-header">
                        <strong>Staged locally</strong>
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
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
