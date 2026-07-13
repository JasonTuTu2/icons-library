import type { CSSProperties, ComponentType } from 'react'
import type { BaseIconProps } from '@genvoice/icons-core'

export interface IconProps extends Omit<BaseIconProps, 'style'> {
  className?: string
  style?: CSSProperties
}

export type AntIconComponent = ComponentType<{
  style?: CSSProperties
  className?: string
  spin?: boolean
  rotate?: number
  twoToneColor?: string
  'aria-label'?: string
  'aria-hidden'?: boolean | 'true'
  role?: string
}>
