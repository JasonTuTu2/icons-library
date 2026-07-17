import { describe, expect, it } from 'vitest'
import {
  createEmptyMetadata,
  getIconCategory,
  mergeStagingMetaIntoMetadata,
  parseMetadataJson,
  parseStagingMetaFile,
  removeIconMetadata,
  serializeMetadata,
  setIconCategory,
} from './metadata.js'

describe('metadata', () => {
  it('parses empty and partial metadata', () => {
    expect(parseMetadataJson('')).toEqual(createEmptyMetadata())
    expect(
      parseMetadataJson(
        '{"categories":["Billing"],"icons":{"foo":{"category":"Billing"}}}',
      ),
    ).toEqual({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing' } },
    })
  })

  it('merges staging entries and registers new categories', () => {
    const merged = mergeStagingMetaIntoMetadata(createEmptyMetadata(), [
      { name: 'billing-alert', category: 'Billing' },
      { name: 'logo', category: '' },
    ])
    expect(merged.categories).toEqual(['Billing'])
    expect(getIconCategory(merged, 'billing-alert')).toBe('Billing')
    expect(getIconCategory(merged, 'logo')).toBe('')
  })

  it('updates and removes icon metadata', () => {
    const base = setIconCategory(createEmptyMetadata(), 'foo', 'Nav')
    expect(base.categories).toEqual(['Nav'])
    const removed = removeIconMetadata(base, 'foo')
    expect(removed.icons.foo).toBeUndefined()
  })

  it('serializes stable JSON', () => {
    const text = serializeMetadata({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing' } },
    })
    expect(parseMetadataJson(text)).toEqual({
      categories: ['Billing'],
      icons: { foo: { category: 'Billing' } },
    })
  })

  it('parses staging meta files', () => {
    expect(parseStagingMetaFile('{"category":"Billing"}')).toEqual({
      category: 'Billing',
    })
    expect(parseStagingMetaFile('not json')).toEqual({ category: '' })
  })
})
