/** Public URL for a catalog brand-image assetPath (e.g. custom-images/logo.png). */
export function customImagePublicUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}${assetPath.replace(/^\//, '')}`
}
