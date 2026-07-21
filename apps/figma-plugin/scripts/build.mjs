import * as esbuild from 'esbuild'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const watch = process.argv.includes('--watch')
const iconBrowserUrl =
  process.env.ICON_BROWSER_URL?.trim() ||
  'https://JasonTuTu2.github.io/icons-library/'
const panelVersion =
  process.env.GITHUB_SHA?.slice(0, 7)?.trim() ||
  process.env.PANEL_CACHE_VERSION?.trim() ||
  '2'
const figmaPanelQuery = `gv-figma=1&v=${panelVersion}`

mkdirSync(join(root, 'dist'), { recursive: true })

/** @type {import('esbuild').BuildOptions} */
const codeOptions = {
  bundle: true,
  target: 'es2017',
  logLevel: 'info',
  define: {
    __ICON_BROWSER_URL__: JSON.stringify(iconBrowserUrl),
    __FIGMA_PANEL_QUERY__: JSON.stringify(figmaPanelQuery),
  },
  entryPoints: [join(root, 'src/code.ts')],
  outfile: join(root, 'dist/code.js'),
  format: 'iife',
  platform: 'browser',
}

function writeDistManifest() {
  const rootManifest = JSON.parse(
    readFileSync(join(root, 'manifest.json'), 'utf8'),
  )
  writeFileSync(
    join(root, 'dist/manifest.json'),
    `${JSON.stringify({ ...rootManifest, main: 'code.js' }, null, 2)}\n`,
  )
}

async function buildOnce() {
  await esbuild.build(codeOptions)
  writeDistManifest()
}

if (watch) {
  const ctx = await esbuild.context(codeOptions)
  await ctx.watch()
  writeDistManifest()
  console.log(`Watching figma plugin… UI → ${iconBrowserUrl}`)
} else {
  await buildOnce()
  console.log(`Built figma plugin (UI → ${iconBrowserUrl})`)
}
