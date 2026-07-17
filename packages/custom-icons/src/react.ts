import { addCollection } from '@iconify/react'
import collection from './collection.json'

/** Register custom icons with @iconify/react. Idempotent; safe to call again. */
export function registerCustomIcons(): void {
  addCollection(collection)
}

// Auto-register when this module loads (also triggered by @JasonTuTu2/icons-react).
registerCustomIcons()

export { collection }
