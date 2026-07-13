import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const outdir = join(__dirname, 'tmp-bundle')
const require = createRequire(import.meta.url)

mkdirSync(outdir, { recursive: true })

const entry = join(outdir, 'entry.tsx')
writeFileSync(
  entry,
  `
import { Icon } from '@genvoice/icons-react'
export function Demo() {
  return <Icon name="mdi:home" decorative size={24} />
}
`,
)

const reactPkg = join(root, 'packages/react/dist/index.js')
const corePkg = join(root, 'packages/core/dist/index.js')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  alias: {
    '@genvoice/icons-react': reactPkg,
    '@genvoice/icons-core': corePkg,
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@ant-design/icons',
    '@iconify/react',
  ],
  logLevel: 'silent',
})

const bytes = result.outputFiles[0]?.contents.byteLength ?? 0
const kb = bytes / 1024
const budgetKb = 200

console.log(`Iconify-only smoke bundle: ${kb.toFixed(1)} KB (budget ${budgetKb} KB)`)

if (kb > budgetKb) {
  console.error('Bundle exceeded size budget')
  process.exit(1)
}

// Ensure resolving packages works
require(reactPkg)
