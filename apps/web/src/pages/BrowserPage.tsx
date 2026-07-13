import { useDeferredValue, useMemo, useState } from 'react'
import {
  getSets,
  reactSnippet,
  searchIcons,
  vueSnippet,
  type IconMeta,
} from '@genvoice/icons-catalog'
import { IconGrid } from '../components/IconGrid'
import { IconDetail } from '../components/IconDetail'

export function BrowserPage() {
  const sets = useMemo(() => getSets(), [])
  const [query, setQuery] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'' | 'ant' | 'iconify'>('')
  const [selected, setSelected] = useState<IconMeta | null>(null)

  const deferredQuery = useDeferredValue(query)

  const icons = useMemo(
    () =>
      searchIcons({
        query: deferredQuery,
        set: setFilter || undefined,
        source: sourceFilter || undefined,
      }),
    [deferredQuery, setFilter, sourceFilter],
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
              setSourceFilter(e.target.value as '' | 'ant' | 'iconify')
            }
          >
            <option value="">All sources</option>
            <option value="ant">Ant Design</option>
            <option value="iconify">Iconify</option>
          </select>
        </label>
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
              review license details.
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
