import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { Icon as IconifyIcon, iconExists } from '@iconify/react'
import {
  buildIconStyle,
  getA11yAttributes,
  isDev,
  parseName,
  warnMissingA11y,
} from '@genvoice/icons-core'
import { getAntIconSync, resolveAntIcon } from './antRegistry.js'
import type { AntIconComponent, IconProps } from './types.js'

function MissingIcon({ name, style, className }: {
  name: string
  style?: CSSProperties
  className?: string
}): ReactElement {
  if (isDev()) {
    console.warn(`[GenVoice Icons] Icon not found: "${name}"`)
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
  spin,
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

  const [AntComp, setAntComp] = useState<AntIconComponent | null>(() =>
    parsed?.provider === 'ant' ? getAntIconSync(parsed.id) : null,
  )
  const [antTried, setAntTried] = useState(
    () => parsed?.provider !== 'ant' || getAntIconSync(parsed.id) != null,
  )

  useEffect(() => {
    if (!parsed || parsed.provider !== 'ant') {
      setAntComp(null)
      setAntTried(true)
      return
    }

    const sync = getAntIconSync(parsed.id)
    if (sync) {
      setAntComp(sync)
      setAntTried(true)
      return
    }

    let cancelled = false
    setAntTried(false)
    resolveAntIcon(parsed.id).then((comp) => {
      if (!cancelled) {
        setAntComp(comp)
        setAntTried(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [parsed])

  if (!parsed) {
    return <MissingIcon name={name} style={mergedStyle} className={className} />
  }

  if (parsed.provider === 'ant') {
    if (!antTried) {
      return (
        <span
          className={className}
          style={mergedStyle}
          aria-hidden
          data-icon-loading={name}
        />
      )
    }
    if (!AntComp) {
      return <MissingIcon name={name} style={mergedStyle} className={className} />
    }
    return (
      <AntComp
        className={className}
        style={mergedStyle}
        spin={spin}
        rotate={rotate}
        {...a11y}
      />
    )
  }

  if (parsed.provider === 'custom' && !iconExists(parsed.id)) {
    if (isDev()) {
      console.warn(
        `[GenVoice Icons] Custom icon "${name}" is not registered. ` +
          'Call registerCustomIcons() from @genvoice/icons-custom/react at app bootstrap.',
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
