import { useEffect, useState } from 'react'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { Icon } from '@JasonTuTu2/icons-react'
import {
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  packagesUrl,
  stageRemovals,
  updateIconMetadata,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from '../lib/github'
import { customImagePublicUrl } from '../lib/customImageUrl'
import { downloadIconAsset, resolveIconAssetPath } from '../lib/iconAssetUrl'
import { CategorySelect, categoryLabel } from './CategorySelect'
import { VariantSelect, variantLabel } from './VariantSelect'
import { SourceSelect, sourceLabel } from './SourceSelect'
import { UsageSelect, usageLabel } from './UsageSelect'
import {
  loadCategoryRegistry,
  mergeCategoryIntoRegistry,
} from '../lib/categories'

interface IconDetailProps {
  icon: IconMeta
  reactCode: string
  vueCode: string
  onClose: () => void
  onRemovalStaged?: (name: string) => void
  onCategoryUpdated?: (category: string) => void
  onVariantUpdated?: (variant: IconVariant) => void
  onSourceUpdated?: (source: IconSource) => void
  onUsageUpdated?: (usage: IconUsage) => void
  onNoteUpdated?: (note: string) => void
  /** First published package version (fixed after first ship). */
  introducedPackageVersion?: string | null
  introducedVersionLoading?: boolean
  introducedVersionPending?: boolean
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
  onCategoryUpdated,
  onVariantUpdated,
  onSourceUpdated,
  onUsageUpdated,
  onNoteUpdated,
  introducedPackageVersion = null,
  introducedVersionLoading = false,
  introducedVersionPending = false,
}: IconDetailProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeMessage, setRemoveMessage] = useState<string | null>(null)
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null)
  const [categoryRegistry, setCategoryRegistry] = useState<string[]>([])
  const [categoryValue, setCategoryValue] = useState(icon.category ?? '')
  const [variantBusy, setVariantBusy] = useState(false)
  const [variantMessage, setVariantMessage] = useState<string | null>(null)
  const [variantValue, setVariantValue] = useState<IconVariant>(
    icon.variant === 'filled'
      ? 'filled'
      : icon.variant === 'regular'
        ? 'regular'
        : 'none',
  )
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceMessage, setSourceMessage] = useState<string | null>(null)
  const [sourceValue, setSourceValue] = useState<IconSource>(
    icon.source === 'iconify' || icon.source === 'modified'
      ? icon.source
      : 'custom',
  )
  const [usageBusy, setUsageBusy] = useState(false)
  const [usageMessage, setUsageMessage] = useState<string | null>(null)
  const [usageValue, setUsageValue] = useState<IconUsage>(
    icon.usage === 'unused' ? 'unused' : 'in-use',
  )
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteMessage, setNoteMessage] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState(icon.note ?? '')
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)

  const isCustomAsset =
    icon.id.startsWith('ci:') || icon.id.startsWith('img:')
  const canDownload = Boolean(resolveIconAssetPath(icon))

  const canStageRemoval =
    isCustomAsset && isGithubRepoConfigured()

  const canEditMeta =
    isCustomAsset && isGithubRepoConfigured() && isGithubAdminEnabled()

  useEffect(() => {
    setCategoryValue(icon.category ?? '')
    setVariantValue(
      icon.variant === 'filled'
        ? 'filled'
        : icon.variant === 'regular'
          ? 'regular'
          : 'none',
    )
    setSourceValue(
      icon.source === 'iconify' || icon.source === 'modified'
        ? icon.source
        : 'custom',
    )
    setUsageValue(icon.usage === 'unused' ? 'unused' : 'in-use')
    setNoteValue(icon.note ?? '')
    setDownloadMessage(null)
  }, [icon.id, icon.category, icon.variant, icon.source, icon.usage, icon.note])

  useEffect(() => {
    if (!isCustomAsset) return
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
  }, [isCustomAsset])

  async function handleCategoryChange(nextCategory: string) {
    const name = icon.name
    setCategoryValue(nextCategory)
    if (!canEditMeta) return

    setCategoryBusy(true)
    setCategoryMessage(null)
    try {
      await updateIconMetadata(name, { category: nextCategory })
      onCategoryUpdated?.(nextCategory)
      setCategoryMessage('Category saved.')
    } catch (err) {
      setCategoryValue(icon.category ?? '')
      setCategoryMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setCategoryBusy(false)
    }
  }

  async function handleVariantChange(nextVariant: IconVariant) {
    const name = icon.name
    setVariantValue(nextVariant)
    if (!canEditMeta) return

    setVariantBusy(true)
    setVariantMessage(null)
    try {
      await updateIconMetadata(name, { variant: nextVariant })
      onVariantUpdated?.(nextVariant)
      setVariantMessage('Variant saved.')
    } catch (err) {
      setVariantValue(
        icon.variant === 'filled'
          ? 'filled'
          : icon.variant === 'regular'
            ? 'regular'
            : 'none',
      )
      setVariantMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setVariantBusy(false)
    }
  }

  async function handleSourceChange(nextSource: IconSource) {
    const name = icon.name
    setSourceValue(nextSource)
    if (!canEditMeta) return

    setSourceBusy(true)
    setSourceMessage(null)
    try {
      await updateIconMetadata(name, { source: nextSource })
      onSourceUpdated?.(nextSource)
      setSourceMessage('Source saved.')
    } catch (err) {
      setSourceValue(
        icon.source === 'iconify' || icon.source === 'modified'
          ? icon.source
          : 'custom',
      )
      setSourceMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSourceBusy(false)
    }
  }

  async function handleUsageChange(nextUsage: IconUsage) {
    const name = icon.name
    setUsageValue(nextUsage)
    if (!canEditMeta) return

    setUsageBusy(true)
    setUsageMessage(null)
    try {
      await updateIconMetadata(name, { usage: nextUsage })
      onUsageUpdated?.(nextUsage)
      setUsageMessage('Status saved.')
    } catch (err) {
      setUsageValue(icon.usage === 'unused' ? 'unused' : 'in-use')
      setUsageMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setUsageBusy(false)
    }
  }

  async function handleNoteSave() {
    const name = icon.name
    const nextNote = noteValue.trim().slice(0, 500)
    setNoteValue(nextNote)
    if (!canEditMeta) return
    if (nextNote === (icon.note ?? '').trim()) return

    setNoteBusy(true)
    setNoteMessage(null)
    try {
      await updateIconMetadata(name, { note: nextNote })
      onNoteUpdated?.(nextNote)
      setNoteMessage('Note saved.')
    } catch (err) {
      setNoteValue(icon.note ?? '')
      setNoteMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setNoteBusy(false)
    }
  }

  async function handleCopy(label: string, text: string) {
    const ok = await copyText(text)
    setCopied(ok ? label : 'failed')
    window.setTimeout(() => setCopied(null), 1600)
  }

  async function handleStageRemoval() {
    const name = icon.name
    const ok = window.confirm(
      `Stage removal of ${icon.id}?\n\nThis queues a removal in this browser until someone clicks Apply. The file stays in the library until then.`,
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

  async function handleDownload() {
    setDownloadBusy(true)
    setDownloadMessage(null)
    try {
      await downloadIconAsset(icon)
      setDownloadMessage('Downloaded.')
      window.setTimeout(() => setDownloadMessage(null), 1600)
    } catch (err) {
      setDownloadMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setDownloadBusy(false)
    }
  }

  const isImage = icon.assetKind === 'image'
  const downloadLabel = isImage
    ? `Download ${(icon.format ?? 'image').toUpperCase()}`
    : 'Download SVG'

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

      {canDownload ? (
        <div className="detail-download">
          <button
            type="button"
            className="ghost"
            disabled={downloadBusy}
            onClick={() => void handleDownload()}
          >
            {downloadBusy ? 'Downloading…' : downloadLabel}
          </button>
          {downloadMessage ? (
            <p className="copy-toast" role="status">
              {downloadMessage}
            </p>
          ) : null}
        </div>
      ) : null}

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
        {icon.format ? (
          <div>
            <dt>Format</dt>
            <dd>
              {icon.format.toUpperCase()}
              {isImage ? ' · brand image' : ''}
            </dd>
          </div>
        ) : isImage ? (
          <div>
            <dt>Type</dt>
            <dd>Brand image</dd>
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
        {isCustomAsset && isGithubRepoConfigured() && isGithubAdminEnabled() ? (
          <div>
            <dt>Added in package</dt>
            <dd>
              {introducedVersionLoading ? (
                <span className="meta-note">Loading…</span>
              ) : introducedPackageVersion ? (
                <a href={packagesUrl()} target="_blank" rel="noreferrer">
                  v{introducedPackageVersion}
                </a>
              ) : introducedVersionPending ? (
                'Not published yet'
              ) : (
                '—'
              )}
            </dd>
          </div>
        ) : null}
        {isCustomAsset ? (
          <div>
            <dt>Category</dt>
            <dd>
              {canEditMeta ? (
                <CategorySelect
                  value={categoryValue}
                  onChange={(category) => void handleCategoryChange(category)}
                  categories={categoryRegistry}
                  onCreateCategory={(name) =>
                    setCategoryRegistry((prev) =>
                      mergeCategoryIntoRegistry(prev, name),
                    )
                  }
                  ariaLabel={`Category for ${icon.id}`}
                />
              ) : (
                categoryLabel(icon.category)
              )}
              {categoryBusy ? (
                <span className="meta-note"> Saving…</span>
              ) : null}
              {categoryMessage ? (
                <p className="meta-note" role="status">
                  {categoryMessage}
                </p>
              ) : null}
            </dd>
          </div>
        ) : null}
        {isCustomAsset ? (
          <div>
            <dt>Variant</dt>
            <dd>
              {canEditMeta ? (
                <VariantSelect
                  value={variantValue}
                  onChange={(variant) => void handleVariantChange(variant)}
                  ariaLabel={`Variant for ${icon.id}`}
                />
              ) : (
                variantLabel(icon.variant)
              )}
              {variantBusy ? (
                <span className="meta-note"> Saving…</span>
              ) : null}
              {variantMessage ? (
                <p className="meta-note" role="status">
                  {variantMessage}
                </p>
              ) : null}
            </dd>
          </div>
        ) : null}
        {isCustomAsset ? (
          <div>
            <dt>Source</dt>
            <dd>
              {canEditMeta ? (
                <SourceSelect
                  value={sourceValue}
                  onChange={(source) => void handleSourceChange(source)}
                  ariaLabel={`Source for ${icon.id}`}
                />
              ) : (
                sourceLabel(icon.source)
              )}
              {sourceBusy ? (
                <span className="meta-note"> Saving…</span>
              ) : null}
              {sourceMessage ? (
                <p className="meta-note" role="status">
                  {sourceMessage}
                </p>
              ) : null}
            </dd>
          </div>
        ) : null}
        {isCustomAsset ? (
          <div>
            <dt>Status</dt>
            <dd>
              {canEditMeta ? (
                <UsageSelect
                  value={usageValue}
                  onChange={(usage) => void handleUsageChange(usage)}
                  ariaLabel={`Status for ${icon.id}`}
                />
              ) : (
                usageLabel(icon.usage)
              )}
              {usageBusy ? (
                <span className="meta-note"> Saving…</span>
              ) : null}
              {usageMessage ? (
                <p className="meta-note" role="status">
                  {usageMessage}
                </p>
              ) : null}
            </dd>
          </div>
        ) : null}
        {isCustomAsset ? (
          <div className="meta-note-row">
            <dt>Note</dt>
            <dd>
              {canEditMeta ? (
                <textarea
                  className="detail-note-input"
                  placeholder="Add a note…"
                  maxLength={500}
                  rows={3}
                  value={noteValue}
                  aria-label={`Note for ${icon.id}`}
                  onChange={(e) => setNoteValue(e.target.value)}
                  onBlur={() => void handleNoteSave()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      ;(e.target as HTMLTextAreaElement).blur()
                    }
                  }}
                />
              ) : icon.note?.trim() ? (
                icon.note
              ) : (
                'No note'
              )}
              {noteBusy ? (
                <span className="meta-note"> Saving…</span>
              ) : null}
              {noteMessage ? (
                <p className="meta-note" role="status">
                  {noteMessage}
                </p>
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
            Stages a removal in this browser. Apply deletes the file from the
            library; Publish drops it from packages.
          </p>
          {removeMessage ? (
            <p className="copy-toast" role="status">
              {removeMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {copied ? (
        <p className="copy-toast" role="status">
          {copied === 'failed' ? 'Copy failed' : `Copied ${copied}`}
        </p>
      ) : null}
    </aside>
  )
}
