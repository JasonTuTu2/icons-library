import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  getIconById,
  getSets,
  reactSnippet,
  searchIcons,
  vueSnippet,
  type IconMeta,
} from '@genvoice/icons-catalog'
import { IconGrid } from '../components/IconGrid'
import { IconDetail } from '../components/IconDetail'
import { UploadPanel } from '../components/UploadPanel'

export function BrowserPage() {
  const sets = useMemo(() => getSets(), [])
  const [query, setQuery] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<
    '' | 'ant' | 'iconify' | 'custom'
  >('')
  const [colorModeFilter, setColorModeFilter] = useState<
    '' | 'mono' | 'preserved'
  >('')
  const [selected, setSelected] = useState<IconMeta | null>(null)
  const [uploadEnabled, setUploadEnabled] = useState(false)

  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let cancelled = false
    fetch('/__gv/icons/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { uploadEnabled?: boolean } | null) => {
        if (!cancelled) setUploadEnabled(Boolean(data?.uploadEnabled))
      })
      .catch(() => {
        if (!cancelled) setUploadEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const icons = useMemo(
    () =>
      searchIcons({
        query: deferredQuery,
        set: setFilter || undefined,
        source: sourceFilter || undefined,
        colorMode: colorModeFilter || undefined,
      }),
    [deferredQuery, setFilter, sourceFilter, colorModeFilter],
  )

  return (
    <div className="browser">
      <section className="browser-toolbar">
        <label className="field grow">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search icons by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Set</span>
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
          >
            <option value="">All sets</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(
                e.target.value as '' | 'ant' | 'iconify' | 'custom',
              )
            }
          >
            <option value="">All sources</option>
            <option value="ant">Ant Design</option>
            <option value="iconify">Iconify</option>
            <option value="custom">Custom (GenVoice)</option>
          </select>
        </label>
        <label className="field">
          <span>Color mode</span>
          <select
            value={colorModeFilter}
            onChange={(e) =>
              setColorModeFilter(e.target.value as '' | 'mono' | 'preserved')
            }
          >
            <option value="">All modes</option>
            <option value="mono">Monochrome</option>
            <option value="preserved">Multi-color</option>
          </select>
        </label>
        <UploadPanel
          uploadEnabled={uploadEnabled}
          onUploaded={(id) => {
            const icon = getIconById(id)
            if (icon) setSelected(icon)
            setSourceFilter('custom')
            setQuery(id.replace(/^gv:/, ''))
          }}
        />
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
            reactCode={reactSnippet(selected.id)}
            vueCode={vueSnippet(selected.id)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <aside className="detail empty-detail">
            <h2>Select an icon</h2>
            <p>
              Browse the grid to preview icons, copy React or Vue snippets, and
              review license details. Upload custom Figma SVGs with the Upload
              button (local dev).
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
