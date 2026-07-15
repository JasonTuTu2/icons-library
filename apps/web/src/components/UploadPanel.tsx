import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  actionsUrl,
  dispatchApplyStaged,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  listStagedIcons,
  listUnpublishedIcons,
  sanitizeIconName,
  stageIcons,
  type IconColorMode,
  type StagedIcon,
} from '../lib/github'
import { useGithubSessionToken } from '../lib/githubAuth'

interface UploadItem {
  fileName: string
  name: string
  content: string
  previewUrl: string
  colorMode: IconColorMode
}

interface UploadPanelProps {
  localUploadEnabled: boolean
  onUploaded: (id: string) => void
}

function fileToUploadItem(file: File): Promise<UploadItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      const base = file.name.replace(/\.svg$/i, '')
      const name = sanitizeIconName(base) ?? ''
      resolve({
        fileName: file.name,
        name,
        content,
        previewUrl: URL.createObjectURL(file),
        colorMode: 'mono',
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function UploadPanel({
  localUploadEnabled,
  onUploaded,
}: UploadPanelProps) {
  const sessionToken = useGithubSessionToken()
  const githubRepoConfigured = isGithubRepoConfigured()
  const githubAuthed = isGithubAdminEnabled()
  const uploadEnabled = localUploadEnabled || githubRepoConfigured
  const mode: 'local' | 'github' | 'none' = localUploadEnabled
    ? 'local'
    : githubRepoConfigured
      ? 'github'
      : 'none'

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedIcon[]>([])
  const [unpublished, setUnpublished] = useState<StagedIcon[]>([])
  const [stagedLoading, setStagedLoading] = useState(false)

  const canSubmit = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => sanitizeIconName(item.name) !== null),
    [items],
  )

  const refreshStaged = useCallback(async () => {
    if (mode !== 'github' || !githubAuthed) return
    setStagedLoading(true)
    try {
      const [nextStaged, nextUnpublished] = await Promise.all([
        listStagedIcons(),
        listUnpublishedIcons(),
      ])
      setStaged(nextStaged)
      setUnpublished(nextUnpublished)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setStagedLoading(false)
    }
  }, [mode, githubAuthed])

  function close() {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (open && mode === 'github' && githubAuthed) {
      void refreshStaged()
    }
  }, [open, mode, githubAuthed, refreshStaged, sessionToken])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const svgs = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith('.svg'),
    )
    const next = await Promise.all(svgs.map(fileToUploadItem))
    setItems((prev) => [...prev, ...next])
    setMessage(null)
  }

  async function handleStage() {
    if (mode !== 'github' || !canSubmit || !githubAuthed) return
    setBusy(true)
    setMessage(null)
    try {
      const count = items.length
      await stageIcons(
        items.map((item) => ({
          name: item.name,
          content: item.content,
          colorMode: item.colorMode,
        })),
      )
      setItems([])
      await refreshStaged()
      setMessage(
        `Staged ${count} icon(s) on GitHub (shared queue). Click Apply when ready — no Action ran yet.`,
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
      const current = await listStagedIcons()
      setStaged(current)
      if (current.length === 0) {
        setMessage('Nothing is staged on GitHub right now.')
        return
      }

      const names = current.map((icon) => `gv:${icon.name}`).join(', ')
      const ok = window.confirm(
        `Apply ${current.length} staged icon(s) to the library?\n\n${names}\n\nApplies whatever is staged on GitHub right now. If someone else is still adding icons, they will not be included unless they click Apply again after.`,
      )
      if (!ok) return

      await dispatchApplyStaged()
      const first = current[0]
      if (first) onUploaded(`gv:${first.name}`)
      setMessage(
        `Apply queued for ${current.length} icon(s). Catalog regenerates in Actions — refresh Pages after it finishes. ${actionsUrl()}`,
      )
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
      setItems([])
      setMessage(`Uploaded ${count} icon(s). Catalog regenerated.`)
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
        Upload SVG
      </button>

      {open ? (
        <div className="upload-panel">
          <div className="upload-panel-header">
            <strong>Upload SVG</strong>
            <button
              type="button"
              className="ghost upload-close"
              onClick={close}
              aria-label="Close upload"
            >
              ×
            </button>
          </div>
          {!uploadEnabled ? (
            <p>
              Upload is not configured. Locally, run <code>pnpm dev</code>. On
              GitHub Pages, ensure <code>VITE_GITHUB_REPO</code> is set at build
              time and use <strong>Connect GitHub</strong> with a PAT.
            </p>
          ) : mode === 'github' && !githubAuthed ? (
            <p>
              Connect with a GitHub PAT (<code>contents: write</code> +{' '}
              <code>actions: write</code>) using the toolbar button. Tokens stay
              in this browser tab only — Actions use the{' '}
              <code>ICON_BROWSER_TOKEN</code> secret for apply/publish pushes.
            </p>
          ) : (
            <>
              <p>
                Drop Figma-exported SVGs. Names become <code>gv:kebab-name</code>.
                Set each icon to monochrome (recolorable) or multi-color (preserved
                fills).
                {mode === 'github'
                  ? " On Pages, files go to a shared staging folder first; Apply promotes everyone's staged icons in one Action."
                  : ' Writes to disk and regenerates the catalog locally.'}
              </p>
              <label className="upload-drop">
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  multiple
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <span>Choose SVG files or drop them here</span>
              </label>

              {items.length > 0 ? (
                <ul className="upload-list">
                  {items.map((item, index) => (
                    <li key={`${item.fileName}-${index}`}>
                      <img src={item.previewUrl} alt="" width={28} height={28} />
                      <label>
                        <span>gv:</span>
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
                                        : 'mono',
                                  }
                                : row,
                            ),
                          )
                        }}
                      >
                        <option value="mono">Monochrome</option>
                        <option value="preserved">Multi-color</option>
                      </select>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== index))
                        }
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
                    disabled={!canSubmit || busy}
                    onClick={() => void handleStage()}
                  >
                    {busy ? 'Working…' : 'Add to staging'}
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
                      <p className="staged-empty">No staged icons.</p>
                    ) : (
                      <ul className="staged-list">
                        {staged.map((icon) => (
                          <li key={icon.path}>
                            <code>gv:{icon.name}</code>
                            <span>
                              {icon.colorMode === 'preserved'
                                ? 'multi-color'
                                : 'mono'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="ghost accent"
                      disabled={busy || staged.length === 0}
                      onClick={() => void handleApplyStaged()}
                    >
                      {busy ? 'Working…' : 'Apply staged to library'}
                    </button>
                  </div>

                  <div className="staged-block">
                    <div className="staged-header">
                      <strong>In library (unpublished)</strong>
                    </div>
                    {unpublished.length === 0 ? (
                      <p className="staged-empty">No unpublished icons.</p>
                    ) : (
                      <ul className="staged-list">
                        {unpublished.map((icon) => (
                          <li key={icon.path}>
                            <code>gv:{icon.name}</code>
                            <span>
                              {icon.colorMode === 'preserved'
                                ? 'multi-color'
                                : 'mono'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
          {message ? <p className="copy-toast">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
