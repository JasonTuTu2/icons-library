export type IconSource = 'iconify' | 'custom'

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
  /** Canonical name, e.g. mdi:home, ci:star, or img:logo */
  id: string
  /** Display title */
  title: string
  /** Search tags / aliases */
  tags: string[]
  set: string
  source: IconSource
  license: IconLicense
  /** Iconify/custom body name without prefix */
  name: string
  /** Custom SVG icons only: mono (currentColor), preserved multi-color, or gradient */
  colorMode?: 'mono' | 'preserved' | 'gradient'
  /** Custom assets: vector icon (default) or brand image (png/jpg). */
  assetKind?: 'icon' | 'image'
  /** Brand images only: file format. */
  format?: 'png' | 'jpg' | 'jpeg'
  /** Brand images: path under the icon browser public root
   * (e.g. custom-images/logo.png).
   */
  assetPath?: string
  /** Custom assets only: designer-assigned category (empty = no category). */
  category?: string
}

export interface IconCatalog {
  version: string
  generatedAt: string
  sets: IconSetInfo[]
  icons: IconMeta[]
}
