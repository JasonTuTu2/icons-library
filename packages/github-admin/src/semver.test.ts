import { describe, expect, it } from 'vitest'
import { bumpPackageVersion } from './index.js'

describe('bumpPackageVersion', () => {
  it('bumps patch, minor, and major semver', () => {
    expect(bumpPackageVersion('0.3.21', 'patch')).toBe('0.3.22')
    expect(bumpPackageVersion('0.3.21', 'minor')).toBe('0.4.0')
    expect(bumpPackageVersion('0.3.21', 'major')).toBe('1.0.0')
    expect(bumpPackageVersion('0.4.0', 'minor')).toBe('0.5.0')
  })
})
