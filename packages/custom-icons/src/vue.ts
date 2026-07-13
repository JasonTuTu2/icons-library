import { addCollection } from '@iconify/vue'
import collection from './collection.json'

/** Register GenVoice custom icons with @iconify/vue (call once at app bootstrap). */
export function registerCustomIcons(): void {
  addCollection(collection)
}

export { collection }
