import {
  parseStagingMetaFile,
  sanitizeIconName,
  validateIconUploads,
  type AssetPreview,
  type IconColorMode,
  type IconNameConflict,
  type IconUploadPayload,
  type ImageFormat,
  type StagedIcon,
  type StagedRemoval,
} from '@JasonTuTu2/github-admin'

const DB_NAME = 'genvoice-icon-staging'
const DB_VERSION = 1
const STORE = 'files'

const STAGING_BASE = 'packages/custom-icons/staging'
const STAGING_META = `${STAGING_BASE}/meta`
const REMOVE_DIR = `${STAGING_BASE}/remove`
const STAGING_IMAGES = `${STAGING_BASE}/images`
const IMAGE_EXTS = ['png', 'jpg', 'jpeg'] as const

function stagingDir(colorMode: IconColorMode | undefined): string {
  if (colorMode === 'preserved') return 'color'
  if (colorMode === 'gradient') return 'gradient'
  return 'mono'
}

function removalMarkerPath(name: string): string {
  return `${REMOVE_DIR}/${name}.remove`
}

function stagingMetaPath(name: string): string {
  return `${STAGING_META}/${name}.json`
}

function parseImageFormat(raw: string): ImageFormat | null {
  const ext = raw.replace(/^\./, '').toLowerCase()
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return ext
  return null
}

function findImageFileName(names: Set<string>, iconName: string): string | null {
  const lower = iconName.toLowerCase()
  for (const ext of IMAGE_EXTS) {
    const candidate = `${lower}.${ext}`
    if (names.has(candidate)) return candidate
  }
  return null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'path' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const result = fn(store)
    if (result instanceof Promise) {
      result.then(resolve, reject)
      tx.oncomplete = () => db.close()
      tx.onerror = () => reject(tx.error)
      return
    }
    result.onsuccess = () => resolve(result.result as T)
    result.onerror = () => reject(result.error ?? tx.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => reject(tx.error)
  })
}

async function putRecord(path: string, content: string): Promise<void> {
  await withStore('readwrite', (store) =>
    store.put({ path, content }),
  )
}

async function deleteRecord(path: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(path))
}

async function getRecord(path: string): Promise<string | null> {
  const row = await withStore<{ path: string; content: string } | undefined>(
    'readonly',
    (store) => store.get(path),
  )
  return row?.content ?? null
}

