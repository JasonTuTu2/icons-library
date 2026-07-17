const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Match `@JasonTuTu2/github-admin` sanitizeIconName. */
export function sanitizeIconName(raw: string): string | null {
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
