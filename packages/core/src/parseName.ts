import { ANT_PREFIX, CUSTOM_PREFIX, type ParsedIconName } from './types.js'

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * Parse a canonical icon name.
 * - Ant Design: `ant:HomeOutlined`
 * - GenVoice custom: `gv:billing-alert`
 * - Iconify: `mdi:home`, `lucide:settings`, etc.
 */
export function parseName(name: string): ParsedIconName {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Icon name must be a non-empty string')
  }

  const colon = trimmed.indexOf(':')
  if (colon <= 0 || colon === trimmed.length - 1) {
    throw new Error(
      `Invalid icon name "${name}". Use "ant:HomeOutlined", "gv:icon-name", or an Iconify id like "mdi:home".`,
    )
  }

  const prefix = trimmed.slice(0, colon)
  const id = trimmed.slice(colon + 1)

  if (prefix === ANT_PREFIX) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(id)) {
      throw new Error(
        `Invalid Ant Design icon "${name}". Expected PascalCase export, e.g. "ant:HomeOutlined".`,
      )
    }
    return {
      provider: 'ant',
      id,
      canonical: `${ANT_PREFIX}:${id}`,
    }
  }

  if (prefix === CUSTOM_PREFIX) {
    if (!KEBAB.test(id)) {
      throw new Error(
        `Invalid custom icon "${name}". Expected kebab-case, e.g. "gv:billing-alert".`,
      )
    }
    return {
      provider: 'custom',
      id: `${CUSTOM_PREFIX}:${id}`,
      canonical: `${CUSTOM_PREFIX}:${id}`,
    }
  }

  // Iconify ids are prefix:name (prefix usually lowercase)
  return {
    provider: 'iconify',
    id: trimmed,
    canonical: trimmed,
  }
}

export function isAntName(name: string): boolean {
  try {
    return parseName(name).provider === 'ant'
  } catch {
    return false
  }
}

export function isCustomName(name: string): boolean {
  try {
    return parseName(name).provider === 'custom'
  } catch {
    return false
  }
}
