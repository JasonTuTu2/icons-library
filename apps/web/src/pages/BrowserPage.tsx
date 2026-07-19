import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  reactSnippet,
  vueSnippet,
  type IconMeta,
} from '@JasonTuTu2/icons-catalog'
import { IconGrid } from '../components/IconGrid'
import { IconTable } from '../components/IconTable'
import { IconDetail } from '../components/IconDetail'
import { UploadPanel } from '../components/UploadPanel'
import { PublishButton } from '../components/PublishButton'
import {
  isGithubRepoConfigured,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from '../lib/github'
import { useLiveCatalog } from '../lib/liveCatalog'

/** Toolbar sentinel: show all categories. */
const CATEGORY_ALL = ''
/** Toolbar sentinel: icons with no category assigned. */
const CATEGORY_NONE = '__none__'

const VARIANT_ALL = ''
const SOURCE_ALL = ''

export function BrowserPage() {
  const { categories, search, getById, patchIcon } = useLiveCatalog()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL)
  const [variantFilter, setVariantFilter] = useState(VARIANT_ALL)
  const [sourceFilter, setSourceFilter] = useState(SOURCE_ALL)
  const [usageFilter, setUsageFilter] = useState<'in-use' | 'unused'>('in-use')
  const [selected, setSelected] = useState<IconMeta | null>(null)
  const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('grid')
  const [localUploadEnabled, setLocalUploadEnabled] = useState(false)

  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let cancelled = false
    fetch('/__gv/icons/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { uploadEnabled?: boolean } | null) => {
        if (!cancelled) setLocalUploadEnabled(Boolean(data?.uploadEnabled))
      })
      .catch(() => {
        if (!cancelled) setLocalUploadEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const icons = useMemo(() => {
    const options: Parameters<typeof search>[0] = {
      query: deferredQuery,
    }
    if (categoryFilter === CATEGORY_NONE) {
      options.category = ''
    } else if (categoryFilter !== CATEGORY_ALL) {
      options.category = categoryFilter
    }
    if (variantFilter === 'regular' || variantFilter === 'filled') {
      options.variant = variantFilter
    }
    if (
      sourceFilter === 'iconify' ||
      sourceFilter === 'custom' ||
      sourceFilter === 'modified'
    ) {
      options.source = sourceFilter
    }
    options.usage = usageFilter
    return search(options)
  }, [
    search,
    deferredQuery,
    categoryFilter,
    variantFilter,
    sourceFilter,
    usageFilter,
  ])

  // Keep sidebar selection in sync when live metadata / overrides change.
  useEffect(() => {
    if (!selected) return
    const next = getById(selected.id)
    if (!next) return
    if (
      next.category === selected.category &&
      next.variant === selected.variant &&
      next.source === selected.source &&
      next.usage === selected.usage &&
      next.note === selected.note
    ) {
      return
    }
    setSelected(next)
  }, [getById, selected])

  function patchSelected(
    name: string,
    patch: {
      category?: string
      variant?: IconVariant
      source?: IconSource
      usage?: IconUsage
      note?: string
    },
  ) {
    patchIcon(name, patch)
    setSelected((current) => {
      if (!current || current.name !== name) return current
      const category =
        patch.category !== undefined
          ? patch.category.trim() || undefined
          : current.category
      const note =
        patch.note !== undefined
          ? patch.note.trim() || undefined
          : current.note
      return {
        ...current,
        ...(patch.category !== undefined ? { category } : {}),
        ...(patch.variant !== undefined ? { variant: patch.variant } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(patch.usage !== undefined ? { usage: patch.usage } : {}),
        ...(patch.note !== undefined ? { note } : {}),
      }
    })
  }

  return (
    <div className="browser">
      <section className="browser-toolbar">
        <label className="field grow">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search brand icons by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value={CATEGORY_ALL}>All categories</option>
            <option value={CATEGORY_NONE}>No category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Variant</span>
          <select
            value={variantFilter}
            onChange={(e) => setVariantFilter(e.target.value)}
          >
            <option value={VARIANT_ALL}>All variants</option>
            <option value="regular">Regular</option>
            <option value="filled">Filled</option>
          </select>
        </label>
        <label className="field">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value={SOURCE_ALL}>All sources</option>
            <option value="custom">Custom</option>
            <option value="iconify">Iconify</option>
            <option value="modified">Modified</option>
          </select>
        </label>
        <label className="field">
          <span>Usage</span>
          <select
            value={usageFilter}
            onChange={(e) =>
              setUsageFilter(e.target.value === 'unused' ? 'unused' : 'in-use')
            }
          >
            <option value="in-use">In use</option>
            <option value="unused">Unused</option>
          </select>
        </label>
        <UploadPanel
          localUploadEnabled={localUploadEnabled}
          onUploaded={(id) => {
            const icon = getById(id)
            if (icon) setSelected(icon)
            setQuery(id.replace(/^(ci|img):/, ''))
          }}
        />
        <PublishButton />
        <div className="view-toggle" role="group" aria-label="Display mode">
          <button
            type="button"
            className={displayMode === 'grid' ? 'active' : undefined}
            onClick={() => setDisplayMode('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={displayMode === 'table' ? 'active' : undefined}
            onClick={() => setDisplayMode('table')}
          >
            Table
          </button>
        </div>
        <p className="result-count">{icons.length.toLocaleString()} icons</p>
      </section>

      <div className="browser-body">
        {displayMode === 'grid' ? (
          <IconGrid
            icons={icons}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        ) : (
          <IconTable
            icons={icons}
            selectedId={selected?.id}
            onSelect={setSelected}
            collapseCategory={categoryFilter !== CATEGORY_ALL}
          />
        )}
        {selected ? (
          <IconDetail
            icon={selected}
            reactCode={reactSnippet(selected.id, { format: selected.format })}
            vueCode={vueSnippet(selected.id, { format: selected.format })}
            onClose={() => setSelected(null)}
            onCategoryUpdated={(category) =>
              patchSelected(selected.name, { category })
            }
            onVariantUpdated={(variant: IconVariant) =>
              patchSelected(selected.name, { variant })
            }
            onSourceUpdated={(source: IconSource) =>
              patchSelected(selected.name, { source })
            }
            onUsageUpdated={(usage: IconUsage) =>
              patchSelected(selected.name, { usage })
            }
            onNoteUpdated={(note) => patchSelected(selected.name, { note })}
          />
        ) : (
          <aside className="detail empty-detail">
            <h2>Select an icon</h2>
            <p>
              Select an icon to preview brand icons and images, copy snippets,
              and review license details.
              {isGithubRepoConfigured()
                ? ' Use Upload for SVG / PNG / JPG. Maintainers Apply and Publish.'
                : ' Upload custom assets with Upload (local `pnpm dev`).'}
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
