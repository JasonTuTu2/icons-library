import { useMemo, useState } from 'react'

interface UploadItem {
  fileName: string
  name: string
  content: string
  previewUrl: string
}

interface UploadPanelProps {
  uploadEnabled: boolean
  onUploaded: (id: string) => void
}

function fileToUploadItem(file: File): Promise<UploadItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      const base = file.name.replace(/\.svg$/i, '')
      const name = base
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
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

export function UploadPanel({ uploadEnabled, onUploaded }: UploadPanelProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => items.length > 0 && items.every((item) => item.name.length > 0),
    [items],
  )

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
      let lastId = ''
      const count = items.length
      for (const item of items) {
        const res = await fetch('/__gv/icons/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.name, content: item.content }),
        })
        const data = (await res.json()) as { ok?: boolean; id?: string; error?: string }
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
      <button type="button" className="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? 'Close upload' : 'Upload SVG'}
      </button>

      {open ? (
        <div className="upload-panel">
          {!uploadEnabled ? (
            <p>
              Upload writes to disk only during local <code>pnpm dev</code>. To
              add icons in production builds, commit SVGs under{' '}
              <code>packages/custom-icons/svg/</code> and run{' '}
              <code>pnpm catalog:gen</code>.
            </p>
          ) : (
            <>
              <p>
                Drop Figma-exported monochrome SVGs. Names become{' '}
                <code>gv:kebab-name</code>.
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
                {busy ? 'Uploading…' : 'Save to library'}
              </button>
            </>
          )}
          {message ? <p className="copy-toast">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
