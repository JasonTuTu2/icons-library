import type { Plugin, ViteDevServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const UPLOAD_PATH = '/__gv/icons/upload'
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

function sanitizeIconName(raw: string): string | null {
  const base = raw
    .replace(/\.svg$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!base || !KEBAB.test(base)) return null
  return base
}

function runCatalogGen(repoRoot: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['--filter', '@genvoice/catalog-gen', 'start'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: true,
      },
    )
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`catalog-gen exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

function reloadDevCatalog(server: ViteDevServer, repoRoot: string) {
  const paths = [
    join(repoRoot, 'packages/catalog/src/index.ts'),
    join(repoRoot, 'packages/catalog/src/data/icons.json'),
    join(repoRoot, 'packages/custom-icons/src/react.ts'),
    join(repoRoot, 'packages/custom-icons/src/collection.json'),
  ]

  for (const file of paths) {
    const mod = server.moduleGraph.getModuleById(file)
    if (mod) server.moduleGraph.invalidateModule(mod)
  }

  server.ws.send({ type: 'full-reload' })
}

export function customIconUploadPlugin(): Plugin {
  const pluginDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(pluginDir, '../..')
  const svgDir = join(repoRoot, 'packages/custom-icons/svg')
  const colorDir = join(svgDir, 'color')

  return {
    name: 'genvoice-custom-icon-upload',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'GET' && req.url === '/__gv/icons/status') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ uploadEnabled: true }))
          return
        }

        if (req.method !== 'POST' || req.url !== UPLOAD_PATH) {
          next()
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            name?: string
            content?: string
            colorMode?: 'mono' | 'preserved'
          }

          const name = sanitizeIconName(body.name ?? '')
          if (!name) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Invalid icon name. Use kebab-case, e.g. billing-alert.',
              }),
            )
            return
          }

          const content = body.content?.trim() ?? ''
          if (!content || !/<svg[\s>]/i.test(content)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Content must be an SVG document.' }))
            return
          }

          const colorMode = body.colorMode === 'preserved' ? 'preserved' : 'mono'
          const targetDir = colorMode === 'preserved' ? colorDir : svgDir
          mkdirSync(targetDir, { recursive: true })
          const filePath = join(targetDir, `${name}.svg`)
          writeFileSync(filePath, `${content}\n`, 'utf8')

          await runCatalogGen(repoRoot)

          reloadDevCatalog(server, repoRoot)

          const relativePath =
            colorMode === 'preserved'
              ? `packages/custom-icons/svg/color/${name}.svg`
              : `packages/custom-icons/svg/${name}.svg`

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              id: `gv:${name}`,
              path: relativePath,
              colorMode,
            }),
          )
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          )
        }
      })
    },
  }
}
