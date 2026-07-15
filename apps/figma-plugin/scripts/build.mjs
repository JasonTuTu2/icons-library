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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f3efe6;
      --surface: #fffdf8;
      --ink: #1c2430;
      --muted: #5b6675;
      --line: #d7d0c3;
      --accent: #0f6e56;
      --accent-soft: #d8efe7;
      --danger: #9b2c2c;
      --font: "DM Sans", "Segoe UI", sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font: 12.5px/1.45 var(--font);
      color: var(--ink);
      background: var(--bg);
      min-height: 100%;
    }
    a { color: var(--accent); }
    code { font-family: var(--mono); font-size: 0.92em; }
    h1 {
      margin: 0 0 2px;
      font-size: 15px;
      font-weight: 700;
    }
    .sub {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 10px;
    }
    .panel {
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      margin-bottom: 10px;
    }
    .lede {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .field span {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }
    .field input {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      font: inherit;
      background: #fff;
      color: var(--ink);
      width: 100%;
    }
    .ghost {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 8px;
      padding: 5px 10px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--ink);
    }
    .ghost:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
    }
    .ghost.accent {
      background: var(--accent-soft);
      border-color: rgba(15, 110, 86, 0.3);
      color: var(--accent);
    }
    .ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }
    .hint {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .upload-list {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: grid;
      gap: 6px;
      max-height: 11rem;
      overflow: auto;
    }
    .upload-list li {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) 5.25rem auto;
      gap: 6px;
      align-items: center;
    }
    .upload-list img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    .upload-list label {
      display: flex;
      align-items: center;
      gap: 2px;
      font-family: var(--mono);
      font-size: 11px;
      margin: 0;
      min-width: 0;
    }
    .upload-list input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 4px 6px;
      font: inherit;
      background: #fff;
    }
    .upload-list .color-mode-select {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 4px;
      font: inherit;
      font-size: 11px;
      background: #fff;
      color: var(--ink);
    }
    .section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .section-head strong { font-size: 12px; }
    .empty {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }
    .staged-list {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: grid;
      gap: 3px;
      max-height: 7rem;
      overflow: auto;
    }
    .staged-list li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
    }
    .staged-list span { color: var(--muted); }
    .links {
      margin: 0;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.5;
    }
    .toast {
      margin: 8px 0 0;
      color: var(--accent);
      font-weight: 600;
      font-size: 12px;
      word-break: break-word;
    }
    .toast.error { color: var(--danger); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>GenVoice Icons</h1>
  <p class="sub">Stage icons from Figma</p>

  <div class="toolbar" id="auth-toolbar"></div>
  <div class="panel hidden" id="auth-panel"></div>

  <div class="panel">
    <p class="lede">Load a selection, set Mono or Multi per icon, then stage. Apply and publish in the icon browser.</p>
    <p class="hint" id="selection-hint">Select frames, then load selection.</p>
    <div class="row">
      <button type="button" class="ghost" id="btn-export">Load selection</button>
      <button type="button" class="ghost accent" id="btn-stage" disabled>Add to staging</button>
    </div>
    <ul class="upload-list" id="icon-list"></ul>

    <div class="section">
      <div class="section-head">
        <strong>Staged on GitHub</strong>
        <button type="button" class="ghost" id="btn-refresh" disabled>Refresh</button>
      </div>
      <div id="staged-body"></div>
      <p class="links">
        Continue in the
        <a id="link-browser" href="https://JasonTuTu2.github.io/icons-library/" target="_blank" rel="noreferrer">icon browser</a>
        to apply and publish.
        <br />
        <a id="link-actions" href="#" target="_blank" rel="noreferrer">Actions</a>
        ·
        <a id="link-packages" href="#" target="_blank" rel="noreferrer">Packages</a>
      </p>
    </div>
  </div>

  <p class="toast" id="message"></p>
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
