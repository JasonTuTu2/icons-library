import type { Plugin } from 'vite'
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
      ['catalog:gen'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: true,
      },
    )
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`catalog:gen exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

export function customIconUploadPlugin(): Plugin {
  const pluginDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(pluginDir, '../..')
  const svgDir = join(repoRoot, 'packages/custom-icons/svg')

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

          mkdirSync(svgDir, { recursive: true })
          const filePath = join(svgDir, `${name}.svg`)
          writeFileSync(filePath, `${content}\n`, 'utf8')

          await runCatalogGen(repoRoot)

          server.ws.send({ type: 'full-reload' })

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              id: `gv:${name}`,
              path: `packages/custom-icons/svg/${name}.svg`,
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
