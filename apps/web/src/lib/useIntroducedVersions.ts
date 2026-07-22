import { useEffect, useState } from 'react'
import {
  isGithubRepoConfigured,
  listUnpublishedIcons,
  useGithubAdminEnabled,
} from './github'

function introducedVersionsUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}introduced-versions.json`
}

async function loadIntroducedMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await fetch(introducedVersionsUrl(), { cache: 'no-store' })
    if (!res.ok) return map
    const data = (await res.json()) as Record<string, unknown>
    for (const [name, version] of Object.entries(data)) {
      if (typeof version === 'string' && version.trim()) {
        map.set(name.toLowerCase(), version.trim())
      }
    }
  } catch {
    // ignore — detail shows em dash until the file is available
  }
  return map
}

export function useIntroducedVersions() {
  const adminEnabled = useGithubAdminEnabled()
  const enabled = isGithubRepoConfigured() && adminEnabled
  const [byName, setByName] = useState<Map<string, string> | null>(null)
  const [pendingNames, setPendingNames] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setByName(new Map())
      setPendingNames(new Set())
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void Promise.all([
      loadIntroducedMap(),
      listUnpublishedIcons().catch(() => [] as { name: string }[]),
    ])
      .then(([introduced, unpublished]) => {
        if (cancelled) return
        setByName(introduced)
        setPendingNames(new Set(unpublished.map((icon) => icon.name)))
      })
      .catch(() => {
        if (!cancelled) {
          setByName(new Map())
          setPendingNames(new Set())
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  function packageVersionForIcon(name: string): string | null {
    return byName?.get(name.toLowerCase()) ?? null
  }

  function isPendingPublish(name: string): boolean {
    return pendingNames?.has(name) ?? false
  }

  return {
    enabled,
    loading,
    packageVersionForIcon,
    isPendingPublish,
  }
}
