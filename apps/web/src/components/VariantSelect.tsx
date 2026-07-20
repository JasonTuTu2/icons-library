import type { IconVariant } from '@JasonTuTu2/github-admin'
import { DropdownCombobox } from './DropdownCombobox'

const OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'filled', label: 'Filled' },
]

interface VariantSelectProps {
  value: IconVariant
  onChange: (variant: IconVariant) => void
  ariaLabel?: string
  className?: string
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
      onChange={(next) =>
        onChange(next === 'filled' ? 'filled' : 'regular')
      }
      options={OPTIONS}
      ariaLabel={ariaLabel}
      className={`variant-dropdown${className ? ` ${className}` : ''}`}
      searchable
      placeholder="Variant…"
    />
  )
}

export function variantLabel(variant: IconVariant | undefined): string {
  return variant === 'filled' ? 'Filled' : 'Regular'
}
