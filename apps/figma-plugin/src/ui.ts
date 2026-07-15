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
  colorMode: IconColorMode
}

let token = ''
let icons: ExportIcon[] = []
let staged: StagedIcon[] = []
let busy = false
let authOpen = false

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
  ;($('btn-apply') as HTMLButtonElement).disabled =
    !authed || busy || staged.length === 0
  ;($('btn-publish') as HTMLButtonElement).disabled = !authed || busy
}

function renderAuth(): void {
  const toolbar = $('auth-toolbar')
  const panel = $('auth-panel')

  if (token) {
    authOpen = false
    panel.classList.add('hidden')
    panel.innerHTML = ''
    toolbar.innerHTML = `
      <button type="button" class="ghost" id="btn-disconnect">Disconnect GitHub</button>
      <span class="footer-links">Connected to <code>${GITHUB_REPO}</code></span>
    `
    $('btn-disconnect').onclick = () => {
      post({ type: 'clear-token' })
    }
    return
  }

  toolbar.innerHTML = `
    <button type="button" class="ghost" id="btn-connect-toggle">Connect GitHub</button>
  `
  $('btn-connect-toggle').onclick = () => {
    authOpen = !authOpen
    renderAuthForm()
  }

  if (authOpen) {
    renderAuthForm()
  } else {
    panel.classList.add('hidden')
    panel.innerHTML = ''
  }
}

function renderAuthForm(): void {
  const panel = $('auth-panel')
  if (!authOpen || token) {
    panel.classList.add('hidden')
    panel.innerHTML = ''
    return
  }

  panel.classList.remove('hidden')
  panel.innerHTML = `
    <div class="staged-header" style="margin-bottom:0.65rem">
      <strong>Connect GitHub</strong>
      <button type="button" class="ghost" id="btn-auth-close" aria-label="Close">×</button>
    </div>
    <p>
      Paste a fine-grained or classic PAT with
      <code>contents: write</code> and <code>actions: write</code> on this repo.
      Stored in Figma <code>clientStorage</code> on this machine.
    </p>
    <label class="field">
      <span>Personal access token</span>
      <input type="password" id="pat" placeholder="ghp_… or github_pat_…" autocomplete="off" />
    </label>
    <button type="button" class="ghost accent" id="btn-connect">Save token</button>
  `
  $('btn-auth-close').onclick = () => {
    authOpen = false
    renderAuth()
  }
  $('btn-connect').onclick = () => {
    const value = ($('pat') as HTMLInputElement).value.trim()
    if (!value) {
      setMessage(
        'Paste a GitHub PAT with contents:write and actions:write.',
        true,
      )
      return
    }
    post({ type: 'set-token', token: value })
  }
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
      { value: 'mono', label: 'Monochrome' },
      { value: 'preserved', label: 'Multi-color' },
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

function renderStaged(): void {
  const body = $('staged-body')
  body.innerHTML = ''

  if (staged.length === 0) {
    const p = document.createElement('p')
    p.className = 'staged-empty'
    p.textContent = token
      ? 'No staged icons.'
      : 'Connect GitHub to list staged icons.'
    body.appendChild(p)
    updateActionButtons()
    return
  }

  const list = document.createElement('ul')
  list.className = 'staged-list'
  for (const item of staged) {
    const li = document.createElement('li')
    const code = document.createElement('code')
    code.textContent = `gv:${item.name}`
    const span = document.createElement('span')
    span.textContent =
      item.colorMode === 'preserved' ? 'multi-color' : 'mono'
    li.appendChild(code)
    li.appendChild(span)
    list.appendChild(li)
  }
  body.appendChild(list)
  updateActionButtons()
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
    const payload = icons.map((icon) => {
      const name = sanitizeIconName(icon.name)
      if (!name) {
        throw new Error(
          `Invalid icon name "${icon.name}". Use kebab-case, e.g. billing-alert.`,
        )
      }
      return { name, content: icon.content, colorMode: icon.colorMode }
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
  busy = true
  updateActionButtons()
  setMessage('')
  try {
    const readiness = await withAuthClear(() =>
      getClient().getPublishReadiness(),
    )

    if (readiness.stagedCount > 0) {
      const ok = window.confirm(
        `${readiness.stagedCount} icon(s) are still in staging and will not be included in this publish.\n\nApply staged icons to the library first if you want them shipped.\n\nPublish package versions anyway?`,
      )
      if (!ok) return
    } else if (!readiness.hasNewIcons) {
      const ok = window.confirm(
        'No new custom SVGs have been applied to the library since the last publish.\n\nPublishing now will only bump package versions — there are no new icons for consumers.\n\nPublish anyway?',
      )
      if (!ok) return
    } else {
      const ok = window.confirm(
        'Bump patch versions and publish all packages to GitHub Packages?',
      )
      if (!ok) return
    }

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
      authOpen = false
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

setLinks()
renderAuth()
updateActionButtons()
renderStaged()
post({ type: 'ui-ready' })
