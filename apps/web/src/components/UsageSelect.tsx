import type { IconUsage } from '@JasonTuTu2/github-admin'
import { DropdownCombobox } from './DropdownCombobox'

const OPTIONS = [
  { value: 'in-use', label: 'In use' },
  { value: 'unused', label: 'Unused' },
]

interface UsageSelectProps {
  value: IconUsage
  onChange: (usage: IconUsage) => void
  ariaLabel?: string
  className?: string
}

export function UsageSelect({
  value,
  onChange,
  ariaLabel = 'Usage',
  className = '',
}: UsageSelectProps) {
  return (
    <DropdownCombobox
      value={value}
      onChange={(next) =>
        onChange(next === 'unused' ? 'unused' : 'in-use')
      }
      options={OPTIONS}
      ariaLabel={ariaLabel}
      className={`usage-dropdown${className ? ` ${className}` : ''}`}
      searchable={false}
      placeholder="Usage…"
    />
  )
}

export function usageLabel(usage: IconUsage | undefined): string {
  return usage === 'unused' ? 'Unused' : 'In use'
}
