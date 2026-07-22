import type { Plugin } from 'vite'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SVG_EXT = /\.svg$/i

/**
 * Copy packages/custom-icons/svg → apps/web/public/custom-icons
 * (mono at root; color/ and gradient/ preserved) so designers can
 * download source SVGs from the browser in dev and on Pages.
 */
export function copyCustomIconsPlugin(): Plugin {
  const pluginDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(pluginDir, '../..')
  const srcDir = join(repoRoot, 'packages/custom-icons/svg')
  const destDir = join(pluginDir, 'public/custom-icons')

  function clearDest() {
    mkdirSync(destDir, { recursive: true })
    for (const entry of readdirSync(destDir)) {
      if (entry === '.gitkeep') continue
      rmSync(join(destDir, entry), { recursive: true, force: true })
    }
  }

  function copySvgFiles(fromDir: string, toDir: string) {
    if (!existsSync(fromDir)) return
    mkdirSync(toDir, { recursive: true })
    for (const entry of readdirSync(fromDir)) {
      if (entry === 'color' || entry === 'gradient' || entry.startsWith('.')) {
        continue
      }
      if (!SVG_EXT.test(entry)) continue
      const from = join(fromDir, entry)
      if (!statSync(from).isFile()) continue
      cpSync(from, join(toDir, entry))
    }
  }

  function sync() {
    clearDest()
    if (!existsSync(srcDir)) return
    copySvgFiles(srcDir, destDir)
    copySvgFiles(join(srcDir, 'color'), join(destDir, 'color'))
    copySvgFiles(join(srcDir, 'gradient'), join(destDir, 'gradient'))
    const introducedSrc = join(
      repoRoot,
      'packages/custom-icons/introduced-versions.json',
    )
    if (existsSync(introducedSrc)) {
      cpSync(introducedSrc, join(pluginDir, 'public/introduced-versions.json'))
    }
    const publishHistorySrc = join(
      repoRoot,
      'packages/custom-icons/publish-history.json',
    )
    if (existsSync(publishHistorySrc)) {
      cpSync(publishHistorySrc, join(pluginDir, 'public/publish-history.json'))
    }
  }

  return {
    name: 'genvoice-copy-custom-icons',
    buildStart() {
      sync()
    },
    configureServer(server) {
      sync()
      server.watcher.add(srcDir)
      server.watcher.on('all', (_event, file) => {
        if (file.replace(/\\/g, '/').includes('/custom-icons/svg/')) {
          sync()
        }
      })
    },
  }
}
