import { useEffect, useMemo, useState } from 'react'
import {
  dispatchIconUpload,
  isGithubAdminEnabled,
  sanitizeIconName,
  actionsUrl,
  type IconColorMode,
} from '../lib/github'

interface UploadItem {
  fileName: string
  name: string
  content: string
  previewUrl: string
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
  const githubEnabled = isGithubAdminEnabled()
  const uploadEnabled = localUploadEnabled || githubEnabled
  const mode: 'local' | 'github' | 'none' = localUploadEnabled
    ? 'local'
    : githubEnabled
      ? 'github'
      : 'none'

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [colorMode, setColorMode] = useState<IconColorMode>('mono')

  const canSubmit = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => sanitizeIconName(item.name) !== null),
    [items],
  )

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

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const svgs = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith('.svg'),
    )
    const next = await Promise.all(svgs.map(fileToUploadItem))
    setItems((prev) => [...prev, ...next])
    setMessage(null)
  }

  async function handleUpload() {
    if (!uploadEnabled || !canSubmit) return
    setBusy(true)
    setMessage(null)
    try {
      const count = items.length
      const lastName = sanitizeIconName(items[items.length - 1]!.name)!

      if (mode === 'github') {
        await dispatchIconUpload(
          items.map((item) => ({
            name: item.name,
            content: item.content,
            colorMode,
          })),
        )
        setItems([])
        setMessage(
          `Queued ${count} icon(s) on main. Catalog regenerates in Actions — refresh the site in ~1–2 minutes. ${actionsUrl()}`,
        )
        onUploaded(`gv:${lastName}`)
        return
      }

      let lastId = ''
      for (const item of items) {
        const res = await fetch('/__gv/icons/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            content: item.content,
            colorMode,
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
              GitHub Pages, set the <code>ICON_BROWSER_TOKEN</code> repo secret
              and redeploy.
            </p>
          ) : (
            <>
              <p>
                Drop Figma-exported SVGs. Names become <code>gv:kebab-name</code>.
                Choose monochrome (recolorable) or multi-color (preserved fills).
                {mode === 'github'
                  ? ' Saves go straight to main via GitHub Actions.'
                  : ' Writes to disk and regenerates the catalog locally.'}
              </p>
              <label className="field">
                <span>Color mode</span>
                <select
                  value={colorMode}
                  onChange={(e) =>
                    setColorMode(e.target.value as IconColorMode)
                  }
                >
                  <option value="mono">Monochrome (currentColor)</option>
                  <option value="preserved">Multi-color (preserved)</option>
                </select>
              </label>
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

              <button
                type="button"
                className="ghost accent"
                disabled={!canSubmit || busy}
                onClick={() => void handleUpload()}
              >
                {busy
                  ? 'Uploading…'
                  : mode === 'github'
                    ? 'Save to GitHub'
                    : 'Save to library'}
              </button>
            </>
          )}
          {message ? <p className="copy-toast">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
