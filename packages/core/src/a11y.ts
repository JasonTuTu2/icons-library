import type { IconA11yAttributes, IconA11yInput } from './types.js'
import { isDev } from './env.js'

/**
 * Build ARIA attributes for an icon.
 * Prefer either `label` (meaningful) or `decorative: true`.
 */
export function getA11yAttributes(input: IconA11yInput): IconA11yAttributes {
  if (input.decorative) {
    return { 'aria-hidden': true }
  }

  if (input.label) {
    return {
      role: 'img',
      'aria-label': input.label,
    }
  }

  // Safe default when neither is provided: hide from AT
  return { 'aria-hidden': true }
}

export function warnMissingA11y(name: string, input: IconA11yInput): void {
  if (isDev() && !input.decorative && !input.label) {
    console.warn(
      `[GenVoice Icons] Icon "${name}" has neither \`label\` nor \`decorative\`. ` +
        'Pass \`label\` for meaningful icons or \`decorative\` for presentational ones.',
    )
  }
}
