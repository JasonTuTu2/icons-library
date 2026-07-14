import { addCollection } from '@iconify/vue'
import collection from './collection.json'

/** Register GenVoice custom icons with @iconify/vue. Idempotent; safe to call again. */
export function registerCustomIcons(): void {
  addCollection(collection)
}

// Auto-register when this module loads (also triggered by @JasonTuTu2/icons-vue).
registerCustomIcons()

export { collection }
