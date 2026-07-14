/**
 * @iconify/vue may export `iconLoaded` and/or `iconExists` depending on major.
 * Prefer whichever the installed peer provides.
 */
export function iconifyIconExists(
  api: { iconLoaded?: (name: string) => boolean; iconExists?: (name: string) => boolean },
  name: string,
): boolean {
  const check = api.iconLoaded ?? api.iconExists
  return typeof check === 'function' ? check(name) : false
}
