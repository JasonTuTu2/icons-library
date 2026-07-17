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

const IMAGE_EXT = /\.(png|jpe?g)$/i

/**
 * Copy packages/custom-icons/images → apps/web/public/custom-images
 * so the browser can preview brand images in dev and on Pages.
 */
export function copyCustomImagesPlugin(): Plugin {
  const pluginDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(pluginDir, '../..')
  const srcDir = join(repoRoot, 'packages/custom-icons/images')
  const destDir = join(pluginDir, 'public/custom-images')

  function sync() {
    mkdirSync(destDir, { recursive: true })
    for (const entry of readdirSync(destDir)) {
      if (entry === '.gitkeep') continue
      rmSync(join(destDir, entry), { recursive: true, force: true })
    }
    if (!existsSync(srcDir)) return
    for (const entry of readdirSync(srcDir)) {
      if (!IMAGE_EXT.test(entry)) continue
      const from = join(srcDir, entry)
      if (!statSync(from).isFile()) continue
      cpSync(from, join(destDir, entry))
    }
  }

  return {
    name: 'genvoice-copy-custom-images',
    buildStart() {
      sync()
    },
    configureServer(server) {
      sync()
      server.watcher.add(srcDir)
      server.watcher.on('all', (_event, file) => {
        if (file.replace(/\\/g, '/').includes('/custom-icons/images/')) {
          sync()
        }
      })
    },
  }
}
