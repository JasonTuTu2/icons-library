import type { PluginToUiMessage, UiToPluginMessage } from './messages'

figma.showUI(__html__, { width: 360, height: 480, themeColors: true })

function post(msg: PluginToUiMessage): void {
  figma.ui.postMessage(msg)
}

function sanitizeLayerName(raw: string): string {
  return raw
    .replace(/\.svg$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function exportSelection(): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    post({
      type: 'export-result',
      icons: [],
      error: 'Select one or more frames, components, or vectors first.',
    })
    return
  }

  const icons: Array<{ id: string; name: string; content: string }> = []
  const errors: string[] = []

  for (const node of selection) {
    try {
      const bytes = await node.exportAsync({ format: 'SVG' })
      // Figma main-thread sandbox has no TextDecoder; avoid spread for large SVGs.
      let content = ''
      for (let i = 0; i < bytes.length; i++) {
        content += String.fromCharCode(bytes[i]!)
      }
      const name = sanitizeLayerName(node.name) || node.name
      icons.push({ id: node.id, name, content })
    } catch (err) {
      errors.push(
        `"${node.name}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  post({
    type: 'export-result',
    icons,
    error: errors.length > 0 ? errors.join(' ') : undefined,
  })
}

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  switch (msg.type) {
    case 'ui-ready': {
      post({ type: 'ready' })
      break
    }
    case 'export-selection': {
      await exportSelection()
      break
    }
    case 'open-url': {
      figma.openExternal(msg.url)
      break
    }
    case 'close': {
      figma.closePlugin()
      break
    }
    default:
      break
  }
}
