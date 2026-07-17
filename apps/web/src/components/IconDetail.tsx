import { useEffect, useState } from 'react'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { Icon } from '@JasonTuTu2/icons-react'
import {
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  stageRemovals,
  updateIconMetadata,
  type IconSource,
  type IconVariant,
} from '../lib/github'
import { customImagePublicUrl } from '../lib/customImageUrl'
import { CategorySelect, categoryLabel } from './CategorySelect'
import { VariantSelect, variantLabel } from './VariantSelect'
import { SourceSelect, sourceLabel } from './SourceSelect'
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
    icon.variant === 'filled' ? 'filled' : 'regular',
  )
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceMessage, setSourceMessage] = useState<string | null>(null)
  const [sourceValue, setSourceValue] = useState<IconSource>(
    icon.source === 'iconify' || icon.source === 'modified'
      ? icon.source
      : 'custom',
  )

  const isCustomAsset =
    icon.id.startsWith('ci:') || icon.id.startsWith('img:')

  const canStageRemoval =
    isCustomAsset && isGithubRepoConfigured() && isGithubAdminEnabled()

  const canEditMeta =
    isCustomAsset && isGithubRepoConfigured() && isGithubAdminEnabled()

  useEffect(() => {
    setCategoryValue(icon.category ?? '')
    setVariantValue(icon.variant === 'filled' ? 'filled' : 'regular')
    setSourceValue(
      icon.source === 'iconify' || icon.source === 'modified'
        ? icon.source
        : 'custom',
    )
  }, [icon.id, icon.category, icon.variant, icon.source])

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
      setVariantValue(icon.variant === 'filled' ? 'filled' : 'regular')
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
          <dt>Set</dt>
          <dd>
            {icon.set}
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
