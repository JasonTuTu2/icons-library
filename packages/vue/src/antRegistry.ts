import type { AntIconComponent } from './types.js'

type AntModule = Record<string, AntIconComponent | unknown>

let cached: AntModule | null = null
let loading: Promise<AntModule> | null = null

export async function loadAntModule(): Promise<AntModule> {
  if (cached) return cached
  if (!loading) {
    loading = import('@ant-design/icons-vue').then((mod) => {
      cached = mod as unknown as AntModule
      return cached
    })
  }
  return loading
}

export function getAntIconSync(id: string): AntIconComponent | null {
  if (!cached) return null
  const icon = cached[id]
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as AntIconComponent
  }
  return null
}

export async function resolveAntIcon(
  id: string,
): Promise<AntIconComponent | null> {
  const mod = await loadAntModule()
  const icon = mod[id]
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as AntIconComponent
  }
  return null
}

export function registerAntIcons(icons: AntModule): void {
  cached = icons
}
