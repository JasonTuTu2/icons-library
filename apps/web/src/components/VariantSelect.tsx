import type { IconVariant } from '@JasonTuTu2/github-admin'
import { DropdownCombobox } from './DropdownCombobox'

const OPTIONS = [
  { value: 'none', label: 'No variant' },
  { value: 'regular', label: 'Regular' },
  { value: 'filled', label: 'Filled' },
]

interface VariantSelectProps {
  value: IconVariant
  onChange: (variant: IconVariant) => void
  ariaLabel?: string
  className?: string
}

function asVariant(raw: string): IconVariant {
  if (raw === 'filled') return 'filled'
  if (raw === 'regular') return 'regular'
  return 'none'
}

export function VariantSelect({
  value,
  onChange,
  ariaLabel = 'Variant',
  className = '',
}: VariantSelectProps) {
  return (
    <DropdownCombobox
      value={value}
      onChange={(next) => onChange(asVariant(next))}
      options={OPTIONS}
      ariaLabel={ariaLabel}
      className={`variant-dropdown${className ? ` ${className}` : ''}`}
      searchable
      placeholder="Variant…"
      displayValue={(v) => {
        if (v === 'filled') return 'Filled'
        if (v === 'regular') return 'Regular'
        return 'No variant'
      }}
    />
  )
}

export function variantLabel(variant: IconVariant | undefined): string {
  if (variant === 'filled') return 'Filled'
  if (variant === 'regular') return 'Regular'
  return 'No variant'
}
