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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --navy: #0b1f5c;
      --navy-dark: #071436;
      --blue: #1ea7ff;
      --blue-hover: #1590e0;
      --blue-soft: #e8f4ff;
      --bg: #f4f6fa;
      --surface: #ffffff;
      --ink: #0b1f5c;
      --muted: #5c6b8a;
      --line: #e2e8f0;
      --line-strong: #cbd5e1;
      --accent: #1ea7ff;
      --accent-soft: #e8f4ff;
      --danger: #dc2626;
      --danger-soft: #fef2f2;
      --shadow-sm: 0 1px 2px rgba(11, 31, 92, 0.05);
      --shadow: 0 4px 16px rgba(11, 31, 92, 0.08);
      --radius: 12px;
      --radius-sm: 8px;
      --font: "Inter", "Segoe UI", system-ui, sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
      --transition: 0.18s ease;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font: 12.5px/1.45 var(--font);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      background:
        radial-gradient(ellipse 80% 50% at 0% 0%, rgba(30, 167, 255, 0.07), transparent 50%),
        linear-gradient(180deg, #eef2f8 0%, var(--bg) 100%);
      min-height: 100%;
    }
    a {
      color: var(--blue);
      transition: color var(--transition);
    }
    a:hover { color: var(--blue-hover); }
    code { font-family: var(--mono); font-size: 0.92em; }
    h1 {
      margin: 0 0 2px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--navy);
    }
    .sub {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 10px;
    }
    .panel {
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      margin-bottom: 10px;
      box-shadow: var(--shadow);
    }
    .lede {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .field span {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 600;
    }
    .field input {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      font: inherit;
      font-weight: 500;
      background: var(--surface);
      color: var(--ink);
      width: 100%;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .field input:focus {
      outline: none;
      border-color: rgba(30, 167, 255, 0.55);
      box-shadow: 0 0 0 3px rgba(30, 167, 255, 0.12);
    }
    .ghost {
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--ink);
      transition:
        border-color var(--transition),
        color var(--transition),
        background var(--transition),
        box-shadow var(--transition),
        transform var(--transition);
    }
    .ghost:hover:not(:disabled) {
      border-color: rgba(30, 167, 255, 0.45);
      color: var(--blue);
      background: var(--accent-soft);
      box-shadow: var(--shadow-sm);
    }
    .ghost:active:not(:disabled) {
      transform: scale(0.98);
    }
    .ghost.accent {
      background: linear-gradient(180deg, var(--blue) 0%, var(--blue-hover) 100%);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 2px 6px rgba(30, 167, 255, 0.3);
    }
    .ghost.accent:hover:not(:disabled) {
      background: linear-gradient(180deg, #38b5ff 0%, var(--blue) 100%);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 3px 10px rgba(30, 167, 255, 0.35);
    }
    .ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
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
      padding: 5px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--bg);
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
      background: var(--surface);
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .upload-list input:focus {
      outline: none;
      border-color: rgba(30, 167, 255, 0.55);
      box-shadow: 0 0 0 2px rgba(30, 167, 255, 0.12);
    }
    .upload-list .color-mode-select {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 4px;
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      background: var(--surface);
      color: var(--ink);
    }
    .section {
      margin-top: 12px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .section-head strong {
      font-size: 12px;
      font-weight: 700;
      color: var(--navy);
    }
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
      gap: 4px;
      max-height: 7rem;
      overflow: auto;
    }
    .staged-list li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      padding: 4px 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .staged-list span { color: var(--muted); font-weight: 500; }
    .links {
      margin: 0;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.5;
    }
    .toast {
      margin: 8px 0 0;
      color: var(--blue);
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
