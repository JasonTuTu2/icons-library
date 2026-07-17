export type IconProvider = 'iconify' | 'custom'

export interface ParsedIconName {
  provider: IconProvider
  /** Iconify/custom: full id like mdi:home or ci:star */
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
  rotate?: number
}

export const DEFAULT_ICON_SIZE: IconSize = '1em'
export const DEFAULT_ICON_COLOR = 'currentColor'

export const CUSTOM_PREFIX = 'ci'
