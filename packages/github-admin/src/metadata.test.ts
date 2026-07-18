import { describe, expect, it } from 'vitest'
import {
  createEmptyMetadata,
  detectVariantFromName,
  detectVariantSuffix,
  getIconCategory,
  getIconSource,
  getIconUsage,
  getIconVariant,
  mergeStagingMetaIntoMetadata,
  parseMetadataJson,
  parseStagingMetaFile,
  removeIconMetadata,
  serializeMetadata,
  setIconCategory,
  setIconMetadata,
} from './metadata.js'

describe('metadata', () => {
  it('parses empty and partial metadata', () => {
    expect(parseMetadataJson('')).toEqual(createEmptyMetadata())
    expect(
      parseMetadataJson(
        '{"categories":["Billing"],"icons":{"foo":{"category":"Billing","variant":"filled","source":"iconify"}}}',
      ),
    ).toEqual({
      categories: ['Billing'],
      icons: {
        foo: { category: 'Billing', variant: 'filled', source: 'iconify' },
      },
    })
  })

  it('leaves missing variant/source unset so defaults can apply', () => {
    expect(
      parseMetadataJson(
        '{"categories":[],"icons":{"foo":{"category":""}}}',
      ).icons.foo,
    ).toEqual({ category: '' })
  })

  it('merges staging entries with variant and source', () => {
    const merged = mergeStagingMetaIntoMetadata(createEmptyMetadata(), [
      {
        name: 'billing-alert',
        category: 'Billing',
        variant: 'regular',
        source: 'custom',
      },
      {
        name: 'logo-filled',
        category: '',
        variant: 'filled',
        source: 'modified',
      },
    ])
    expect(merged.categories).toEqual(['Billing'])
    expect(getIconCategory(merged, 'billing-alert')).toBe('Billing')
    expect(getIconVariant(merged, 'billing-alert')).toBe('regular')
    expect(getIconSource(merged, 'billing-alert')).toBe('custom')
    expect(getIconVariant(merged, 'logo-filled')).toBe('filled')
    expect(getIconSource(merged, 'logo-filled')).toBe('modified')
  })

  it('updates and removes icon metadata', () => {
    const base = setIconCategory(createEmptyMetadata(), 'foo', 'Nav')
    expect(base.categories).toEqual(['Nav'])
    const withMeta = setIconMetadata(base, 'foo', {
      variant: 'filled',
      source: 'iconify',
    })
    expect(getIconVariant(withMeta, 'foo')).toBe('filled')
    expect(getIconSource(withMeta, 'foo')).toBe('iconify')
    expect(getIconCategory(withMeta, 'foo')).toBe('Nav')
    const removed = removeIconMetadata(withMeta, 'foo')
    expect(removed.icons.foo).toBeUndefined()
  })

  it('serializes stable JSON', () => {
    const text = serializeMetadata({
      categories: ['Billing'],
      icons: {
        foo: { category: 'Billing', variant: 'filled', source: 'modified' },
      },
    })
    expect(parseMetadataJson(text)).toEqual({
      categories: ['Billing'],
      icons: {
        foo: {
          category: 'Billing',
          variant: 'filled',
          source: 'modified',
          usage: 'in-use',
        },
      },
    })
  })

  it('parses staging meta files', () => {
    expect(
      parseStagingMetaFile(
        '{"category":"Billing","variant":"filled","source":"iconify"}',
      ),
    ).toEqual({
      category: 'Billing',
      variant: 'filled',
      source: 'iconify',
      usage: 'in-use',
    })
    expect(parseStagingMetaFile('not json')).toEqual({
      category: '',
      variant: 'regular',
      source: 'custom',
      usage: 'in-use',
    })
  })

  it('detects variant from name suffix', () => {
    expect(detectVariantFromName('v1-call-filled')).toBe('filled')
    expect(detectVariantFromName('v1-call-regular')).toBe('regular')
    expect(detectVariantFromName('billing-alert')).toBe('regular')
    expect(detectVariantFromName('filled')).toBe('filled')
  })

  it('only reports suffix when present for name edits', () => {
    expect(detectVariantSuffix('v1-call-filled')).toBe('filled')
    expect(detectVariantSuffix('billing-alert')).toBeNull()
  })

  it('infers variant from name when metadata lacks variant', () => {
    const metadata = createEmptyMetadata()
    expect(getIconVariant(metadata, 'v1-note-filled')).toBe('filled')
    expect(getIconVariant(metadata, 'v1-note-regular')).toBe('regular')
  })

  it('defaults missing source to custom', () => {
    expect(getIconSource(createEmptyMetadata(), 'any')).toBe('custom')
  })

  it('defaults missing usage to in-use', () => {
    expect(getIconUsage(createEmptyMetadata(), 'any')).toBe('in-use')
    const withUnused = setIconMetadata(createEmptyMetadata(), 'foo', {
      usage: 'unused',
    })
    expect(getIconUsage(withUnused, 'foo')).toBe('unused')
  })
})
