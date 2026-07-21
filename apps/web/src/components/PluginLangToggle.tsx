import { ChromeIcon } from './ChromeIcon'
import { usePluginLocale } from '../lib/pluginI18n'

/** Plugin-only EN/ZH toggle. Icon only — filled = Chinese. */
export function PluginLangToggle() {
  const { locale, toggle } = usePluginLocale()
  const isZh = locale === 'zh'
  return (
    <button
      type="button"
      className="plugin-lang-toggle"
      onClick={toggle}
      aria-label="Language"
      aria-pressed={isZh}
    >
      <ChromeIcon
        name={isZh ? 'ci:translate-filled' : 'ci:translate-regular'}
        size={18}
      />
    </button>
  )
}
