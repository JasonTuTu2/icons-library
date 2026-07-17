import {
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactElement,
} from 'react'
import * as IconifyReact from '@iconify/react'
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/react'
import {
  buildIconStyle,
  getA11yAttributes,
  isDev,
  parseName,
  warnMissingA11y,
} from '@JasonTuTu2/icons-core'
import { iconifyIconExists } from './iconifyCompat.js'
import type { IconProps } from './types.js'

registerCustomIcons()

const { Icon: IconifyIcon } = IconifyReact

function MissingIcon({ name, style, className }: {
  name: string
  style?: CSSProperties
  className?: string
}): ReactElement {
  if (isDev()) {
    console.warn(`[Icons] Icon not found: "${name}"`)
  }
  return (
    <span
      className={className}
      style={{
        ...style,
        display: 'inline-block',
        background: 'transparent',
      }}
      data-icon-missing={name}
      aria-hidden
    />
  )
}

export function Icon({
  name,
  size,
  color,
  label,
  decorative,
  className,
  style,
  rotate,
}: IconProps): ReactElement {
  const parsed = useMemo(() => {
    try {
      return parseName(name)
    } catch (err) {
      if (isDev()) {
        console.warn(err)
      }
      return null
    }
  }, [name])

  useEffect(() => {
    warnMissingA11y(name, { label, decorative })
  }, [name, label, decorative])

  const a11y = getA11yAttributes({ label, decorative })
  const mergedStyle = buildIconStyle({ size, color, style: style as Record<string, string | number | undefined>, rotate }) as CSSProperties

  if (!parsed) {
    return <MissingIcon name={name} style={mergedStyle} className={className} />
  }

  if (parsed.provider === 'custom' && !iconifyIconExists(IconifyReact, parsed.id)) {
    if (isDev()) {
      console.warn(
        `[Icons] Custom icon "${name}" was not found in the custom icons package. ` +
          'Publish/upgrade the package after adding the SVG, or check the kebab name.',
      )
    }
    return <MissingIcon name={name} style={mergedStyle} className={className} />
  }

  return (
    <IconifyIcon
      icon={parsed.id}
      className={className}
      style={mergedStyle}
      {...a11y}
    />
  )
}
