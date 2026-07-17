import {
  buildBrowserHandoffUrl,
  buildOpenUploadUrl,
  downloadHandoffJson,
  encodeHandoffPayload,
  MAX_HANDOFF_CHARS,
  type IconColorMode,
} from './handoff'
import { ICON_BROWSER_URL, type PluginToUiMessage, type UiToPluginMessage } from './messages'
import { sanitizeIconName } from './sanitize'

interface ExportIcon {
  id: string
  name: string
  content: string
  previewUrl: string
  colorMode: IconColorMode
}

let icons: ExportIcon[] = []
let busy = false

function post(msg: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*')
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

function setMessage(text: string, isError = false): void {
  const el = $('message')
  el.textContent = text
  el.classList.toggle('error', isError)
}

function updateActionButtons(): void {
  ;($('btn-send') as HTMLButtonElement).disabled = icons.length === 0 || busy
}

function openBrowser(url: string): void {
  // Anchor click is more reliable than openExternal alone for query strings.
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
  post({ type: 'open-url', url })
}

function renderIcons(): void {
  const list = $('icon-list')
  const hint = $('selection-hint')
  list.innerHTML = ''

  if (icons.length === 0) {
    hint.classList.remove('hidden')
    updateActionButtons()
    return
  }

  hint.classList.add('hidden')
  for (const icon of icons) {
    const li = document.createElement('li')

    const img = document.createElement('img')
    img.src = icon.previewUrl
    img.alt = ''

    const label = document.createElement('label')
    const prefix = document.createElement('span')
    prefix.textContent = 'gv:'
    const input = document.createElement('input')
    input.type = 'text'
    input.value = icon.name
    input.addEventListener('input', () => {
      icon.name = input.value
    })
    label.appendChild(prefix)
    label.appendChild(input)

    const colorSelect = document.createElement('select')
    colorSelect.className = 'color-mode-select'
    colorSelect.setAttribute(
      'aria-label',
      `Color mode for gv:${icon.name || 'icon'}`,
    )
    for (const opt of [
      { value: 'mono', label: 'Mono' },
      { value: 'preserved', label: 'Multi' },
    ] as const) {
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = opt.label
      if (icon.colorMode === opt.value) option.selected = true
      colorSelect.appendChild(option)
    }
    colorSelect.addEventListener('change', () => {
      icon.colorMode =
        colorSelect.value === 'preserved' ? 'preserved' : 'mono'
    })

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'ghost'
    remove.textContent = 'Remove'
    remove.onclick = () => {
      URL.revokeObjectURL(icon.previewUrl)
      icons = icons.filter((row) => row.id !== icon.id)
      renderIcons()
    }

    li.appendChild(img)
    li.appendChild(label)
    li.appendChild(colorSelect)
    li.appendChild(remove)
    list.appendChild(li)
  }
  updateActionButtons()
}

function revokePreviews(): void {
  for (const icon of icons) {
    URL.revokeObjectURL(icon.previewUrl)
  }
}

function buildPayload() {
  return icons.map((icon) => {
    const name = sanitizeIconName(icon.name)
    if (!name) {
      throw new Error(
        `Invalid icon name "${icon.name}". Use kebab-case, e.g. billing-alert.`,
      )
    }
    return { name, content: icon.content, colorMode: icon.colorMode }
  })
}

$('btn-export').onclick = () => {
  setMessage('')
  post({ type: 'export-selection' })
}

$('btn-send').onclick = () => {
  if (icons.length === 0) return
  busy = true
  updateActionButtons()
  setMessage('')
  try {
    const payload = buildPayload()
    const encoded = encodeHandoffPayload(payload)
    if (encoded.length <= MAX_HANDOFF_CHARS) {
      openBrowser(buildBrowserHandoffUrl(ICON_BROWSER_URL, encoded))
      setMessage(
        `Opened icon browser with ${payload.length} icon(s). Stage, apply, and publish from there.`,
      )
    } else {
      downloadHandoffJson(payload)
      openBrowser(buildOpenUploadUrl(ICON_BROWSER_URL))
      setMessage(
        `Payload too large for a URL. Downloaded gv-icons-handoff.json — drop it into Upload SVG in the browser.`,
      )
    }
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), true)
  } finally {
    busy = false
    updateActionButtons()
  }
}

;($('link-browser') as HTMLAnchorElement).href = ICON_BROWSER_URL

onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginToUiMessage | undefined
  if (!msg) return

  switch (msg.type) {
    case 'ready': {
      updateActionButtons()
      break
    }
    case 'export-result': {
      revokePreviews()
      icons = msg.icons.map((icon) => ({
        ...icon,
        colorMode: 'mono' as IconColorMode,
        previewUrl: URL.createObjectURL(
          new Blob([icon.content], { type: 'image/svg+xml' }),
        ),
      }))
      renderIcons()
      if (msg.error) {
        setMessage(msg.error, icons.length === 0)
      } else if (icons.length === 0) {
        setMessage('No exportable nodes in selection.', true)
      } else {
        setMessage(`Loaded ${icons.length} icon(s) from selection.`)
      }
      break
    }
    default:
      break
  }
}

updateActionButtons()
post({ type: 'ui-ready' })
