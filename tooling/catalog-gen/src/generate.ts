import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mdi from '@iconify-json/mdi/icons.json'
import lucide from '@iconify-json/lucide/icons.json'
import heroicons from '@iconify-json/heroicons/icons.json'
import { collectAllCustomIcons } from './customSvg.js'
import { collectCustomImages } from './customImages.js'
import { categoryForIcon, loadCustomMetadata, metadataPathFromCustomRoot } from './metadata.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../../../packages/catalog/src/data/icons.json')
const customRootDir = join(__dirname, '../../../packages/custom-icons')
const customSvgDir = join(customRootDir, 'svg')
const customImagesDir = join(customRootDir, 'images')
const customCollectionPath = join(
  __dirname,
  '../../../packages/custom-icons/src/collection.json',
)

interface IconLicense {
  spdx: string
  title: string
  url?: string
}

interface IconSetInfo {
  id: string
  name: string
  source: 'iconify' | 'custom'
  license: IconLicense
  prefix: string
  homepage?: string
}

interface IconMeta {
  id: string
  title: string
  tags: string[]
  set: string
  source: 'iconify' | 'custom'
  license: IconLicense
  name: string
  colorMode?: 'mono' | 'preserved' | 'gradient'
  assetKind?: 'icon' | 'image'
  format?: 'png' | 'jpg' | 'jpeg'
  assetPath?: string
}

const customLicense: IconLicense = {
  spdx: 'LicenseRef-Custom',
  title: 'Custom / proprietary — internal use',
}

const sets: IconSetInfo[] = [
  {
    id: 'mdi',
    name: 'Material Design Icons',
    source: 'iconify',
    license: {
      spdx: 'Apache-2.0',
      title: 'Apache License 2.0',
      url: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE',
    },
    prefix: 'mdi',
    homepage: 'https://pictogrammers.com/library/mdi/',
  },
  {
    id: 'lucide',
    name: 'Lucide',
    source: 'iconify',
    license: {
      spdx: 'ISC',
      title: 'ISC License',
      url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    },
    prefix: 'lucide',
    homepage: 'https://lucide.dev/',
  },
  {
    id: 'heroicons',
    name: 'Heroicons',
    source: 'iconify',
    license: {
      spdx: 'MIT',
      title: 'MIT License',
      url: 'https://github.com/tailwindlabs/heroicons/blob/master/LICENSE',
    },
    prefix: 'heroicons',
    homepage: 'https://heroicons.com/',
  },
  {
    id: 'custom',
    name: 'Custom Icons',
    source: 'custom',
    license: customLicense,
    prefix: 'ci',
  },
  {
    id: 'custom-images',
    name: 'Brand Images',
    source: 'custom',
    license: customLicense,
    prefix: 'img',
  },
]

function titleFromName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function collectIconify(
  collection: {
    prefix: string
    icons: Record<string, unknown>
    categories?: Record<string, string[]>
  },
  set: IconSetInfo,
): IconMeta[] {
  const categoryTags = new Map<string, string[]>()
  if (collection.categories) {
    for (const [category, names] of Object.entries(collection.categories)) {
      for (const name of names) {
        const existing = categoryTags.get(name) ?? []
        existing.push(category)
        categoryTags.set(name, existing)
      }
    }
  }

  return Object.keys(collection.icons)
    .sort()
    .map((name) => {
      const tags = [name, set.prefix, ...(categoryTags.get(name) ?? [])]
      return {
        id: `${set.prefix}:${name}`,
        title: titleFromName(name),
        tags,
        set: set.id,
        source: 'iconify' as const,
        license: set.license,
        name,
      }
    })
}

function collectCustomIcons(): IconMeta[] {
  const customMetadata = loadCustomMetadata(metadataPathFromCustomRoot(customRootDir))
  const { icons, warnings } = collectAllCustomIcons(customSvgDir)
  for (const warning of warnings) {
    console.warn(`[catalog-gen] ${warning}`)
  }

  const collection = {
    prefix: 'ci',
    width: 24,
    height: 24,
    icons: Object.fromEntries(
      icons.map((item) => [
        item.name,
        {
          body: item.icon.body,
          width: item.icon.width ?? 24,
          height: item.icon.height ?? 24,
        },
      ]),
    ),
  }

  mkdirSync(dirname(customCollectionPath), { recursive: true })
  writeFileSync(customCollectionPath, `${JSON.stringify(collection, null, 2)}\n`)
  console.log(
    `Wrote ${icons.length} custom icons → ${customCollectionPath}`,
  )

  return icons.map((item) => ({
    id: `ci:${item.name}`,
    title: item.title,
    tags: [
      item.name,
      'ci',
      'custom',
      item.colorMode === 'preserved'
        ? 'multicolor'
        : item.colorMode === 'gradient'
          ? 'gradient'
          : 'mono',
      item.colorMode,
      ...(categoryForIcon(customMetadata, item.name)
        ? [categoryForIcon(customMetadata, item.name)!]
        : []),
    ],
    set: 'custom',
    source: 'custom' as const,
    license: customLicense,
    name: item.name,
    colorMode: item.colorMode,
    assetKind: 'icon' as const,
    category: categoryForIcon(customMetadata, item.name),
  }))
}

function collectBrandImages(): IconMeta[] {
  const customMetadata = loadCustomMetadata(metadataPathFromCustomRoot(customRootDir))
  const { images, warnings } = collectCustomImages(customImagesDir)
  for (const warning of warnings) {
    console.warn(`[catalog-gen] ${warning}`)
  }
  console.log(`Found ${images.length} brand image(s) in ${customImagesDir}`)

  return images.map((item) => ({
    id: `img:${item.name}`,
    title: item.title,
    tags: [
      item.name,
      'img',
      'image',
      'custom',
      item.format,
      'brand-image',
      ...(categoryForIcon(customMetadata, item.name)
        ? [categoryForIcon(customMetadata, item.name)!]
        : []),
    ],
    set: 'custom-images',
    source: 'custom' as const,
    license: customLicense,
    name: item.name,
    assetKind: 'image' as const,
    format: item.format,
    assetPath: item.publicPath,
    category: categoryForIcon(customMetadata, item.name),
  }))
}

function main() {
  const iconifySets = [
    { data: mdi as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[0]! },
    { data: lucide as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[1]! },
    { data: heroicons as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[2]! },
  ]

  const icons: IconMeta[] = [
    ...iconifySets.flatMap(({ data, set }) => collectIconify(data, set)),
    ...collectCustomIcons(),
    ...collectBrandImages(),
  ]

  const catalog = {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    sets,
    icons,
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(catalog))
  console.log(
    `Wrote ${icons.length} icons across ${sets.length} sets → ${outPath}`,
  )
}

main()
