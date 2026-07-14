import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** GitHub Pages SPA fallback: unknown paths (e.g. /docs) serve index.html. */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))
console.log('Wrote dist/404.html for GitHub Pages SPA routing')