async function listAllPaths(): Promise<string[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAllKeys()
    req.onsuccess = () => {
      const keys = req.result
      resolve(keys.map((k) => String(k)))
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

async function writeStagingMeta(
  name: string,
  category: string,
  variant: IconUploadPayload['variant'],
  source: IconUploadPayload['source'],
  usage: IconUploadPayload['usage'],
  note: string,
  replaceLibrary?: boolean,
): Promise<void> {
  await putRecord(
    stagingMetaPath(name),
    `${JSON.stringify({
      category: category ?? '',
      variant: variant ?? 'regular',
      source: source ?? 'custom',
      usage: usage ?? 'in-use',
      note: note ?? '',
      replaceLibrary: replaceLibrary ? true : undefined,
    })}\n`,
  )
}

async function deleteStagingMeta(name: string): Promise<void> {
  await deleteRecord(stagingMetaPath(name))
}

async function readStagingMetaMap(): Promise<
  Map<
    string,
    {
      category: string
      variant: NonNullable<StagedIcon['variant']>
      source: NonNullable<StagedIcon['source']>
      usage: NonNullable<StagedIcon['usage']>
      note: string
    }
  >
> {
  const paths = await listAllPaths()
  const map = new Map<
    string,
    {
      category: string
      variant: NonNullable<StagedIcon['variant']>
      source: NonNullable<StagedIcon['source']>
      usage: NonNullable<StagedIcon['usage']>
      note: string
    }
  >()
  for (const path of paths) {
    if (!path.startsWith(`${STAGING_META}/`) || !path.endsWith('.json')) {
      continue
    }
    const name = path.slice(STAGING_META.length + 1).replace(/\.json$/i, '')
    const raw = await getRecord(path)
    if (!raw) continue
    map.set(name, parseStagingMetaFile(raw))
  }
  return map
}

function isStagingAssetPath(path: string): boolean {
  return path.replace(/\\/g, '/').includes('/staging/')
}

export async function clearLocalStaging(): Promise<void> {
  const paths = await listAllPaths()
  await Promise.all(paths.map((p) => deleteRecord(p)))
}

export async function stageIconsLocal(
  icons: IconUploadPayload[],
): Promise<void> {
  const normalized = validateIconUploads(icons)

  for (const icon of normalized) {
    await deleteRecord(removalMarkerPath(icon.name))

    if (icon.kind === 'image') {
      const format = icon.format!
      for (const ext of IMAGE_EXTS) {
        if (ext === format) continue
        await deleteRecord(`${STAGING_IMAGES}/${icon.name}.${ext}`)
      }
      await putRecord(`${STAGING_IMAGES}/${icon.name}.${format}`, icon.content)
      await writeStagingMeta(
        icon.name,
        icon.category ?? '',
        icon.variant,
        icon.source,
        icon.usage,
        icon.note ?? '',
        icon.replaceLibrary === true,
      )
      continue
    }

    const dir = stagingDir(icon.colorMode ?? 'mono')
    for (const other of ['mono', 'color', 'gradient'] as const) {
      if (other === dir) continue
      await deleteRecord(`${STAGING_BASE}/${other}/${icon.name}.svg`)
    }
    await putRecord(
      `${STAGING_BASE}/${dir}/${icon.name}.svg`,
      `${icon.content}\n`,
    )
    await writeStagingMeta(
      icon.name,
      icon.category ?? '',
      icon.variant,
      icon.source,
      icon.usage,
      icon.note ?? '',
      icon.replaceLibrary === true,
    )
  }
}

/** Stage removals locally (library existence must be validated by caller). */
export async function stageRemovalsLocal(names: string[]): Promise<void> {
  const unique = [
    ...new Set(
      names
        .map((n) => sanitizeIconName(n))
        .filter((n): n is string => Boolean(n)),
    ),
  ]
  if (unique.length === 0) {
    throw new Error('No icon names to remove.')
  }

  for (const name of unique) {
    await deleteRecord(`${STAGING_BASE}/mono/${name}.svg`)
    await deleteRecord(`${STAGING_BASE}/color/${name}.svg`)
    await deleteRecord(`${STAGING_BASE}/gradient/${name}.svg`)
    for (const ext of IMAGE_EXTS) {
      await deleteRecord(`${STAGING_IMAGES}/${name}.${ext}`)
    }
    await deleteStagingMeta(name)
    await putRecord(removalMarkerPath(name), `remove ${name}\n`)
  }
}

export async function unstageRemovalLocal(name: string): Promise<void> {
  const sanitized = sanitizeIconName(name)
  if (!sanitized) {
    throw new Error(`Invalid icon name "${name}".`)
  }
  const path = removalMarkerPath(sanitized)
  const existing = await getRecord(path)
  if (!existing) {
    throw new Error(`${sanitized} is not staged for removal.`)
  }
  await deleteRecord(path)
}

async function listDirIcons(
  dir: 'mono' | 'color' | 'gradient' | 'images',
  colorMode?: IconColorMode,
): Promise<StagedIcon[]> {
  const prefix =
    dir === 'images' ? `${STAGING_IMAGES}/` : `${STAGING_BASE}/${dir}/`
  const paths = (await listAllPaths()).filter((p) => p.startsWith(prefix))

  if (dir === 'images') {
    return paths
      .filter((p) => /\.(png|jpe?g)$/i.test(p))
      .map((path) => {
        const base = path.split('/').pop()!
        const format = parseImageFormat(
          base.slice(base.lastIndexOf('.') + 1),
        )!
        return {
          name: base.replace(/\.(png|jpe?g)$/i, ''),
          path,
          kind: 'image' as const,
          format,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return paths
    .filter((p) => p.toLowerCase().endsWith('.svg'))
    .map((path) => {
      const base = path.split('/').pop()!
      return {
        name: base.replace(/\.svg$/i, ''),
        colorMode: colorMode!,
        path,
        kind: 'svg' as const,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listStagedIconsLocal(): Promise<StagedIcon[]> {
  const [mono, color, gradient, images, stagingMeta] = await Promise.all([
    listDirIcons('mono', 'mono'),
    listDirIcons('color', 'preserved'),
    listDirIcons('gradient', 'gradient'),
    listDirIcons('images'),
    readStagingMetaMap(),
  ])

  return [...mono, ...color, ...gradient, ...images]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((icon) => {
      const staged = stagingMeta.get(icon.name)
      return {
        ...icon,
        category: staged?.category ?? icon.category ?? '',
        variant: staged?.variant ?? icon.variant ?? 'regular',
        source: staged?.source ?? icon.source ?? 'custom',
        usage: staged?.usage ?? icon.usage ?? 'in-use',
        note: staged?.note ?? icon.note ?? '',
      }
    })
}

export async function listStagedRemovalsLocal(): Promise<StagedRemoval[]> {
  const prefix = `${REMOVE_DIR}/`
  return (await listAllPaths())
    .filter((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.remove'))
    .map((path) => ({
      name: path.split('/').pop()!.replace(/\.remove$/i, ''),
      path,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function exportIconUploadPayloads(): Promise<IconUploadPayload[]> {
  const icons = await listStagedIconsLocal()
  const payloads: IconUploadPayload[] = []

  for (const icon of icons) {
    const raw = await getRecord(icon.path)
    if (!raw) continue
    if (icon.kind === 'image') {
      payloads.push({
        name: icon.name,
        content: raw,
        kind: 'image',
        format: icon.format!,
        category: icon.category,
        variant: icon.variant,
        source: icon.source,
        usage: icon.usage,
        note: icon.note,
      })
    } else {
      payloads.push({
        name: icon.name,
        content: raw.trimEnd(),
        kind: 'svg',
        colorMode: icon.colorMode ?? 'mono',
        category: icon.category,
        variant: icon.variant,
        source: icon.source,
        usage: icon.usage,
        note: icon.note,
      })
    }
  }
  return payloads
}

export async function exportRemovalNames(): Promise<string[]> {
  const removals = await listStagedRemovalsLocal()
  return removals.map((r) => r.name)
}

export async function findLocalStagingNameConflicts(
  names: string[],
): Promise<IconNameConflict[]> {
  const unique = [
    ...new Set(
      names
        .map((n) => sanitizeIconName(n))
        .filter((n): n is string => Boolean(n)),
    ),
  ]
  if (unique.length === 0) return []

  const paths = await listAllPaths()
  const mono = new Set<string>()
  const color = new Set<string>()
  const gradient = new Set<string>()
  const images = new Set<string>()
  const remove = new Set<string>()

  for (const path of paths) {
    const base = path.split('/').pop()!.toLowerCase()
    if (path.includes('/staging/mono/')) mono.add(base)
    else if (path.includes('/staging/color/')) color.add(base)
    else if (path.includes('/staging/gradient/')) gradient.add(base)
    else if (path.includes('/staging/images/')) images.add(base)
    else if (path.includes('/staging/remove/')) remove.add(base)
  }

  const conflicts: IconNameConflict[] = []
  for (const name of unique) {
    if (mono.has(`${name}.svg`)) {
      conflicts.push({ name, location: 'staging-mono' })
    }
    if (color.has(`${name}.svg`)) {
      conflicts.push({ name, location: 'staging-color' })
    }
    if (gradient.has(`${name}.svg`)) {
      conflicts.push({ name, location: 'staging-gradient' })
    }
    if (findImageFileName(images, name)) {
      conflicts.push({ name, location: 'staging-image' })
    }
    if (remove.has(`${name}.remove`)) {
      conflicts.push({ name, location: 'staging-remove' })
    }
  }
  return conflicts
}

export async function getLocalAssetPreview(
  path: string,
): Promise<AssetPreview | null> {
  if (!isStagingAssetPath(path)) return null
  const content = await getRecord(path)
  if (!content) return null
  const lower = path.toLowerCase()
  if (lower.endsWith('.svg')) {
    return { kind: 'svg', text: content }
  }
  if (lower.endsWith('.png')) {
    return { kind: 'image', base64: content, mime: 'image/png' }
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return {
      kind: 'image',
      base64: content,
      mime: 'image/jpeg',
    }
  }
  return null
}
