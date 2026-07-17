import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  getCustomCategories,
  getIconById,
  reactSnippet,
  searchIcons,
  vueSnippet,
  type IconMeta,
} from '@JasonTuTu2/icons-catalog'
import { IconGrid } from '../components/IconGrid'
import { IconDetail } from '../components/IconDetail'
import { UploadPanel } from '../components/UploadPanel'
import { PublishButton } from '../components/PublishButton'
import { isGithubRepoConfigured } from '../lib/github'

/** Toolbar sentinel: show all categories. */
const CATEGORY_ALL = ''
/** Toolbar sentinel: icons with no category assigned. */
const CATEGORY_NONE = '__none__'

export function BrowserPage() {
  const categories = useMemo(() => getCustomCategories(), [])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL)
  const [selected, setSelected] = useState<IconMeta | null>(null)
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
    const options: Parameters<typeof searchIcons>[0] = {
      query: deferredQuery,
    }
    if (categoryFilter === CATEGORY_NONE) {
      options.category = ''
    } else if (categoryFilter !== CATEGORY_ALL) {
      options.category = categoryFilter
    }
    return searchIcons(options)
  }, [deferredQuery, categoryFilter])

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
        <UploadPanel
          localUploadEnabled={localUploadEnabled}
          onUploaded={(id) => {
            const icon = getIconById(id)
            if (icon) setSelected(icon)
            setQuery(id.replace(/^(ci|img):/, ''))
          }}
        />
        <PublishButton />
        <p className="result-count">{icons.length.toLocaleString()} icons</p>
      </section>

      <div className="browser-body">
        <IconGrid
          icons={icons}
          selectedId={selected?.id}
          onSelect={setSelected}
        />
        {selected ? (
          <IconDetail
            icon={selected}
            reactCode={reactSnippet(selected.id, { format: selected.format })}
            vueCode={vueSnippet(selected.id, { format: selected.format })}
            onClose={() => setSelected(null)}
            onCategoryUpdated={(category) =>
              setSelected((current) =>
                current
                  ? { ...current, category: category || undefined }
                  : current,
              )
            }
          />
        ) : (
          <aside className="detail empty-detail">
            <h2>Select an icon</h2>
            <p>
              Browse the grid to preview brand icons and images, copy snippets,
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
