import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as AntIcons from '@ant-design/icons'
import mdi from '@iconify-json/mdi/icons.json'
import lucide from '@iconify-json/lucide/icons.json'
import heroicons from '@iconify-json/heroicons/icons.json'
import { collectCustomIconsFromDir } from './customSvg.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../../../packages/catalog/src/data/icons.json')
const customSvgDir = join(__dirname, '../../../packages/custom-icons/svg')
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
  source: 'ant' | 'iconify' | 'custom'
  license: IconLicense
  prefix: string
  homepage?: string
}

interface IconMeta {
  id: string
  title: string
  tags: string[]
  set: string
  source: 'ant' | 'iconify' | 'custom'
  license: IconLicense
  name: string
}

const antLicense: IconLicense = {
  spdx: 'MIT',
  title: 'MIT License',
  url: 'https://github.com/ant-design/ant-design-icons/blob/master/LICENSE',
}

const customLicense: IconLicense = {
  spdx: 'LicenseRef-GenVoice',
  title: 'GenVoice proprietary / internal use',
}

const sets: IconSetInfo[] = [
  {
    id: 'ant',
    name: 'Ant Design Icons',
    source: 'ant',
    license: antLicense,
    prefix: 'ant',
    homepage: 'https://ant.design/components/icon',
  },
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
    id: 'genvoice',
    name: 'GenVoice Custom',
    source: 'custom',
    license: customLicense,
    prefix: 'gv',
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

function collectAntIcons(): IconMeta[] {
  const skip = new Set([
    'default',
    'createFromIconfontCN',
    'getTwoToneColor',
    'setTwoToneColor',
    'IconProvider',
  ])

  const icons: IconMeta[] = []
  for (const [key, value] of Object.entries(AntIcons)) {
    if (skip.has(key)) continue
    if (typeof value !== 'object' && typeof value !== 'function') continue
    if (!/^[A-Z]/.test(key)) continue

    icons.push({
      id: `ant:${key}`,
      title: titleFromName(key),
      tags: [key.toLowerCase(), 'ant', 'antd'],
      set: 'ant',
      source: 'ant',
      license: antLicense,
      name: key,
    })
  }
  return icons.sort((a, b) => a.id.localeCompare(b.id))
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
  const { icons, warnings } = collectCustomIconsFromDir(customSvgDir)
  for (const warning of warnings) {
    console.warn(`[catalog-gen] ${warning}`)
  }

  const collection = {
    prefix: 'gv',
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
    id: `gv:${item.name}`,
    title: item.title,
    tags: [item.name, 'gv', 'genvoice', 'custom'],
    set: 'genvoice',
    source: 'custom' as const,
    license: customLicense,
    name: item.name,
  }))
}

function main() {
  const iconifySets = [
    { data: mdi as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[1]! },
    { data: lucide as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[2]! },
    { data: heroicons as { prefix: string; icons: Record<string, unknown>; categories?: Record<string, string[]> }, set: sets[3]! },
  ]

  const icons: IconMeta[] = [
    ...collectAntIcons(),
    ...iconifySets.flatMap(({ data, set }) => collectIconify(data, set)),
    ...collectCustomIcons(),
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
