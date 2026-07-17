import type { Plugin, ViteDevServer } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const UPLOAD_PATH = '/__gv/icons/upload'
const METADATA_PATH = '/__gv/icons/metadata'
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

interface CustomIconMetadata {
  categories: string[]
  icons: Record<string, { category?: string; variant?: 'regular' | 'filled' }>
}

function normalizeCategory(raw: string | undefined | null): string {
  return (raw ?? '').trim()
}

function normalizeVariant(
  raw: string | undefined | null,
): 'regular' | 'filled' {
  return raw === 'filled' ? 'filled' : 'regular'
}

function readMetadata(metadataPath: string): CustomIconMetadata {
  try {
    return JSON.parse(readFileSync(metadataPath, 'utf8')) as CustomIconMetadata
  } catch {
    return { categories: [], icons: {} }
  }
}

function writeMetadata(metadataPath: string, metadata: CustomIconMetadata): void {
  mkdirSync(dirname(metadataPath), { recursive: true })
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
}

function setIconMetadataLocal(
  metadataPath: string,
  name: string,
  patch: { category?: string; variant?: 'regular' | 'filled' },
): void {
  const metadata = readMetadata(metadataPath)
  const current = metadata.icons[name] ?? {}
  const cat =
    patch.category !== undefined
      ? normalizeCategory(patch.category)
      : normalizeCategory(current.category)
  const variant =
    patch.variant !== undefined
      ? normalizeVariant(patch.variant)
      : normalizeVariant(current.variant)
  metadata.icons[name] = { category: cat, variant }
  if (cat && !metadata.categories.includes(cat)) {
    metadata.categories.push(cat)
    metadata.categories.sort((a, b) => a.localeCompare(b))
  }
  writeMetadata(metadataPath, metadata)
}

function sanitizeIconName(raw: string): string | null {
  const base = raw
    .replace(/\.(svg|png|jpe?g)$/i, '')
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
      ['--filter', '@JasonTuTu2/catalog-gen', 'start'],
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
    join(repoRoot, 'packages/custom-icons/metadata.json'),
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
  const gradientDir = join(svgDir, 'gradient')
  const imagesDir = join(repoRoot, 'packages/custom-icons/images')
  const metadataFile = join(repoRoot, 'packages/custom-icons/metadata.json')

  return {
    name: 'genvoice-custom-icon-upload',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'GET' && req.url === '/__gv/icons/status') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ uploadEnabled: true }))
          return
        }

        if (req.method === 'GET' && req.url === METADATA_PATH) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(readMetadata(metadataFile)))
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
            colorMode?: 'mono' | 'preserved' | 'gradient'
            kind?: 'svg' | 'image'
            format?: 'png' | 'jpg' | 'jpeg'
            category?: string
            variant?: 'regular' | 'filled'
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

          if (body.kind === 'image') {
            const format = body.format
            if (!format || !['png', 'jpg', 'jpeg'].includes(format)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Image uploads require format png, jpg, or jpeg.',
                }),
              )
              return
            }
            const raw = (body.content ?? '').trim()
            const base64 = raw.includes(',')
              ? raw.slice(raw.indexOf(',') + 1)
              : raw
            if (!base64) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Image content is empty.' }))
              return
            }

            mkdirSync(imagesDir, { recursive: true })
            const filePath = join(imagesDir, `${name}.${format}`)
            writeFileSync(filePath, Buffer.from(base64, 'base64'))
            setIconMetadataLocal(metadataFile, name, {
              category: body.category ?? '',
              variant: normalizeVariant(body.variant),
            })

            await runCatalogGen(repoRoot)
            reloadDevCatalog(server, repoRoot)

            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: true,
                id: `img:${name}`,
                path: `packages/custom-icons/images/${name}.${format}`,
                kind: 'image',
                format,
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

          const colorMode =
            body.colorMode === 'preserved'
              ? 'preserved'
              : body.colorMode === 'gradient'
                ? 'gradient'
                : 'mono'
          const targetDir =
            colorMode === 'preserved'
              ? colorDir
              : colorMode === 'gradient'
                ? gradientDir
                : svgDir
          mkdirSync(targetDir, { recursive: true })
          const filePath = join(targetDir, `${name}.svg`)
          writeFileSync(filePath, `${content}\n`, 'utf8')
          setIconMetadataLocal(metadataFile, name, {
            category: body.category ?? '',
            variant: normalizeVariant(body.variant),
          })

          await runCatalogGen(repoRoot)

          reloadDevCatalog(server, repoRoot)

          const relativePath =
            colorMode === 'preserved'
              ? `packages/custom-icons/svg/color/${name}.svg`
              : colorMode === 'gradient'
                ? `packages/custom-icons/svg/gradient/${name}.svg`
                : `packages/custom-icons/svg/${name}.svg`

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              id: `ci:${name}`,
              path: relativePath,
              colorMode,
              kind: 'svg',
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
