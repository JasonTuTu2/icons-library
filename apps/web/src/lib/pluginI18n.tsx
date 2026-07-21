import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

export type PluginLocale = 'en' | 'zh'

const STORAGE_KEY = 'gv-plugin-locale'

type Listener = () => void
const listeners = new Set<Listener>()

let cachedLocale: PluginLocale | undefined

function emit(): void {
  cachedLocale = undefined
  for (const listener of listeners) listener()
}

function readLocale(): PluginLocale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'zh' || raw === 'en') return raw
  } catch {
    // ignore
  }
  return 'en'
}

export function getPluginLocale(): PluginLocale {
  if (cachedLocale === undefined) cachedLocale = readLocale()
  return cachedLocale
}

export function setPluginLocale(locale: PluginLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore
  }
  emit()
}

export function togglePluginLocale(): PluginLocale {
  const next: PluginLocale = getPluginLocale() === 'zh' ? 'en' : 'zh'
  setPluginLocale(next)
  return next
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Plugin UI copy. Icon names, ci:/img:, SVG/PNG/JPG, and stored enum values stay English. */
const messages = {
  en: {
    langToggle: 'Switch to Chinese',
    switchToZh: 'Switch to Chinese',
    switchToEn: 'Switch to English',
    signInPlugin: 'Sign in to use the plugin',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',
    brandTitle: 'GenVoice Icons',
    loadSelection: 'Load selection',
    working: 'Working…',
    stage: 'Stage',
    hintOffline:
      'Open this panel from the Figma plugin (Pages figma.html). Sign in to stage to your account and apply in the icon browser.',
    hintOnlineBefore: 'Load → set format / properties → ',
    hintOnlineAfter:
      ' (syncs to your account when signed in). Then open the site signed in and use Upload → Apply. See ',
    designerOps: 'Designer ops',
    hintOnlineOptional: '. Optional: ',
    openIconBrowser: 'Open icon browser',
    hintOnlineSvg: ' below. Mono/Multi/Gradient only apply to SVG.',
    openBrowserNote:
      'Optional — site Upload works if you staged while signed in',
    remove: 'Remove',
    reexporting: 'Re-exporting…',
    applyToAll: 'Apply to All',
    formatPlaceholder: 'Format…',
    colorPlaceholder: 'Color…',
    note: 'Note',
    notePlaceholder: 'Note…',
    addNote: 'Add Note',
    editNote: 'Edit Note',
    noExportable: 'No exportable nodes in selection.',
    loadedEdit: 'Edit format/names, then Stage.',
    loadedPrefix: 'Loaded',
    imageUnit: 'image',
    switchedSvg: 'Switched to SVG (ci:).',
    switchedImg: 'Switched to {format} (img:).',
    appliedFormat: 'Applied format to {count} asset(s).',
    appliedFormatErrors: 'Updated formats with some errors: {error}',
    invalidName:
      'Invalid icon name "{name}". Use kebab-case, e.g. billing-alert.',
    fixConflicts: 'Fix staging conflicts or batch duplicates before staging.',
    stagedOneAccount:
      'Staged 1 asset to your account. Open the site signed in → Upload to Apply (link optional).',
    stagedOneLocal:
      'Staged 1 asset locally in the plugin. Sign in, Stage again to sync, then open the site.',
    stagedManyAccount:
      'Staged {count} assets to your account. Open the site signed in → Upload to Apply (link optional).',
    stagedManyLocal:
      'Staged {count} assets locally in the plugin. Sign in, Stage again to sync, then open the site.',
    duplicateBatch: 'Duplicate name in this batch. Choose a different name.',
    alreadyIn:
      '{id} is already in {where}. Unstage it first or rename.',
    willReplace:
      '{id} will replace {where} when you Stage (Apply overwrites the file, including when color mode changes).',
    locLibraryMono: 'library (mono SVG)',
    locLibraryColor: 'library (multi-color SVG)',
    locLibraryGradient: 'library (gradient SVG)',
    locLibraryImage: 'library (brand image)',
    locStagingMono: 'staging (mono SVG)',
    locStagingColor: 'staging (multi-color SVG)',
    locStagingGradient: 'staging (gradient SVG)',
    locStagingImage: 'staging (brand image)',
    locStagingRemove: 'staged removals',
    replaceConfirm:
      'Replace existing {label} in the library?\n\nApply will overwrite the current file. Publishing a replacement bumps the minor package version (e.g. 0.3.21 → 0.4.0).',
    ariaExport: 'Figma export',
    ariaFormat: 'Export format for {name}',
    ariaColor: 'Color mode for ci:{name}',
    ariaCategory: 'Category for {id}',
    ariaVariant: 'Variant for {id}',
    ariaSource: 'Source for {id}',
    ariaUsage: 'Usage for {id}',
    ariaNote: 'Note for {id}',
    ariaApplyFormat: 'Apply export format to all pending assets',
    ariaApplyColor: 'Apply color mode to all SVG assets',
    ariaApplyCategory: 'Apply category to all pending assets',
    ariaApplyVariant: 'Apply variant to all pending assets',
    ariaApplySource: 'Apply source to all pending assets',
    ariaApplyUsage: 'Apply usage to all pending assets',
    ariaApplyNote: 'Apply note to all pending assets',
    assetFallback: 'asset',
    iconFallback: 'icon',
  },
  zh: {
    langToggle: '切换语言',
    switchToZh: '切换到中文',
    switchToEn: '切换到英文',
    signInPlugin: '登录以使用插件',
    username: '用户名',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中…',
    signOut: '退出',
    signedInAs: '已登录为',
    brandTitle: 'GenVoice Icons',
    loadSelection: '加载选中',
    working: '处理中…',
    stage: '暂存',
    hintOffline:
      '请从 Figma 插件打开此面板（Pages figma.html）。登录后可暂存到账户，并在图标浏览器中 Apply。',
    hintOnlineBefore: '加载 → 设置格式 / 属性 → ',
    hintOnlineAfter:
      '（登录后会同步到账户）。然后在网站登录，使用 Upload → Apply。参见 ',
    designerOps: '设计师操作',
    hintOnlineOptional: '。可选：',
    openIconBrowser: '打开图标浏览器',
    hintOnlineSvg: '（下方）。Mono/Multi/Gradient 仅适用于 SVG。',
    openBrowserNote: '可选 — 登录状态下暂存后，网站 Upload 即可使用',
    remove: '移除',
    reexporting: '重新导出中…',
    applyToAll: '全部应用',
    formatPlaceholder: '格式…',
    colorPlaceholder: '色彩…',
    note: '备注',
    notePlaceholder: '备注…',
    addNote: '添加备注',
    editNote: '编辑备注',
    noExportable: '当前选中没有可导出的节点。',
    loadedEdit: '编辑格式/名称，然后暂存。',
    loadedPrefix: '已加载',
    imageUnit: '图片',
    switchedSvg: '已切换为 SVG (ci:)。',
    switchedImg: '已切换为 {format} (img:)。',
    appliedFormat: '已将格式应用到 {count} 个资源。',
    appliedFormatErrors: '已更新格式，但有错误：{error}',
    invalidName:
      '无效图标名 “{name}”。请使用 kebab-case，例如 billing-alert。',
    fixConflicts: '暂存前请先解决冲突或批次内重名。',
    stagedOneAccount:
      '已暂存 1 个资源到账户。登录网站 → Upload → Apply（链接可选）。',
    stagedOneLocal:
      '已在插件本地暂存 1 个资源。请登录后再次暂存以同步，然后打开网站。',
    stagedManyAccount:
      '已暂存 {count} 个资源到账户。登录网站 → Upload → Apply（链接可选）。',
    stagedManyLocal:
      '已在插件本地暂存 {count} 个资源。请登录后再次暂存以同步，然后打开网站。',
    duplicateBatch: '本批次内名称重复。请换一个名称。',
    alreadyIn: '{id} 已在 {where}。请先取消暂存或重命名。',
    willReplace:
      '暂存时 {id} 将替换 {where}（Apply 会覆盖文件，包括色彩模式变更）。',
    locLibraryMono: '图库（单色 SVG）',
    locLibraryColor: '图库（多色 SVG）',
    locLibraryGradient: '图库（渐变 SVG）',
    locLibraryImage: '图库（品牌图片）',
    locStagingMono: '暂存（单色 SVG）',
    locStagingColor: '暂存（多色 SVG）',
    locStagingGradient: '暂存（渐变 SVG）',
    locStagingImage: '暂存（品牌图片）',
    locStagingRemove: '暂存移除',
    replaceConfirm:
      '替换图库中已有的 {label}？\n\nApply 会覆盖当前文件。发布替换会提升次版本号（例如 0.3.21 → 0.4.0）。',
    ariaExport: 'Figma 导出',
    ariaFormat: '{name} 的导出格式',
    ariaColor: 'ci:{name} 的色彩模式',
    ariaCategory: '{id} 的分类',
    ariaVariant: '{id} 的变体',
    ariaSource: '{id} 的来源',
    ariaUsage: '{id} 的使用状态',
    ariaNote: '{id} 的备注',
    ariaApplyFormat: '将导出格式应用到全部待处理资源',
    ariaApplyColor: '将色彩模式应用到全部 SVG',
    ariaApplyCategory: '将分类应用到全部待处理资源',
    ariaApplyVariant: '将变体应用到全部待处理资源',
    ariaApplySource: '将来源应用到全部待处理资源',
    ariaApplyUsage: '将使用状态应用到全部待处理资源',
    ariaApplyNote: '将备注应用到全部待处理资源',
    assetFallback: '资源',
    iconFallback: '图标',
  },
} as const

export type PluginMessageKey = keyof (typeof messages)['en']

export function pluginT(
  locale: PluginLocale,
  key: PluginMessageKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = messages[locale][key] ?? messages.en[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v))
    }
  }
  return text
}

