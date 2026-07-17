import { describe, expect, it } from 'vitest'
import {
  createEmptyMetadata,
  detectVariantFromName,
  detectVariantSuffix,
  getIconCategory,
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
        '{"categories":["Billing"],"icons":{"foo":{"category":"Billing","variant":"filled"}}}',
      ),
    ).toEqual({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing', variant: 'filled' } },
    })
  })

  it('leaves missing variant unset so name detection can apply', () => {
    expect(
      parseMetadataJson(
        '{"categories":[],"icons":{"foo":{"category":""}}}',
      ).icons.foo,
    ).toEqual({ category: '' })
  })

  it('merges staging entries with variant', () => {
    const merged = mergeStagingMetaIntoMetadata(createEmptyMetadata(), [
      { name: 'billing-alert', category: 'Billing', variant: 'regular' },
      { name: 'logo-filled', category: '', variant: 'filled' },
    ])
    expect(merged.categories).toEqual(['Billing'])
    expect(getIconCategory(merged, 'billing-alert')).toBe('Billing')
    expect(getIconVariant(merged, 'billing-alert')).toBe('regular')
    expect(getIconVariant(merged, 'logo-filled')).toBe('filled')
  })

  it('updates and removes icon metadata', () => {
    const base = setIconCategory(createEmptyMetadata(), 'foo', 'Nav')
    expect(base.categories).toEqual(['Nav'])
    const withVariant = setIconMetadata(base, 'foo', { variant: 'filled' })
    expect(getIconVariant(withVariant, 'foo')).toBe('filled')
    expect(getIconCategory(withVariant, 'foo')).toBe('Nav')
    const removed = removeIconMetadata(withVariant, 'foo')
    expect(removed.icons.foo).toBeUndefined()
  })

  it('serializes stable JSON', () => {
    const text = serializeMetadata({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing', variant: 'filled' } },
    })
    expect(parseMetadataJson(text)).toEqual({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing', variant: 'filled' } },
    })
  })

  it('parses staging meta files', () => {
    expect(
      parseStagingMetaFile('{"category":"Billing","variant":"filled"}'),
    ).toEqual({
      category: 'Billing',
      variant: 'filled',
    })
    expect(parseStagingMetaFile('not json')).toEqual({
      category: '',
      variant: 'regular',
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
})
