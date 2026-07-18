import type { IconUsage } from '@JasonTuTu2/github-admin'

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
  className = 'usage-select',
}: UsageSelectProps) {
  return (
    <select
      className={className}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) =>
        onChange(e.target.value === 'unused' ? 'unused' : 'in-use')
      }
    >
      <option value="in-use">In use</option>
      <option value="unused">Unused</option>
    </select>
  )
}

export function usageLabel(usage: IconUsage | undefined): string {
  return usage === 'unused' ? 'Unused' : 'In use'
}
