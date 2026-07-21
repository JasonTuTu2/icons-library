import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import { BrowserStatusStrip } from '../components/BrowserStatusStrip'
import {
  isGithubRepoConfigured,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from '../lib/github'
import { useLiveCatalog } from '../lib/liveCatalog'
import { useIntroducedVersions } from '../lib/useIntroducedVersions'
import { CategoryFilterSelect } from '../components/CategorySelect'
import { DropdownCombobox } from '../components/DropdownCombobox'
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  sortIconsByCategoryThenName,
} from '../lib/categories'
import {
  BROWSE_ZOOM_DEFAULT,
  BROWSE_ZOOM_MAX,
  BROWSE_ZOOM_MIN,
  zoomIn,
  zoomOut,
} from '../lib/browseZoom'

const VARIANT_ALL = ''
const SOURCE_ALL = ''
const USAGE_ALL = ''

export function BrowserPage() {
  const { categories, search, getById, patchIcon } = useLiveCatalog()
  const introducedVersions = useIntroducedVersions()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_FILTER_ALL)
  const [variantFilter, setVariantFilter] = useState(VARIANT_ALL)
  const [sourceFilter, setSourceFilter] = useState(SOURCE_ALL)
  const [usageFilter, setUsageFilter] = useState(USAGE_ALL)
  const [selected, setSelected] = useState<IconMeta | null>(null)
  const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('grid')
  const [browseZoom, setBrowseZoom] = useState(BROWSE_ZOOM_DEFAULT)
  const [localUploadEnabled, setLocalUploadEnabled] = useState(false)
  const browsePaneRef = useRef<HTMLDivElement>(null)

  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    const pane = browsePaneRef.current
    if (!pane) return

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault()
      if (event.deltaY === 0) return
      setBrowseZoom((current) =>
        event.deltaY > 0 ? zoomOut(current) : zoomIn(current),
      )
    }

    pane.addEventListener('wheel', onWheel, { passive: false })
    return () => pane.removeEventListener('wheel', onWheel)
  }, [])

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
    if (categoryFilter === CATEGORY_FILTER_NONE) {
      options.category = ''
    } else if (categoryFilter !== CATEGORY_FILTER_ALL) {
      options.category = categoryFilter
    }
    if (
      variantFilter === 'regular' ||
      variantFilter === 'filled' ||
      variantFilter === 'none'
    ) {
      options.variant = variantFilter
    }
    if (
      sourceFilter === 'iconify' ||
      sourceFilter === 'custom' ||
      sourceFilter === 'modified'
    ) {
      options.source = sourceFilter
    }
    if (usageFilter === 'in-use' || usageFilter === 'unused') {
      options.usage = usageFilter
    }
    return sortIconsByCategoryThenName(search(options))
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

  const hasActiveFilters =
    query.trim() !== '' ||
    categoryFilter !== CATEGORY_FILTER_ALL ||
    variantFilter !== VARIANT_ALL ||
    sourceFilter !== SOURCE_ALL ||
    usageFilter !== USAGE_ALL

  function clearAllFilters() {
    setQuery('')
    setCategoryFilter(CATEGORY_FILTER_ALL)
    setVariantFilter(VARIANT_ALL)
    setSourceFilter(SOURCE_ALL)
    setUsageFilter(USAGE_ALL)
  }

  return (
    <div className="browser">
      <section className="browser-toolbar">
        <div className="browser-toolbar-filters">
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
        <label className="field category-filter-field">
          <span>Category</span>
          <CategoryFilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            categories={categories}
          />
        </label>
        <label className="field">
          <span>Variant</span>
          <DropdownCombobox
            value={variantFilter}
            onChange={setVariantFilter}
            ariaLabel="Variant filter"
            searchable
            placeholder="Variant…"
            options={[
              { value: VARIANT_ALL, label: 'All Variants' },
              { value: 'none', label: 'no variant' },
              { value: 'regular', label: 'regular' },
              { value: 'filled', label: 'filled' },
            ]}
            displayValue={(v) => {
              if (v === VARIANT_ALL) return 'All Variants'
              if (v === 'filled') return 'filled'
              if (v === 'regular') return 'regular'
              if (v === 'none') return 'no variant'
              return 'All Variants'
            }}
          />
        </label>
        <label className="field">
          <span>Source</span>
          <DropdownCombobox
            value={sourceFilter}
            onChange={setSourceFilter}
            ariaLabel="Source filter"
            searchable
            placeholder="Source…"
            options={[
              { value: SOURCE_ALL, label: 'All Sources' },
              { value: 'custom', label: 'Custom' },
              { value: 'iconify', label: 'Iconify' },
              { value: 'modified', label: 'Modified' },
            ]}
            displayValue={(v) => {
              if (v === SOURCE_ALL) return 'All Sources'
              if (v === 'iconify') return 'Iconify'
              if (v === 'modified') return 'Modified'
              return 'Custom'
            }}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <DropdownCombobox
            value={usageFilter}
            onChange={(next) => {
              if (next === 'unused' || next === 'in-use') {
                setUsageFilter(next)
                return
              }
              setUsageFilter(USAGE_ALL)
            }}
            ariaLabel="Status filter"
            searchable
            placeholder="Status…"
            options={[
              { value: USAGE_ALL, label: 'All' },
              { value: 'in-use', label: 'In Use' },
              { value: 'unused', label: 'Unused' },
            ]}
            displayValue={(v) => {
              if (v === 'unused') return 'Unused'
              if (v === 'in-use') return 'In Use'
              return 'All'
            }}
          />
        </label>
        <button
          type="button"
          className="ghost clear-filters-btn"
          disabled={!hasActiveFilters}
          onClick={clearAllFilters}
        >
          Clear Filters
        </button>
        </div>
        <div className="browser-toolbar-actions">
        <UploadPanel
          localUploadEnabled={localUploadEnabled}
          onUploaded={(id) => {
            const icon = getById(id)
            if (icon) setSelected(icon)
            setQuery(id.replace(/^(ci|img):/, ''))
          }}
        />
        <PublishButton />
        <div className="browser-display-controls">
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
          <div className="zoom-controls" role="group" aria-label="Zoom">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={browseZoom <= BROWSE_ZOOM_MIN}
              onClick={() => setBrowseZoom((z) => zoomOut(z))}
            >
              −
            </button>
            <span className="zoom-label" aria-live="polite">
              {Math.round(browseZoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={browseZoom >= BROWSE_ZOOM_MAX}
              onClick={() => setBrowseZoom((z) => zoomIn(z))}
            >
              +
            </button>
          </div>
        </div>
        <p className="result-count">{icons.length.toLocaleString()} icons</p>
        </div>
      </section>
      <BrowserStatusStrip />

      <div className="browser-body">
        <div
          ref={browsePaneRef}
          className="browser-pane"
          style={{ '--browse-zoom': browseZoom } as CSSProperties}
        >
          {displayMode === 'grid' ? (
            <IconGrid
              icons={icons}
              selectedId={selected?.id}
              onSelect={setSelected}
              zoom={browseZoom}
            />
          ) : (
            <IconTable
              icons={icons}
              selectedId={selected?.id}
              onSelect={setSelected}
              zoom={browseZoom}
            />
          )}
        </div>
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
            introducedPackageVersion={introducedVersions.packageVersionForIcon(
              selected.name,
            )}
            introducedVersionLoading={introducedVersions.loading}
            introducedVersionPending={introducedVersions.isPendingPublish(
              selected.name,
            )}
          />
        ) : (
          <aside className="detail empty-detail">
            <h2>Select an icon</h2>
            <p>
              Select an icon to preview brand icons and images, download
              source files, copy snippets,
              and review license details.
              {isGithubRepoConfigured()
                ? ' Use Upload for SVG / PNG / JPG. Sign in to Apply; devs can Publish.'
                : ' Upload custom assets with Upload (local `pnpm dev`).'}
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