type PluginLocaleContextValue = {
  locale: PluginLocale
  t: (key: PluginMessageKey, vars?: Record<string, string | number>) => string
  toggle: () => void
}

const PluginLocaleContext = createContext<PluginLocaleContextValue | null>(
  null,
)

export function PluginLocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getPluginLocale,
    (): PluginLocale => 'en',
  )
  const t = useCallback(
    (key: PluginMessageKey, vars?: Record<string, string | number>) =>
      pluginT(locale, key, vars),
    [locale],
  )
  const toggle = useCallback(() => {
    togglePluginLocale()
  }, [])
  const value = useMemo(
    () => ({ locale, t, toggle }),
    [locale, t, toggle],
  )
  return (
    <PluginLocaleContext.Provider value={value}>
      {children}
    </PluginLocaleContext.Provider>
  )
}

export function usePluginLocale(): PluginLocaleContextValue {
  const ctx = useContext(PluginLocaleContext)
  if (!ctx) {
    return {
      locale: 'en',
      t: (key, vars) => pluginT('en', key, vars),
      toggle: () => undefined,
    }
  }
  return ctx
}

/** Conflict / confirm copy for the plugin (Upload panel keeps English defaults). */
export function pluginConflictCopy(
  t: (key: PluginMessageKey, vars?: Record<string, string | number>) => string,
): {
  duplicateBatch: string
  alreadyIn: (id: string, where: string) => string
  willReplace: (id: string, where: string) => string
  locationLabel: (
    location:
      | 'library-mono'
      | 'library-color'
      | 'library-gradient'
      | 'library-image'
      | 'staging-mono'
      | 'staging-color'
      | 'staging-gradient'
      | 'staging-image'
      | 'staging-remove',
  ) => string
  replaceConfirm: (label: string) => string
} {
  const locationKey = {
    'library-mono': 'locLibraryMono',
    'library-color': 'locLibraryColor',
    'library-gradient': 'locLibraryGradient',
    'library-image': 'locLibraryImage',
    'staging-mono': 'locStagingMono',
    'staging-color': 'locStagingColor',
    'staging-gradient': 'locStagingGradient',
    'staging-image': 'locStagingImage',
    'staging-remove': 'locStagingRemove',
  } as const
  return {
    duplicateBatch: t('duplicateBatch'),
    alreadyIn: (id, where) => t('alreadyIn', { id, where }),
    willReplace: (id, where) => t('willReplace', { id, where }),
    locationLabel: (location) => t(locationKey[location]),
    replaceConfirm: (label) => t('replaceConfirm', { label }),
  }
}
