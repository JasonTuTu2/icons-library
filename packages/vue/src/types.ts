import type { CSSProperties, Component } from 'vue'
import type { BaseIconProps } from '@JasonTuTu2/icons-core'

export interface IconProps extends Omit<BaseIconProps, 'style'> {
  class?: string
  style?: CSSProperties
}

export type AntIconComponent = Component
