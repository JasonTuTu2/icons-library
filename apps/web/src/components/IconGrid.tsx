import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { IconMeta } from '@genvoice/icons-catalog'
import { Icon } from '@genvoice/icons-react'

const COLS = 8
const ROW_HEIGHT = 96

interface IconGridProps {
  icons: IconMeta[]
  selectedId?: string
  onSelect: (icon: IconMeta) => void
}

export function IconGrid({ icons, selectedId, onSelect }: IconGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowCount = Math.ceil(icons.length / COLS) || 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  })

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
                  <Icon name={icon.id} size={28} decorative />
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
