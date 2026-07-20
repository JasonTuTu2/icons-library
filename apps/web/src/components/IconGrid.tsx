import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { IconPreview } from './IconPreview'

const COLS = 8
const BASE_ROW_HEIGHT = 96
const BASE_ICON_SIZE = 28

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
  const rowCount = Math.ceil(icons.length / COLS) || 0
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
  }, [zoom, virtualizer])

  return (
    <div className="grid-wrap" ref={parentRef}>
      <div
        className="grid-inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * COLS
          const slice = icons.slice(start, start + COLS)
          return (
            <div
              key={row.key}
              className="grid-row"
              style={{
                transform: `translateY(${row.start}px)`,
                height: `${row.size}px`,
              }}
            >
              {slice.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  className={
                    icon.id === selectedId ? 'icon-cell selected' : 'icon-cell'
                  }
                  onClick={() => onSelect(icon)}
                  title={icon.id}
                >
                  <IconPreview icon={icon} size={iconSize} />
                  <span>{icon.name}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
