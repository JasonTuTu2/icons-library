/**
 * @iconify/react v6 exports `iconLoaded` only; v5 also aliases it as `iconExists`.
 * Prefer whichever the installed peer provides.
 */
export function iconifyIconExists(
  api: { iconLoaded?: (name: string) => boolean; iconExists?: (name: string) => boolean },
  name: string,
): boolean {
  const check = api.iconLoaded ?? api.iconExists
  return typeof check === 'function' ? check(name) : false
}
