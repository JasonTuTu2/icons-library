import type { CSSProperties, Component } from 'vue'
import type { BaseIconProps } from '@genvoice/icons-core'

export interface IconProps extends Omit<BaseIconProps, 'style'> {
  class?: string
  style?: CSSProperties
}

export type AntIconComponent = Component
