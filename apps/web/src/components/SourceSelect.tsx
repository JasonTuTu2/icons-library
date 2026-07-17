import type { IconSource } from '@JasonTuTu2/github-admin'

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
  className = 'source-select',
}: SourceSelectProps) {
  return (
    <select
      className={className}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const next = e.target.value
        onChange(
          next === 'iconify' || next === 'modified' ? next : 'custom',
        )
      }}
    >
      <option value="custom">Custom</option>
      <option value="iconify">Iconify</option>
      <option value="modified">Modified</option>
    </select>
  )
}

export function sourceLabel(source: IconSource | undefined): string {
  if (source === 'iconify') return 'Iconify'
  if (source === 'modified') return 'Modified'
  return 'Custom'
}
