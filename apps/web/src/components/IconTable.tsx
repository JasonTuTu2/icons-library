import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { IconPreview } from './IconPreview'

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 44

interface IconTableProps {
  icons: IconMeta[]
  selectedId?: string
  onSelect: (icon: IconMeta) => void
}

function formatSource(source: IconMeta['source']): string {
  if (source === 'iconify') return 'Iconify'
  if (source === 'modified') return 'Modified'
  return 'Custom'
}

function formatUsage(usage: IconMeta['usage']): string {
  return usage === 'unused' ? 'Unused' : 'In Use'
}

function cell(value: string | undefined): string {
  return value?.trim() ? value : '—'
}

export function IconTable({ icons, selectedId, onSelect }: IconTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: icons.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  return (
    <div className="table-wrap" ref={parentRef}>
      <div className="icon-table">
        <div className="icon-table-header" style={{ height: HEADER_HEIGHT }}>
          <div className="icon-table-cell category">Category</div>
          <div className="icon-table-cell">Icon</div>
          <div className="icon-table-cell">Internal Name</div>
          <div className="icon-table-cell">Variant</div>
          <div className="icon-table-cell">Source</div>
          <div className="icon-table-cell">Usage</div>
          <div className="icon-table-cell note">Note</div>
        </div>
        <div
          className="icon-table-body"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const icon = icons[row.index]!
            const selected = icon.id === selectedId
            return (
              <button
                key={row.key}
                type="button"
                className={
                  selected
                    ? 'icon-table-row selected'
                    : 'icon-table-row'
                }
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: `${row.size}px`,
                }}
                onClick={() => onSelect(icon)}
                title={icon.id}
              >
                <div className="icon-table-cell category">
                  {cell(icon.category)}
                </div>
                <div className="icon-table-cell icon-preview">
                  <IconPreview icon={icon} size={24} />
                </div>
                <div className="icon-table-cell">{icon.name}</div>
                <div className="icon-table-cell">{cell(icon.variant)}</div>
                <div className="icon-table-cell">
                  {formatSource(icon.source)}
                </div>
                <div className="icon-table-cell">
                  {formatUsage(icon.usage)}
                </div>
                <div className="icon-table-cell note">{cell(icon.note)}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
