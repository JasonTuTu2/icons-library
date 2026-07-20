/** Public URL for a catalog assetPath under the browser root
 * (e.g. custom-images/logo.png, custom-icons/foo.svg).
 */
export function customImagePublicUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}${assetPath.replace(/^\//, '')}`
}
