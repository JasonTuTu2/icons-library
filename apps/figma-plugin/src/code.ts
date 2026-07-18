import type {
  FigmaExportIcon,
  PluginToUiMessage,
  UiToPluginMessage,
} from './messages'

declare const __ICON_BROWSER_URL__: string

const browserBase = __ICON_BROWSER_URL__.replace(/\/?$/, '/')
// Dedicated minimal panel page — not the full icon browser.
const uiUrl = `${browserBase}figma.html`

// Navigate the plugin iframe to the Figma-only Pages entry.
figma.showUI(
  `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<script>window.location.href = ${JSON.stringify(uiUrl)};</script>
<p style="font:12px sans-serif;padding:12px;color:#5c6b8a">Loading…</p>
</body></html>`,
  { width: 380, height: 440, themeColors: true },
)

function post(msg: PluginToUiMessage): void {
  figma.ui.postMessage(msg)
}

function sanitizeLayerName(raw: string): string {
  return raw
    .replace(/\.(svg|png|jpe?g)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function bytesToSvgText(bytes: Uint8Array): string {
  // Figma main-thread sandbox has no TextDecoder; avoid spread for large SVGs.
  let content = ''
  for (let i = 0; i < bytes.length; i++) {
    content += String.fromCharCode(bytes[i]!)
  }
  return content
}

function nodeHasVisibleImageFill(node: SceneNode): boolean {
  if (!('fills' in node)) return false
  const fills = node.fills
  if (fills === figma.mixed) return false
  return fills.some(
    (paint) => paint.type === 'IMAGE' && paint.visible !== false,
  )
}

/**
 * Prefer PNG/`img:` when the selection is (or wraps) a placed raster.
 * Vectors and shapes without image fills stay SVG/`ci:`.
 */
function shouldExportAsImage(node: SceneNode): boolean {
  if (nodeHasVisibleImageFill(node)) return true
  if ('children' in node && node.children.length === 1) {
    const child = node.children[0]!
    if (nodeHasVisibleImageFill(child)) return true
  }
  return false
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

  const icons: FigmaExportIcon[] = []
  const errors: string[] = []

  for (const node of selection) {
    try {
      const name = sanitizeLayerName(node.name) || node.name
      if (shouldExportAsImage(node)) {
        const bytes = await node.exportAsync({ format: 'PNG' })
        icons.push({
          id: node.id,
          name,
          content: figma.base64Encode(bytes),
          kind: 'image',
          format: 'png',
        })
      } else {
        const bytes = await node.exportAsync({ format: 'SVG' })
        icons.push({
          id: node.id,
          name,
          content: bytesToSvgText(bytes),
          kind: 'svg',
        })
      }
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
