import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { IconMeta } from '@JasonTuTu2/icons-catalog'
import { IconPreview } from './IconPreview'
import { variantLabel } from './VariantSelect'

const BASE_ROW_HEIGHT = 56
const BASE_HEADER_HEIGHT = 44
const BASE_ICON_SIZE = 24

interface IconTableProps {
  icons: IconMeta[]
  selectedId?: string
  onSelect: (icon: IconMeta) => void
  zoom?: number
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

function categoryKey(category: string | undefined): string {
  return (category ?? '').trim()
}

export function IconTable({
  icons,
  selectedId,
  onSelect,
  zoom = 1,
}: IconTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowHeight = BASE_ROW_HEIGHT * zoom
  const headerHeight = BASE_HEADER_HEIGHT * zoom
  const iconSize = Math.max(14, Math.round(BASE_ICON_SIZE * zoom))

  const virtualizer = useVirtualizer({
    count: icons.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })

  useEffect(() => {
    virtualizer.measure()
  }, [zoom, virtualizer])

  return (
    <div className="table-wrap" ref={parentRef}>
      <div className="icon-table">
        <div
          className="icon-table-header"
          style={{ height: headerHeight }}
        >
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
            const prev = row.index > 0 ? icons[row.index - 1] : undefined
            const showCategory =
              !prev ||
              categoryKey(prev.category) !== categoryKey(icon.category)
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
                  {showCategory ? cell(icon.category) : ''}
                </div>
                <div className="icon-table-cell icon-preview">
                  <IconPreview icon={icon} size={iconSize} />
                </div>
                <div className="icon-table-cell">{icon.name}</div>
                <div className="icon-table-cell">
                  {variantLabel(icon.variant)}
                </div>
                <div className="icon-table-cell">
                  {formatSource(icon.source)}
                </div>
                <div className="icon-table-cell">
                  {formatUsage(icon.usage)}
                </div>
                <div className="icon-table-cell note">
                  {icon.note?.trim() ?? ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
