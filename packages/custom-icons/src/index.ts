import collection from './collection.json'

export type CustomIconCollection = typeof collection

export { collection }

export function getCustomIconNames(): string[] {
  return Object.keys(collection.icons).map((name) => `gv:${name}`)
}

/** Relative package path for a brand image file, e.g. `images/logo.png`. */
export function getCustomImagePath(
  name: string,
  format: 'png' | 'jpg' | 'jpeg' = 'png',
): string {
  const base = name.replace(/^img:/, '').replace(/\.(png|jpe?g)$/i, '')
  return `images/${base}.${format}`
}
