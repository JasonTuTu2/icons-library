import type { IconVariant } from '@JasonTuTu2/github-admin'

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
  className = 'variant-select',
}: VariantSelectProps) {
  return (
    <select
      className={className}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) =>
        onChange(e.target.value === 'filled' ? 'filled' : 'regular')
      }
    >
      <option value="regular">Regular</option>
      <option value="filled">Filled</option>
    </select>
  )
}

interface ApplyAllVariantProps {
  onApplyAll: (variant: IconVariant) => void
}

export function ApplyAllVariant({ onApplyAll }: ApplyAllVariantProps) {
  return (
    <div className="apply-all-variant">
      <span className="apply-all-label">Apply variant to all</span>
      <VariantSelect
        value="regular"
        onChange={onApplyAll}
        ariaLabel="Apply variant to all pending assets"
      />
    </div>
  )
}

export function variantLabel(variant: IconVariant | undefined): string {
  return variant === 'filled' ? 'Filled' : 'Regular'
}
