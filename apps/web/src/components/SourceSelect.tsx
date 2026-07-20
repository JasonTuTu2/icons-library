import type { IconSource } from '@JasonTuTu2/github-admin'
import { DropdownCombobox } from './DropdownCombobox'

const OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'iconify', label: 'Iconify' },
  { value: 'modified', label: 'Modified' },
]

interface SourceSelectProps {
  value: IconSource
  onChange: (source: IconSource) => void
  ariaLabel?: string
  className?: string
}

export function SourceSelect({
  value,
  onChange,
  ariaLabel = 'Source',
  className = '',
}: SourceSelectProps) {
  return (
    <DropdownCombobox
      value={value}
      onChange={(next) =>
        onChange(
          next === 'iconify' || next === 'modified' ? next : 'custom',
        )
      }
      options={OPTIONS}
      ariaLabel={ariaLabel}
      className={`source-dropdown${className ? ` ${className}` : ''}`}
      searchable={false}
      placeholder="Source…"
    />
  )
}

export function sourceLabel(source: IconSource | undefined): string {
  if (source === 'iconify') return 'Iconify'
  if (source === 'modified') return 'Modified'
  return 'Custom'
}
