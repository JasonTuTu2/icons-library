export type {
  BaseIconProps,
  IconA11yAttributes,
  IconA11yInput,
  IconProvider,
  IconSize,
  ParsedIconName,
} from './types.js'
export {
  ANT_PREFIX,
  CUSTOM_PREFIX,
  DEFAULT_ICON_COLOR,
  DEFAULT_ICON_SIZE,
} from './types.js'
export { parseName, isAntName, isCustomName } from './parseName.js'
export { getA11yAttributes, warnMissingA11y } from './a11y.js'
export { normalizeSize, buildIconStyle } from './size.js'
export type { CSSProperties } from './css.js'
export { isDev } from './env.js'
