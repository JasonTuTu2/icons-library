/**
 * Build name → first published package version from "Version packages" commits.
 * Run after `changeset version` so unpublished library assets pick up the new version.
 *
 * Usage: node scripts/build-introduced-versions.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'packages/custom-icons/introduced-versions.json')
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg'])

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

function nameFromLibraryPath(path) {
  const p = path.replace(/\\/g, '/')
  if (p.includes('/staging/')) return null
  const svgMatch = /^packages\/custom-icons\/svg\/(?:color\/|gradient\/)?([^/]+)\.svg$/i.exec(
    p,
  )
  if (svgMatch) return svgMatch[1].toLowerCase()
  const imgMatch = /^packages\/custom-icons\/images\/([^/]+)\.(png|jpe?g)$/i.exec(
    p,
  )
  if (imgMatch) return imgMatch[1].toLowerCase()
  return null
}

function packageVersionAt(sha) {
  try {
    const raw = git(['show', `${sha}:packages/react/package.json`])
    const parsed = JSON.parse(raw)
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

function libraryNamesAt(sha) {
  let listing = ''
  try {
    listing = git([
      'ls-tree',
      '-r',
      '--name-only',
      sha,
      '--',
      'packages/custom-icons/svg',
      'packages/custom-icons/images',
    ])
  } catch {
    return new Set()
  }
  const names = new Set()
  for (const line of listing.split('\n')) {
    const name = nameFromLibraryPath(line.trim())
    if (name) names.add(name)
  }
  return names
}

function currentLibraryNames() {
  const names = new Set()
  const svgRoots = [
    join(root, 'packages/custom-icons/svg'),
    join(root, 'packages/custom-icons/svg/color'),
    join(root, 'packages/custom-icons/svg/gradient'),
  ]
  for (const dir of svgRoots) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.svg')) continue
      names.add(entry.name.replace(/\.svg$/i, '').toLowerCase())
    }
  }
  const imgDir = join(root, 'packages/custom-icons/images')
  if (existsSync(imgDir)) {
    for (const entry of readdirSync(imgDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const lower = entry.name.toLowerCase()
      const dot = lower.lastIndexOf('.')
      if (dot < 0) continue
      const ext = lower.slice(dot)
      if (!IMAGE_EXTS.has(ext)) continue
      names.add(lower.slice(0, dot))
    }
  }
  return names
}

function currentPackageVersion() {
  const raw = readFileSync(join(root, 'packages/react/package.json'), 'utf8')
  const parsed = JSON.parse(raw)
  return typeof parsed.version === 'string' ? parsed.version : '0.0.0'
}

const publishShas = git([
  'log',
  '--reverse',
  '--grep=^Version packages',
  '--format=%H',
])
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)

const introduced = {}
for (const sha of publishShas) {
  const version = packageVersionAt(sha)
  if (!version) continue
  for (const name of libraryNamesAt(sha)) {
    if (!introduced[name]) introduced[name] = version
  }
}

const currentVersion = currentPackageVersion()
for (const name of currentLibraryNames()) {
  if (!introduced[name]) introduced[name] = currentVersion
}

const sorted = Object.fromEntries(
  Object.entries(introduced).sort(([a], [b]) => a.localeCompare(b)),
)

writeFileSync(outPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
console.log(
  `Wrote ${Object.keys(sorted).length} introduced versions → ${outPath.replace(/\\/g, '/')}`,
)
