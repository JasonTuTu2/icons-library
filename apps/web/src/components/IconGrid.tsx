import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { IconPreview } from './IconPreview'

const COLS_WIDE = 8
const COLS_NARROW = 4
/** Keep in sync with `@media (max-width: 960px)` in styles.css */
const NARROW_MQ = '(max-width: 960px)'
const BASE_ROW_HEIGHT = 112
const BASE_ICON_SIZE = 28

function useGridCols(): number {
  const [cols, setCols] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(NARROW_MQ).matches
      ? COLS_NARROW
      : COLS_WIDE,
  )

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ)
    const sync = () => setCols(mq.matches ? COLS_NARROW : COLS_WIDE)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return cols
}

interface IconGridProps {
  icons: IconMeta[]
  selectedId?: string
  onSelect: (icon: IconMeta) => void
  zoom?: number
}

export function IconGrid({
  icons,
  selectedId,
  onSelect,
  zoom = 1,
}: IconGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const cols = useGridCols()
  const rowCount = Math.ceil(icons.length / cols) || 0
  const rowHeight = BASE_ROW_HEIGHT * zoom
  const iconSize = Math.max(16, Math.round(BASE_ICON_SIZE * zoom))

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  })

  useEffect(() => {
    virtualizer.measure()
  }, [zoom, cols, rowCount, virtualizer])

  return (
    <div className="grid-wrap" ref={parentRef}>
      <div
        className="grid-inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * cols
          const slice = icons.slice(start, start + cols)
          return (
            <div
              key={`${cols}-${row.key}`}
              className="grid-row"
              style={{
                transform: `translateY(${row.start}px)`,
                height: `${row.size}px`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {slice.map((icon, col) => {
                const index = start + col
                const prev = index > 0 ? icons[index - 1] : undefined
                const cat = (icon.category ?? '').trim()
                const prevCat = (prev?.category ?? '').trim()
                const showCategory = !prev || prevCat !== cat
                return (
                  <button
                    key={icon.id}
                    type="button"
                    className={
                      icon.id === selectedId
                        ? 'icon-cell selected'
                        : 'icon-cell'
                    }
                    onClick={() => onSelect(icon)}
                    title={icon.id}
                  >
                    {showCategory ? (
                      <span className="icon-cell-category">
                        {cat || 'No Category'}
                      </span>
                    ) : (
                      <span className="icon-cell-category is-spacer" aria-hidden>
                        {'\u00a0'}
                      </span>
                    )}
                    <IconPreview icon={icon} size={iconSize} />
                    <span>{icon.name}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
