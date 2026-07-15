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
      --bg-elevated: #fffdf8;
      --ink: #1c2430;
      --muted: #5b6675;
      --line: #d7d0c3;
      --accent: #0f6e56;
      --accent-soft: #d8efe7;
      --danger: #9b2c2c;
      --shadow: 0 12px 28px rgba(28, 36, 48, 0.08);
      --radius: 14px;
      --font: "DM Sans", "Segoe UI", sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 12.5px/1.45 var(--font);
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15, 110, 86, 0.12), transparent 40%),
        linear-gradient(180deg, #efe8db 0%, var(--bg) 45%, #ebe4d7 100%);
      padding: 12px;
      min-height: 100%;
    }
    a { color: var(--accent); }
    code { font-family: var(--mono); font-size: 0.92em; }
    .brand {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .brand-mark {
      width: 2.1rem;
      height: 2.1rem;
      border-radius: 0.7rem;
      flex-shrink: 0;
      background: linear-gradient(135deg, #0f6e56, #1f9d7a 55%, #f0c75e);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
    }
    .brand strong {
      display: block;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .brand p {
      margin: 0.12rem 0 0;
      color: var(--muted);
      font-size: 0.78rem;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .panel {
      padding: 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-elevated);
      box-shadow: var(--shadow);
      margin-bottom: 0.75rem;
    }
    .panel > p, .lede {
      margin: 0 0 0.7rem;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin-bottom: 0.7rem;
    }
    .field span {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 600;
    }
    .field input,
    .field select {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.55rem 0.7rem;
      font: inherit;
      background: #fff;
      color: var(--ink);
      width: 100%;
    }
    .ghost {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font: inherit;
      font-size: 0.8rem;
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
      opacity: 0.55;
      cursor: not-allowed;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.35rem;
    }
    .upload-drop {
      display: grid;
      place-items: center;
      min-height: 3.5rem;
      border: 1px dashed var(--line);
      border-radius: 12px;
      padding: 0.7rem;
      color: var(--muted);
      margin-bottom: 0.7rem;
      text-align: center;
      font-size: 0.84rem;
    }
    .upload-list {
      list-style: none;
      margin: 0 0 0.7rem;
      padding: 0;
      display: grid;
      gap: 0.45rem;
      max-height: 10rem;
      overflow: auto;
    }
    .upload-list li {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      gap: 0.45rem;
      align-items: center;
    }
    .upload-list img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      background: #f3efe6;
      border-radius: 6px;
      border: 1px solid var(--line);
    }
    .upload-list label {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-family: var(--mono);
      font-size: 0.78rem;
      margin: 0;
    }
    .upload-list input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.3rem 0.45rem;
      font: inherit;
      background: #fff;
    }
    .staged-block {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--line);
      display: grid;
      gap: 0.55rem;
    }
    .staged-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .staged-header strong { font-size: 0.85rem; }
    .staged-empty {
      margin: 0;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .staged-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.3rem;
      max-height: 8rem;
      overflow: auto;
    }
    .staged-list li {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.78rem;
    }
    .staged-list span { color: var(--muted); }
    .footer-links {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .copy-toast {
      margin: 0.55rem 0 0;
      color: var(--accent);
      font-weight: 600;
      font-size: 0.8rem;
      word-break: break-word;
    }
    .copy-toast.error { color: var(--danger); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header class="brand">
    <div class="brand-mark" aria-hidden="true"></div>
    <div>
      <strong>GenVoice Icons</strong>
      <p>Stage · Apply · Publish from Figma</p>
    </div>
  </header>

  <div class="toolbar" id="auth-toolbar"></div>
  <div class="panel hidden" id="auth-panel"></div>

  <div class="panel">
    <p class="lede">Select frames or components, load them here, then stage to the shared GitHub folder. Apply promotes into the library; Publish releases packages.</p>
    <label class="field">
      <span>Color mode</span>
      <select id="color-mode">
        <option value="mono" selected>Monochrome (currentColor)</option>
        <option value="preserved">Multi-color (preserved)</option>
      </select>
    </label>
    <div class="upload-drop" id="selection-hint">Select icon frames, then load selection</div>
    <div class="actions">
      <button type="button" class="ghost" id="btn-export">Load selection</button>
    </div>
    <ul class="upload-list" id="icon-list"></ul>
    <div class="actions">
      <button type="button" class="ghost accent" id="btn-stage" disabled>Add to staging</button>
    </div>

    <div class="staged-block">
      <div class="staged-header">
        <strong>Staged on GitHub</strong>
        <button type="button" class="ghost" id="btn-refresh" disabled>Refresh</button>
      </div>
      <div id="staged-body"></div>
      <button type="button" class="ghost accent" id="btn-apply" disabled>Apply staged to library</button>
      <button type="button" class="ghost accent" id="btn-publish" disabled>Publish</button>
      <p class="footer-links"><a id="link-actions" href="#" target="_blank" rel="noreferrer">Actions</a> · <a id="link-packages" href="#" target="_blank" rel="noreferrer">Packages</a></p>
    </div>
  </div>

  <p class="copy-toast" id="message"></p>
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
