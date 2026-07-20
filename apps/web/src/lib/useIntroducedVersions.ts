import { useEffect, useState } from 'react'
import {
  isGithubRepoConfigured,
  listPublishHistory,
  listUnpublishedIcons,
  useGithubAdminEnabled,
} from './github'
import { buildIntroducedVersionByName } from './releaseSummary'

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
      listPublishHistory({ limit: 40 }),
      listUnpublishedIcons(),
    ])
      .then(([history, unpublished]) => {
        if (cancelled) return
        setByName(buildIntroducedVersionByName(history))
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
    return byName?.get(name) ?? null
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
