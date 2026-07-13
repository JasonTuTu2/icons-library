import { addCollection } from '@iconify/react'
import collection from './collection.json'

/** Register GenVoice custom icons with @iconify/react (call once at app bootstrap). */
export function registerCustomIcons(): void {
  addCollection(collection)
}

export { collection }
