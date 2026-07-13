import { ANT_PREFIX, type ParsedIconName } from './types.js'

/**
 * Parse a canonical icon name.
 * - Ant Design: `ant:HomeOutlined`
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
      `Invalid icon name "${name}". Use "ant:HomeOutlined" or an Iconify id like "mdi:home".`,
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
