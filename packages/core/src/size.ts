import type { CSSProperties } from './css.js'
import { DEFAULT_ICON_COLOR, DEFAULT_ICON_SIZE, type IconSize } from './types.js'

export function normalizeSize(size: IconSize = DEFAULT_ICON_SIZE): string {
  if (typeof size === 'number') {
    return `${size}px`
  }
  return size
}

export function buildIconStyle(options: {
  size?: IconSize
  color?: string
  style?: CSSProperties
  rotate?: number
}): CSSProperties {
  const {
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR,
    style,
    rotate,
  } = options

  const base: CSSProperties = {
    width: normalizeSize(size),
    height: normalizeSize(size),
    color,
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0,
  }

  if (rotate != null && rotate !== 0) {
    base.transform = `rotate(${rotate}deg)`
  }

  return { ...base, ...style }
}
