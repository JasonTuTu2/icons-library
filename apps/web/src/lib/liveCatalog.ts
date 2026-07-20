import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  filterIcons,
  getAllIcons,
  getCustomCategories,
  type IconMeta,
  type SearchOptions,
} from '@JasonTuTu2/icons-catalog'
import {
  getCustomMetadata,
  isGithubAdminEnabled,
  isGithubRepoConfigured,
  type CustomIconEntryMeta,
  type CustomIconMetadata,
  type IconSource,
  type IconUsage,
  type IconVariant,
} from './github'

export type LivePropertyPatch = {
  category?: string
  variant?: IconVariant
  source?: IconSource
  usage?: IconUsage
  note?: string
}

function getRepo(): string {
  return import.meta.env.VITE_GITHUB_REPO?.trim() ?? ''
}

async function fetchLiveMetadata(): Promise<CustomIconMetadata | null> {
  if (isGithubAdminEnabled()) {
    try {
      return await getCustomMetadata()
    } catch {
      // fall through to public / local sources
    }
  }

  try {
    const local = await fetch('/__gv/icons/metadata')
    if (local.ok) {
      return (await local.json()) as CustomIconMetadata
    }
  } catch {
    // ignore
  }

  const repo = getRepo()
  if (!repo || !isGithubRepoConfigured()) return null

  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${repo}/main/packages/custom-icons/metadata.json`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return (await res.json()) as CustomIconMetadata
  } catch {
    return null
  }
}

function applyEntry(
  icon: IconMeta,
  entry: CustomIconEntryMeta | undefined,
): IconMeta {
  if (!entry) return icon
  const category = (entry.category ?? '').trim()
  const note = (entry.note ?? '').trim()
  return {
    ...icon,
    category: category || undefined,
    variant: entry.variant ?? icon.variant ?? 'none',
    source: entry.source ?? icon.source ?? 'custom',
    usage: entry.usage ?? icon.usage ?? 'in-use',
    note: note || undefined,
  }
}

function mergeIcons(
  base: IconMeta[],
  metadata: CustomIconMetadata | null,
  overrides: Record<string, LivePropertyPatch>,
): IconMeta[] {
  return base.map((icon) => {
    if (!icon.id.startsWith('ci:') && !icon.id.startsWith('img:')) {
      return icon
    }
    const fromMeta = metadata?.icons[icon.name]
    const override = overrides[icon.name]
    const merged = applyEntry(icon, fromMeta)
    if (!override) return merged
    const category =
      override.category !== undefined
        ? override.category.trim()
        : (merged.category ?? '')
    const note =
      override.note !== undefined
        ? override.note.trim()
        : (merged.note ?? '')
    return {
      ...merged,
      category: category || undefined,
      variant: override.variant ?? merged.variant,
      source: override.source ?? merged.source,
      usage: override.usage ?? merged.usage,
      note: note || undefined,
    }
  })
}

function categoriesFrom(
  metadata: CustomIconMetadata | null,
  overrides: Record<string, LivePropertyPatch>,
  icons: IconMeta[],
): string[] {
  const set = new Set<string>(getCustomCategories())
  for (const category of metadata?.categories ?? []) {
    const trimmed = category.trim()
    if (trimmed) set.add(trimmed)
  }
  for (const patch of Object.values(overrides)) {
    const trimmed = (patch.category ?? '').trim()
    if (trimmed) set.add(trimmed)
  }
  for (const icon of icons) {
    const trimmed = (icon.category ?? '').trim()
    if (trimmed) set.add(trimmed)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Catalog icons with live `metadata.json` properties + optimistic sidebar patches.
 * Avoids waiting on Pages redeploy for category/variant/source/usage.
 */
export function useLiveCatalog() {
  const baseIcons = useMemo(() => getAllIcons(), [])
  const [metadata, setMetadata] = useState<CustomIconMetadata | null>(null)
  const [overrides, setOverrides] = useState<Record<string, LivePropertyPatch>>(
    {},
  )
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const next = await fetchLiveMetadata()
    setMetadata(next)
    setReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchLiveMetadata().then((next) => {
      if (cancelled) return
      setMetadata(next)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const icons = useMemo(
    () => mergeIcons(baseIcons, metadata, overrides),
    [baseIcons, metadata, overrides],
  )

  const categories = useMemo(
    () => categoriesFrom(metadata, overrides, icons),
    [metadata, overrides, icons],
  )

  const search = useCallback(
    (options: SearchOptions = {}) => filterIcons(icons, options),
    [icons],
  )

  const getById = useCallback(
    (id: string) => icons.find((icon) => icon.id === id),
    [icons],
  )

  const patchIcon = useCallback((name: string, patch: LivePropertyPatch) => {
    setOverrides((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...patch },
    }))
  }, [])

  return {
    icons,
    categories,
    ready,
    search,
    getById,
    patchIcon,
    refresh,
  }
}
