export type IconProvider = 'ant' | 'iconify'

export interface ParsedIconName {
  provider: IconProvider
  /** Ant: PascalCase export name. Iconify: full id like mdi:home */
  id: string
  /** Canonical name as provided, normalized */
  canonical: string
}

export type IconSize = number | string

export interface IconA11yInput {
  label?: string
  decorative?: boolean
}

export interface IconA11yAttributes {
  role?: 'img'
  'aria-label'?: string
  'aria-hidden'?: boolean | 'true'
}

export interface BaseIconProps {
  name: string
  size?: IconSize
  color?: string
  label?: string
  decorative?: boolean
  style?: Record<string, string | number | undefined>
  spin?: boolean
  rotate?: number
}

export const DEFAULT_ICON_SIZE: IconSize = '1em'
export const DEFAULT_ICON_COLOR = 'currentColor'

export const ANT_PREFIX = 'ant'
