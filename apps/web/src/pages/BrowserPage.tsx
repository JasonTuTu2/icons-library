import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  getIconById,
  getSets,
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

export function BrowserPage() {
  const sets = useMemo(() => getSets(), [])
  const [query, setQuery] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<
    '' | 'iconify' | 'custom'
  >('')
  const [colorModeFilter, setColorModeFilter] = useState<
    '' | 'mono' | 'preserved' | 'gradient'
  >('')
  const [assetKindFilter, setAssetKindFilter] = useState<
    '' | 'icon' | 'image'
  >('')
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

  const icons = useMemo(
    () =>
      searchIcons({
        query: deferredQuery,
        set: setFilter || undefined,
        source: sourceFilter || undefined,
        colorMode: colorModeFilter || undefined,
        assetKind: assetKindFilter || undefined,
      }),
    [deferredQuery, setFilter, sourceFilter, colorModeFilter, assetKindFilter],
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
                e.target.value as '' | 'iconify' | 'custom',
              )
            }
          >
            <option value="">All sources</option>
            <option value="iconify">Iconify</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Color mode</span>
          <select
            value={colorModeFilter}
            onChange={(e) =>
              setColorModeFilter(
                e.target.value as '' | 'mono' | 'preserved' | 'gradient',
              )
            }
          >
            <option value="">All modes</option>
            <option value="mono">Monochrome</option>
            <option value="preserved">Multi-color</option>
            <option value="gradient">Gradient</option>
          </select>
        </label>
        <label className="field">
          <span>Asset</span>
          <select
            value={assetKindFilter}
            onChange={(e) =>
              setAssetKindFilter(e.target.value as '' | 'icon' | 'image')
            }
          >
            <option value="">Icons + images</option>
            <option value="icon">Vector icons</option>
            <option value="image">Brand images</option>
          </select>
        </label>
        <UploadPanel
          localUploadEnabled={localUploadEnabled}
          onUploaded={(id) => {
            const icon = getIconById(id)
            if (icon) setSelected(icon)
            setSourceFilter('custom')
            setQuery(id.replace(/^(gv|img):/, ''))
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
            onRemovalStaged={() => setSourceFilter('custom')}
          />
        ) : (
          <aside className="detail empty-detail">
            <h2>Select an icon</h2>
            <p>
              Browse the grid to preview icons and brand images, copy snippets,
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
