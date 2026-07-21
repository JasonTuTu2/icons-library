import { Icon } from '@JasonTuTu2/icons-react'

/** Small decorative brand icon for browser chrome (buttons, search, etc.). */
export function ChromeIcon({
  name,
  size = 16,
}: {
  name: string
  size?: number
}) {
  return (
    <span className="chrome-icon" aria-hidden>
      <Icon name={name} size={size} color="currentColor" decorative />
    </span>
  )
}
