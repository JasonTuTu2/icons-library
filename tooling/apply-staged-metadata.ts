import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createEmptyMetadata,
  mergeStagingMetaIntoMetadata,
  METADATA_PATH,
  parseMetadataJson,
  parseStagingMetaFile,
  removeIconMetadata,
  serializeMetadata,
  STAGING_META_DIR,
} from '../packages/github-admin/src/metadata.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function readMetadata(): ReturnType<typeof parseMetadataJson> {
  const path = join(repoRoot, METADATA_PATH)
  if (!existsSync(path)) return createEmptyMetadata()
  return parseMetadataJson(readFileSync(path, 'utf8'))
}

function writeMetadata(metadata: ReturnType<typeof parseMetadataJson>): void {
  const path = join(repoRoot, METADATA_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeMetadata(metadata), 'utf8')
}

function readStagingMetaEntries(): Array<{ name: string; category: string }> {
  const dir = join(repoRoot, STAGING_META_DIR)
  if (!existsSync(dir)) return []
  const entries: Array<{ name: string; category: string }> = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file.startsWith('.')) continue
    const name = file.replace(/\.json$/i, '')
    const raw = readFileSync(join(dir, file), 'utf8')
    const { category } = parseStagingMetaFile(raw)
    entries.push({ name, category })
    unlinkSync(join(dir, file))
  }
  return entries
}

function main(): void {
  let metadata = readMetadata()
  const stagingEntries = readStagingMetaEntries()
  if (stagingEntries.length > 0) {
    metadata = mergeStagingMetaIntoMetadata(metadata, stagingEntries)
    console.log(`Merged ${stagingEntries.length} staged category file(s)`)
  }

  const removedRaw = process.env.REMOVED_NAMES?.trim() ?? ''
  const removedNames = removedRaw
    ? removedRaw.split(',').map((name) => name.trim()).filter(Boolean)
    : []
  for (const name of removedNames) {
    metadata = removeIconMetadata(metadata, name)
    console.log(`Removed metadata for ${name}`)
  }

  if (stagingEntries.length > 0 || removedNames.length > 0) {
    writeMetadata(metadata)
  } else {
    console.log('No category metadata changes')
  }
}

main()
