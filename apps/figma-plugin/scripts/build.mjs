import * as esbuild from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const watch = process.argv.includes('--watch')
const githubRepo =
  process.env.GITHUB_REPO?.trim() || 'JasonTuTu2/icons-library'

mkdirSync(join(root, 'dist'), { recursive: true })

const shared = {
  bundle: true,
  target: 'es2017',
  logLevel: 'info',
  define: {
    __GITHUB_REPO__: JSON.stringify(githubRepo),
  },
}

/** @type {import('esbuild').BuildOptions} */
const codeOptions = {
  ...shared,
  entryPoints: [join(root, 'src/code.ts')],
  outfile: join(root, 'dist/code.js'),
  format: 'iife',
  platform: 'browser',
}

/** @type {import('esbuild').BuildOptions} */
const uiOptions = {
  ...shared,
  entryPoints: [join(root, 'src/ui.ts')],
  outfile: join(root, 'dist/ui.js'),
  format: 'iife',
  platform: 'browser',
}

async function writeUiHtml() {
  const uiJs = readFileSync(join(root, 'dist/ui.js'), 'utf8')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      --bg: #f5f5f5;
      --surface: #fff;
      --text: #1a1a1a;
      --muted: #666;
      --border: #ddd;
      --accent: #0b5fff;
      --danger: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 12px/1.4 Inter, system-ui, sans-serif;
      color: var(--text);
      background: var(--bg);
      padding: 12px;
    }
    h1 { font-size: 14px; margin: 0 0 8px; }
    h2 { font-size: 12px; margin: 16px 0 8px; font-weight: 600; }
    p, .hint { color: var(--muted); margin: 0 0 8px; }
    button {
      font: inherit;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 6px;
      padding: 6px 10px;
    }
    button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
    }
    label { display: block; margin-bottom: 4px; }
    input[type="password"], input[type="text"] {
      width: 100%;
      font: inherit;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .icon-list { list-style: none; margin: 0; padding: 0; }
    .icon-list li {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .icon-list li:last-child { border-bottom: none; }
    .preview {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      background: #f0f0f0;
      border-radius: 4px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .preview img { max-width: 24px; max-height: 24px; }
    .icon-list input[type="text"] { margin: 0; flex: 1; }
    .message { margin-top: 8px; word-break: break-word; }
    .message.error { color: var(--danger); }
    .staged { font-size: 11px; }
    .staged li { padding: 2px 0; border: none; display: block; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <h1>GenVoice Icons</h1>
  <p class="hint">Select frames/components, then stage to GitHub. Apply regenerates the library; Publish releases packages.</p>

  <div class="panel" id="auth-panel"></div>

  <div class="panel">
    <div class="row">
      <button type="button" id="btn-export">Load selection</button>
      <label style="display:flex;align-items:center;gap:4px;margin:0">
        <input type="radio" name="colorMode" value="mono" checked /> Mono
      </label>
      <label style="display:flex;align-items:center;gap:4px;margin:0">
        <input type="radio" name="colorMode" value="preserved" /> Multi-color
      </label>
    </div>
    <ul class="icon-list" id="icon-list"></ul>
    <div class="row">
      <button type="button" class="primary" id="btn-stage" disabled>Stage</button>
    </div>
  </div>

  <div class="panel">
    <h2>Staged on main</h2>
    <div class="row">
      <button type="button" id="btn-refresh" disabled>Refresh</button>
      <button type="button" class="primary" id="btn-apply" disabled>Apply staged</button>
      <button type="button" id="btn-publish" disabled>Publish</button>
    </div>
    <ul class="icon-list staged" id="staged-list"></ul>
    <p class="hint"><a id="link-actions" href="#" target="_blank" rel="noreferrer">Actions</a> · <a id="link-packages" href="#" target="_blank" rel="noreferrer">Packages</a></p>
  </div>

  <p class="message" id="message"></p>
  <script>${uiJs}</script>
</body>
</html>
`
  writeFileSync(join(root, 'dist/ui.html'), html)
}

async function buildOnce() {
  await Promise.all([
    esbuild.build(codeOptions),
    esbuild.build(uiOptions),
  ])
  await writeUiHtml()
}

if (watch) {
  const ctxCode = await esbuild.context(codeOptions)
  const ctxUi = await esbuild.context({
    ...uiOptions,
    plugins: [
      {
        name: 'write-ui-html',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length === 0) await writeUiHtml()
          })
        },
      },
    ],
  })
  await Promise.all([ctxCode.watch(), ctxUi.watch()])
  console.log('Watching figma plugin…')
} else {
  await buildOnce()
}
