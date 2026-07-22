/**
 * Build publish history from "Version packages" commits (newest first).
 * Diffs library SVG/image paths between consecutive publishes.
 *
 * Usage: node scripts/build-publish-history.mjs
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'packages/custom-icons/publish-history.json')

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
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

function commitDate(sha) {
  try {
    return git(['log', '-1', '--format=%cI', sha]) || ''
  } catch {
    return ''
  }
}

function stagedFromLibraryPath(path) {
  const p = path.replace(/\\/g, '/')
  if (p.includes('/staging/')) return null
  const img = /^packages\/custom-icons\/images\/([^/]+)\.(png|jpe?g)$/i.exec(p)
  if (img) {
    const ext = img[2].toLowerCase()
    const format = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png'
    return {
      name: img[1].toLowerCase(),
      path: p,
      kind: 'image',
      format,
    }
  }
  const color = /^packages\/custom-icons\/svg\/color\/([^/]+)\.svg$/i.exec(p)
  if (color) {
    return {
      name: color[1].toLowerCase(),
      path: p,
      kind: 'svg',
      colorMode: 'preserved',
    }
  }
  const gradient = /^packages\/custom-icons\/svg\/gradient\/([^/]+)\.svg$/i.exec(
    p,
  )
  if (gradient) {
    return {
      name: gradient[1].toLowerCase(),
      path: p,
      kind: 'svg',
      colorMode: 'gradient',
    }
  }
  const mono = /^packages\/custom-icons\/svg\/([^/]+)\.svg$/i.exec(p)
  if (mono) {
    return {
      name: mono[1].toLowerCase(),
      path: p,
      kind: 'svg',
      colorMode: 'currentColor',
    }
  }
  return null
}

function libraryDiff(baseSha, headSha) {
  const adds = []
  const removals = []
  let raw = ''
  try {
    raw = git([
      'diff',
      '--name-status',
      `${baseSha}..${headSha}`,
      '--',
      'packages/custom-icons/svg',
      'packages/custom-icons/images',
    ])
  } catch {
    return { adds, removals }
  }
  const byAddName = new Map()
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const tab = trimmed.indexOf('\t')
    if (tab < 0) continue
    const status = trimmed.slice(0, tab).trim()
    const path = trimmed.slice(tab + 1).trim().replace(/\\/g, '/')
    // Renames: R100\told\tnew — take the new path for adds, old for removals
    if (status.startsWith('R')) {
      const parts = trimmed.split('\t')
      const oldPath = parts[1]?.trim()
      const newPath = parts[2]?.trim()
      if (oldPath) {
        const rem = stagedFromLibraryPath(oldPath)
        if (rem) removals.push({ name: rem.name, path: rem.path })
      }
      if (newPath) {
        const add = stagedFromLibraryPath(newPath)
        if (add) byAddName.set(add.name, add)
      }
      continue
    }
    const staged = stagedFromLibraryPath(path)
    if (!staged) continue
    if (status.startsWith('D')) {
      removals.push({ name: staged.name, path: staged.path })
    } else if (status.startsWith('A') || status.startsWith('M')) {
      byAddName.set(staged.name, staged)
    }
  }
  adds.push(...byAddName.values())
  adds.sort((a, b) => a.name.localeCompare(b.name))
  removals.sort((a, b) => a.name.localeCompare(b.name))
  return { adds, removals }
}

const publishShas = git([
  'log',
  '--grep=^Version packages',
  '--format=%H',
])
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)

const entries = []
for (let i = 0; i < publishShas.length; i++) {
  const sha = publishShas[i]
  const version = packageVersionAt(sha)
  if (!version) continue
  const previous = publishShas[i + 1]
  const { adds, removals } = previous
    ? libraryDiff(previous, sha)
    : { adds: [], removals: [] }
  entries.push({
    version,
    publishedAt: commitDate(sha),
    commitSha: sha,
    adds,
    removals,
    versionOnly: adds.length === 0 && removals.length === 0,
  })
}

writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
console.log(
  `Wrote ${entries.length} publish history entries → ${outPath.replace(/\\/g, '/')}`,
)
