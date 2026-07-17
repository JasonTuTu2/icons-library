import type { CSSProperties } from 'react'
import type { BaseIconProps } from '@JasonTuTu2/icons-core'

export interface IconProps extends Omit<BaseIconProps, 'style'> {
  className?: string
  style?: CSSProperties
}
