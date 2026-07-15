import {
  actionsUrl,
  createGithubAdminClient,
  GithubAuthError,
  packagesUrl,
  sanitizeIconName,
  type IconColorMode,
  type StagedIcon,
} from '@JasonTuTu2/github-admin'
import {
  GITHUB_REPO,
  type PluginToUiMessage,
  type UiToPluginMessage,
} from './messages'

interface ExportIcon {
  id: string
  name: string
  content: string
  previewUrl: string
}

let token = ''
let icons: ExportIcon[] = []
let staged: StagedIcon[] = []
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

function getColorMode(): IconColorMode {
  const checked = document.querySelector(
    'input[name="colorMode"]:checked',
  ) as HTMLInputElement | null
  return checked?.value === 'preserved' ? 'preserved' : 'mono'
}

function getClient() {
  return createGithubAdminClient({ token, repo: GITHUB_REPO })
}

async function withAuthClear<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof GithubAuthError) {
      token = ''
      post({ type: 'clear-token' })
      renderAuth()
      updateActionButtons()
    }
    throw err
  }
}

function updateActionButtons(): void {
  const authed = Boolean(token)
  ;($('btn-stage') as HTMLButtonElement).disabled =
    !authed || icons.length === 0 || busy
  ;($('btn-refresh') as HTMLButtonElement).disabled = !authed || busy
  ;($('btn-apply') as HTMLButtonElement).disabled = !authed || busy
  ;($('btn-publish') as HTMLButtonElement).disabled = !authed || busy
}

function renderAuth(): void {
  const panel = $('auth-panel')
  if (token) {
    panel.innerHTML = `
      <p class="hint">Connected to <code>${GITHUB_REPO}</code></p>
      <div class="row">
        <button type="button" id="btn-disconnect">Disconnect GitHub</button>
      </div>
    `
    $('btn-disconnect').onclick = () => {
      post({ type: 'clear-token' })
    }
    return
  }

  panel.innerHTML = `
    <p class="hint">PAT needs <code>contents:write</code> and <code>actions:write</code>.</p>
    <label for="pat">GitHub PAT</label>
    <input type="password" id="pat" placeholder="ghp_…" autocomplete="off" />
    <div class="row">
      <button type="button" class="primary" id="btn-connect">Connect</button>
    </div>
  `
  $('btn-connect').onclick = () => {
    const value = ($('pat') as HTMLInputElement).value.trim()
    if (!value) {
      setMessage('Paste a GitHub PAT with contents:write and actions:write.', true)
      return
    }
    post({ type: 'set-token', token: value })
  }
}

function renderIcons(): void {
  const list = $('icon-list')
  list.innerHTML = ''
  for (const icon of icons) {
    const li = document.createElement('li')
    const preview = document.createElement('div')
    preview.className = 'preview'
    const img = document.createElement('img')
    img.src = icon.previewUrl
    img.alt = ''
    preview.appendChild(img)

    const input = document.createElement('input')
    input.type = 'text'
    input.value = icon.name
    input.addEventListener('input', () => {
      icon.name = input.value
    })

    li.appendChild(preview)
    li.appendChild(input)
    list.appendChild(li)
  }
  updateActionButtons()
}

function renderStaged(): void {
  const list = $('staged-list')
  list.innerHTML = ''
  if (staged.length === 0) {
    const li = document.createElement('li')
    li.textContent = token ? 'Nothing staged.' : 'Connect to list staged icons.'
    list.appendChild(li)
    return
  }
  for (const item of staged) {
    const li = document.createElement('li')
    li.textContent = `gv:${item.name} (${item.colorMode === 'preserved' ? 'multi-color' : 'mono'})`
    list.appendChild(li)
  }
}

function setLinks(): void {
  ;($('link-actions') as HTMLAnchorElement).href = actionsUrl(GITHUB_REPO)
  ;($('link-packages') as HTMLAnchorElement).href = packagesUrl(GITHUB_REPO)
}

async function refreshStaged(): Promise<void> {
  if (!token) return
  busy = true
  updateActionButtons()
  try {
    staged = await withAuthClear(() => getClient().listStagedIcons())
    renderStaged()
    setMessage('')
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), true)
  } finally {
    busy = false
    updateActionButtons()
  }
}

function revokePreviews(): void {
  for (const icon of icons) {
    URL.revokeObjectURL(icon.previewUrl)
  }
}

$('btn-export').onclick = () => {
  setMessage('')
  post({ type: 'export-selection' })
}

$('btn-stage').onclick = async () => {
  if (!token || icons.length === 0) return
  busy = true
  updateActionButtons()
  setMessage('')
  try {
    const colorMode = getColorMode()
    const payload = icons.map((icon) => {
      const name = sanitizeIconName(icon.name)
      if (!name) {
        throw new Error(
          `Invalid icon name "${icon.name}". Use kebab-case, e.g. billing-alert.`,
        )
      }
      return { name, content: icon.content, colorMode }
    })
    await withAuthClear(() => getClient().stageIcons(payload))
    setMessage(
      `Staged ${payload.length} icon(s). Apply when ready to promote into the library.`,
    )
    await refreshStaged()
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), true)
  } finally {
    busy = false
    updateActionButtons()
  }
}

$('btn-refresh').onclick = () => {
  void refreshStaged()
}

$('btn-apply').onclick = async () => {
  if (!token) return
  busy = true
  updateActionButtons()
  setMessage('')
  try {
    await withAuthClear(() => getClient().dispatchApplyStaged())
    setMessage(
      `Apply workflow queued. Track progress: ${actionsUrl(GITHUB_REPO)}`,
    )
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), true)
  } finally {
    busy = false
    updateActionButtons()
  }
}

$('btn-publish').onclick = async () => {
  if (!token) return
  const ok = window.confirm(
    'Bump patch versions and publish all packages to GitHub Packages?',
  )
  if (!ok) return
  busy = true
  updateActionButtons()
  setMessage('')
  try {
    await withAuthClear(() => getClient().dispatchPublish())
    setMessage(
      `Publish workflow queued. Packages: ${packagesUrl(GITHUB_REPO)}. Track: ${actionsUrl(GITHUB_REPO)}`,
    )
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), true)
  } finally {
    busy = false
    updateActionButtons()
  }
}

onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginToUiMessage | undefined
  if (!msg) return

  switch (msg.type) {
    case 'ready':
    case 'token': {
      token = msg.token
      renderAuth()
      updateActionButtons()
      renderStaged()
      if (token) void refreshStaged()
      break
    }
    case 'export-result': {
      revokePreviews()
      icons = msg.icons.map((icon) => ({
        ...icon,
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

setLinks()
renderAuth()
updateActionButtons()
renderStaged()
post({ type: 'ui-ready' })
