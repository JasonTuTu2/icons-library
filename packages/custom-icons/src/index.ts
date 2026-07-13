import collection from './collection.json'

export type CustomIconCollection = typeof collection

export { collection }

export function getCustomIconNames(): string[] {
  return Object.keys(collection.icons).map((name) => `gv:${name}`)
}
