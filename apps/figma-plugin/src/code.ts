import type {
  FigmaAssetFormat,
  FigmaExportIcon,
  PluginToUiMessage,
  UiToPluginMessage,
} from './messages'

declare const __ICON_BROWSER_URL__: string
declare const __FIGMA_PANEL_QUERY__: string

const browserBase = __ICON_BROWSER_URL__.replace(/\/?$/, '/')
const panelQuery = String(__FIGMA_PANEL_QUERY__).replace(/^\?/, '')
const uiUrl = `${browserBase}figma.html${panelQuery ? `?${panelQuery}` : ''}`

// Navigate the plugin iframe to the Figma-only Pages entry.
figma.showUI(
  `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<script>window.location.href = ${JSON.stringify(uiUrl)};</script>
<p style="font:12px sans-serif;padding:12px;color:#5c6b8a">Loading…</p>
</body></html>`,
  { width: 540, height: 560, themeColors: true },
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

async function exportNodeAs(
  node: SceneNode,
  format: FigmaAssetFormat,
): Promise<FigmaExportIcon> {
  const name = sanitizeLayerName(node.name) || node.name
  if (format === 'svg') {
    const bytes = await node.exportAsync({ format: 'SVG' })
    return {
      id: node.id,
      name,
      content: bytesToSvgText(bytes),
      kind: 'svg',
    }
  }
  const bytes = await node.exportAsync({
    format: format === 'jpg' ? 'JPG' : 'PNG',
  })
  return {
    id: node.id,
    name,
    content: figma.base64Encode(bytes),
    kind: 'image',
    format,
  }
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
      const format: FigmaAssetFormat = shouldExportAsImage(node) ? 'png' : 'svg'
      icons.push(await exportNodeAs(node, format))
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

async function reexportNode(
  nodeId: string,
  format: FigmaAssetFormat,
): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId)
  if (!node || !('exportAsync' in node)) {
    post({
      type: 'reexport-result',
      error: 'That layer is no longer on the page. Load selection again.',
    })
    return
  }
  try {
    const icon = await exportNodeAs(node as SceneNode, format)
    post({ type: 'reexport-result', icon })
  } catch (err) {
    post({
      type: 'reexport-result',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function reexportNodes(
  exports: Array<{ nodeId: string; format: FigmaAssetFormat }>,
): Promise<void> {
  const icons: FigmaExportIcon[] = []
  const errors: string[] = []
  for (const item of exports) {
    const node = await figma.getNodeByIdAsync(item.nodeId)
    if (!node || !('exportAsync' in node)) {
      errors.push(`Missing layer ${item.nodeId}`)
      continue
    }
    try {
      icons.push(await exportNodeAs(node as SceneNode, item.format))
    } catch (err) {
      errors.push(
        `"${node.name}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  post({
    type: 'reexport-batch-result',
    icons,
    error: errors.length > 0 ? errors.join(' ') : undefined,
  })
}

function appendUrlHash(url: string, hashPart: string | undefined): string {
  if (!hashPart?.trim()) return url
  return url.includes('#') ? `${url}&${hashPart}` : `${url}#${hashPart}`
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
    case 'reexport-node': {
      await reexportNode(msg.nodeId, msg.format)
      break
    }
    case 'reexport-nodes': {
      await reexportNodes(msg.exports)
      break
    }
    case 'open-url': {
      figma.openExternal(msg.url)
      break
    }
    case 'open-icon-browser': {
      const base = msg.baseUrl.replace(/\/?$/, '/')
      const url = appendUrlHash(
        `${base}${base.includes('?') ? '&' : '?'}gv-upload=1`,
        msg.authHandoff,
      )
      figma.openExternal(url)
      post({ type: 'open-browser-done', url })
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
