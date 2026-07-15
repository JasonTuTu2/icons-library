import { useSyncExternalStore } from 'react'
import type { StagedIcon } from './github'

type Listener = () => void
const listeners = new Set<Listener>()

let unpublished: StagedIcon[] = []
/** Paths currently checked for publish. */
let checkedPaths = new Set<string>()
let loaded = false
let version = 0

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Replace the unpublished list.
 * First load: all checked. Later refreshes preserve checks; new icons default checked.
 */
export function setUnpublishedIcons(icons: StagedIcon[]): void {
  const prevChecked = checkedPaths
  const wasLoaded = loaded
  const previousPaths = new Set(unpublished.map((icon) => icon.path))

  unpublished = [...icons].sort((a, b) => a.name.localeCompare(b.name))

  if (!wasLoaded) {
    checkedPaths = new Set(unpublished.map((icon) => icon.path))
  } else {
    const next = new Set<string>()
    for (const icon of unpublished) {
      if (!previousPaths.has(icon.path) || prevChecked.has(icon.path)) {
        next.add(icon.path)
      }
    }
    checkedPaths = next
  }

  loaded = true
  emit()
}

export function hasUnpublishedSelectionLoaded(): boolean {
  return loaded
}

export function getCheckedUnpublishedIcons(): StagedIcon[] {
  return unpublished.filter((icon) => checkedPaths.has(icon.path))
}

export function getUncheckedUnpublishedIcons(): StagedIcon[] {
  return unpublished.filter((icon) => !checkedPaths.has(icon.path))
}

export function setUnpublishedChecked(path: string, checked: boolean): void {
  const next = new Set(checkedPaths)
  if (checked) next.add(path)
  else next.delete(path)
  checkedPaths = next
  emit()
}

export function setAllUnpublishedChecked(checked: boolean): void {
  checkedPaths = checked
    ? new Set(unpublished.map((icon) => icon.path))
    : new Set()
  emit()
}

export function useUnpublishedSelection(): {
  unpublished: StagedIcon[]
  checkedPaths: ReadonlySet<string>
  allChecked: boolean
} {
  useSyncExternalStore(subscribe, () => version, () => 0)
  const allChecked =
    unpublished.length > 0 &&
    unpublished.every((icon) => checkedPaths.has(icon.path))
  return {
    unpublished,
    checkedPaths,
    allChecked,
  }
}
