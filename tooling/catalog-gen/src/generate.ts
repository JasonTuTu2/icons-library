import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectAllCustomIcons } from './customSvg.js'
import { collectCustomImages } from './customImages.js'
import {
  categoryForIcon,
  loadCustomMetadata,
  metadataPathFromCustomRoot,
  sourceForIcon,
  variantForIcon,
} from './metadata.js'

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
  source: 'custom'
  license: IconLicense
  prefix: string
  homepage?: string
}

interface IconMeta {
  id: string
  title: string
  tags: string[]
  set: string
  source: 'custom'
  license: IconLicense
  name: string
  colorMode?: 'mono' | 'preserved' | 'gradient'
  assetKind?: 'icon' | 'image'
  format?: 'png' | 'jpg' | 'jpeg'
  assetPath?: string
  category?: string
  variant?: 'regular' | 'filled'
  source: 'iconify' | 'custom' | 'modified'
}

const customLicense: IconLicense = {
  spdx: 'LicenseRef-Custom',
  title: 'Custom / proprietary — internal use',
}

const sets: IconSetInfo[] = [
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

function collectCustomIcons(): IconMeta[] {
  const customMetadata = loadCustomMetadata(
    metadataPathFromCustomRoot(customRootDir),
  )
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
  writeFileSync(
    customCollectionPath,
    `${JSON.stringify(collection, null, 2)}\n`,
  )
  console.log(`Wrote ${icons.length} custom icons → ${customCollectionPath}`)

  return icons.map((item) => {
    const category = categoryForIcon(customMetadata, item.name)
    const variant = variantForIcon(customMetadata, item.name)
    const source = sourceForIcon(customMetadata, item.name)
    return {
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
        variant,
        source,
        ...(category ? [category] : []),
      ],
      set: 'custom',
      source,
      license: customLicense,
      name: item.name,
      colorMode: item.colorMode,
      assetKind: 'icon' as const,
      category,
      variant,
    }
  })
}

function collectBrandImages(): IconMeta[] {
  const customMetadata = loadCustomMetadata(
    metadataPathFromCustomRoot(customRootDir),
  )
  const { images, warnings } = collectCustomImages(customImagesDir)
  for (const warning of warnings) {
    console.warn(`[catalog-gen] ${warning}`)
  }
  console.log(`Found ${images.length} brand image(s) in ${customImagesDir}`)

  return images.map((item) => {
    const category = categoryForIcon(customMetadata, item.name)
    const variant = variantForIcon(customMetadata, item.name)
    const source = sourceForIcon(customMetadata, item.name)
    return {
      id: `img:${item.name}`,
      title: item.title,
      tags: [
        item.name,
        'img',
        'image',
        'custom',
        item.format,
        'brand-image',
        variant,
        source,
        ...(category ? [category] : []),
      ],
      set: 'custom-images',
      source,
      license: customLicense,
      name: item.name,
      assetKind: 'image' as const,
      format: item.format,
      assetPath: item.publicPath,
      category,
      variant,
    }
  })
}

function main() {
  const icons: IconMeta[] = [...collectCustomIcons(), ...collectBrandImages()]

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
