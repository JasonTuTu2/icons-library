export type IconSource = 'ant' | 'iconify'

export interface IconLicense {
  /** SPDX or short name */
  spdx: string
  title: string
  url?: string
}

export interface IconSetInfo {
  id: string
  name: string
  source: IconSource
  license: IconLicense
  prefix: string
  homepage?: string
}

export interface IconMeta {
  /** Canonical name, e.g. ant:HomeOutlined or mdi:home */
  id: string
  /** Display title */
  title: string
  /** Search tags / aliases */
  tags: string[]
  set: string
  source: IconSource
  license: IconLicense
  /** Iconify body icon name without prefix, or Ant export name */
  name: string
}

export interface IconCatalog {
  version: string
  generatedAt: string
  sets: IconSetInfo[]
  icons: IconMeta[]
}
