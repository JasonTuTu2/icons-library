import { useState } from 'react'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { Icon } from '@JasonTuTu2/icons-react'
import {
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  stageRemovals,
} from '../lib/github'
import { customImagePublicUrl } from '../lib/customImageUrl'

interface IconDetailProps {
  icon: IconMeta
  reactCode: string
  vueCode: string
  onClose: () => void
  onRemovalStaged?: (name: string) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function IconDetail({
  icon,
  reactCode,
  vueCode,
  onClose,
  onRemovalStaged,
}: IconDetailProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeMessage, setRemoveMessage] = useState<string | null>(null)

  const isCustomAsset =
    icon.source === 'custom' &&
    (icon.id.startsWith('ci:') || icon.id.startsWith('img:'))

  const canStageRemoval =
    isCustomAsset && isGithubRepoConfigured() && isGithubAdminEnabled()

  async function handleCopy(label: string, text: string) {
    const ok = await copyText(text)
    setCopied(ok ? label : 'failed')
    window.setTimeout(() => setCopied(null), 1600)
  }

  async function handleStageRemoval() {
    const name = icon.id.replace(/^(gv|img):/, '')
    const ok = window.confirm(
      `Stage removal of ${icon.id}?\n\nThis writes a shared marker on GitHub. The file stays in the library until someone clicks Apply staged. Consumers keep it until you Publish after Apply.`,
    )
    if (!ok) return

    setBusy(true)
    setRemoveMessage(null)
    try {
      await stageRemovals([name])
      setRemoveMessage(
        `Staged removal of ${icon.id}. Apply from Upload when ready.`,
      )
      onRemovalStaged?.(name)
    } catch (err) {
      setRemoveMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const isImage = icon.assetKind === 'image'

  return (
    <aside className="detail">
      <div className="detail-header">
        <h2>{icon.title}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-preview">
        {isImage && icon.assetPath ? (
          <img
            className="detail-preview-image"
            src={customImagePublicUrl(icon.assetPath)}
            alt={icon.title}
          />
        ) : (
          <Icon name={icon.id} size={56} label={icon.title} />
        )}
      </div>

      <dl className="meta">
        <div>
          <dt>Canonical name</dt>
          <dd>
            <code>{icon.id}</code>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopy('name', icon.id)}
            >
              Copy
            </button>
          </dd>
        </div>
        <div>
          <dt>Set / source</dt>
          <dd>
            {icon.set} · {icon.source}
            {isImage ? ' · brand image' : ''}
          </dd>
        </div>
        {icon.format ? (
          <div>
            <dt>Format</dt>
            <dd>{icon.format.toUpperCase()}</dd>
          </div>
        ) : null}
        {icon.colorMode ? (
          <div>
            <dt>Color mode</dt>
            <dd>
              {icon.colorMode === 'preserved'
                ? 'Multi-color (preserved)'
                : icon.colorMode === 'gradient'
                  ? 'Gradient (preserved paints)'
                  : 'Monochrome'}
              {icon.colorMode === 'preserved' ||
              icon.colorMode === 'gradient' ? (
                <span className="meta-note">
                  {' '}
                  The <code>color</code> prop may not recolor this icon.
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>License</dt>
          <dd>
            {icon.license.title}
            {icon.license.spdx ? ` (${icon.license.spdx})` : ''}
            {icon.license.url ? (
              <>
                {' '}
                <a href={icon.license.url} target="_blank" rel="noreferrer">
                  Upstream
                </a>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <section className="snippet">
        <div className="snippet-head">
          <h3>{isImage ? 'Usage' : 'React'}</h3>
          <button
            type="button"
            className="ghost"
            onClick={() => handleCopy('react', reactCode)}
          >
            Copy
          </button>
        </div>
        <pre>
          <code>{reactCode}</code>
        </pre>
      </section>

      {!isImage ? (
        <section className="snippet">
          <div className="snippet-head">
            <h3>Vue</h3>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopy('vue', vueCode)}
            >
              Copy
            </button>
          </div>
          <pre>
            <code>{vueCode}</code>
          </pre>
        </section>
      ) : (
        <section className="snippet">
          <div className="snippet-head">
            <h3>Vue</h3>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopy('vue', vueCode)}
            >
              Copy
            </button>
          </div>
          <pre>
            <code>{vueCode}</code>
          </pre>
        </section>
      )}

      {canStageRemoval ? (
        <div className="detail-actions">
          <button
            type="button"
            className="ghost danger"
            disabled={busy}
            onClick={() => void handleStageRemoval()}
          >
            {busy ? 'Staging…' : 'Stage removal'}
          </button>
          <p className="meta-note">
            Stages a shared removal marker. Apply deletes the file from the
            library; Publish drops it from packages.
          </p>
          {removeMessage ? (
            <p className="copy-toast" role="status">
              {removeMessage}
            </p>
          ) : null}
        </div>
      ) : isCustomAsset &&
        isGithubRepoConfigured() &&
        !isGithubAdminEnabled() ? (
        <p className="meta-note">
          GitHub write access is not configured — cannot stage removal.
        </p>
      ) : null}

      {copied ? (
        <p className="copy-toast" role="status">
          {copied === 'failed' ? 'Copy failed' : `Copied ${copied}`}
        </p>
      ) : null}
    </aside>
  )
}
