import { bumpPackageVersion } from './github'

export function formatVersionBumpLabel(
  current: string,
  bump: 'patch' | 'minor' | 'major',
): string {
  if (!current || current === 'unknown') {
    return `Bump ${bump} package versions and publish to GitHub Packages`
  }
  const next = bumpPackageVersion(current, bump)
  return `Package version ${current} → ${next} (all @JasonTuTu2/icons-* packages)`
}
