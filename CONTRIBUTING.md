# Contributing

## Setup

1. Node 18+
2. Enable pnpm (`npm i -g pnpm@9` or Corepack)
3. `pnpm install`
4. `pnpm catalog:gen` — regenerate icon metadata + custom `gv` collection and rebuild packages
5. `pnpm build`

## Scripts

- `pnpm dev` — icon browser (local SVG upload to disk)
- `pnpm --filter @JasonTuTu2/icons-figma dev` — watch-build the Figma plugin
- `pnpm test` — unit tests
- `pnpm typecheck` — TypeScript across packages
- `pnpm catalog:gen` — rebuild catalog JSON, custom collection, and package `dist/` outputs

## Adding a custom icon

Preferred for designers: the **GenVoice Icons Figma plugin** (export from the canvas into the icon browser). Alternative: upload SVGs directly in the [GitHub Pages icon browser](https://JasonTuTu2.github.io/icons-library/).

### Figma plugin

1. Build once: `pnpm --filter @JasonTuTu2/icons-figma build` (or `… dev` while iterating).
2. In Figma Desktop: **Plugins → Development → Import plugin from manifest…** → select `apps/figma-plugin/manifest.json`.
3. The plugin panel loads the live icon browser. Select icon frame(s)/component(s) → **Load selection** → edit kebab names / Mono·Multi → **Stage**.
4. Open the full icon browser with a magic-URL PAT (see below) → **Apply staged to library** → **Publish** when releasing packages.

The plugin exports SVGs/images into the embedded Pages panel (`figma.html`). **Stage** saves the queue in **figma.clientStorage** (plugin main thread, not iframe web storage). **Open icon browser** posts a short-lived handoff to the auth Worker → site IndexedDB for Apply. **Re-import the Development plugin** from `apps/figma-plugin/dist` after pulling plugin changes (Figma → Plugins → Development → Import manifest from `dist/manifest.json`). Override the browser URL at build time with `ICON_BROWSER_URL=…` (e.g. `http://localhost:5173/` for local); set `PANEL_CACHE_VERSION` if you need to bust Figma’s cached panel without a new git SHA.

### Dev: Apply & Publish

**Preferred:** deploy `apps/auth-api` (Cloudflare Worker) and set repo variable `AUTH_API_URL`. The icon browser and Figma plugin require **Sign in**; after that, Apply / Publish / metadata edits use the Worker — no personal PAT:

- **designer** — Browse, Stage locally, Apply, metadata
- **dev** — Same + Publish

See [`apps/auth-api/README.md`](apps/auth-api/README.md) for secrets and deploy steps. Redeploy the Worker whenever its routes change.

**Local / legacy** (when `AUTH_API_URL` / `VITE_AUTH_API_URL` is unset): open the icon browser with a session PAT in the URL hash:

```
https://JasonTuTu2.github.io/icons-library/#gv-github-token=ghp_YOUR_PAT
```

The app stores the token in `sessionStorage` for that tab and strips it from the address bar. Create a classic PAT with **`contents: write`** + **`actions: write`**. Locally, `VITE_GITHUB_TOKEN` in `.env.local` also unlocks admin features during `pnpm dev`.

### Pages icon browser

1. **Add to staging** — local to this browser/plugin until Apply. From Figma: **Load selection** → **Stage**. From the full browser Upload: SVG and/or PNG/JPG.
2. **Apply staged to library** (Sign in as designer or dev) — uploads the local queue, dispatches an Action (uses secret `ICON_BROWSER_TOKEN` for the push) that promotes staging, regenerates the catalog, clears remote staging.
3. **Publish** (Sign in as **dev**) — check unpublished icons/images to include (unchecked stay out of the package, then return to the library as unpublished), then dispatch publish.

To **remove** a custom SVG or brand image: open it in the browser → **Stage removal** → **Apply staged to library** → **Publish**.

### Brand images (PNG / JPG)

Parallel to SVG icons — same stage → apply → publish flow, but **not** Iconify / `<Icon />`:

- Catalog id: `img:kebab-name`
- Library path: `packages/custom-icons/images/`
- Staging: `packages/custom-icons/staging/images/`
- Consumers: `import url from '@JasonTuTu2/icons-custom/images/name.png'` then `<img src={url} />`
- Figma plugin does **not** export rasters — use the full icon browser Upload panel

### First publish (happy path)

1. **Stage** (Figma **Load selection** → **Stage**, or Upload SVG/PNG/JPG) → **Apply staged to library**.
2. Open [Actions](https://github.com/JasonTuTu2/icons-library/actions) — wait ~1–2 minutes for Apply + Pages, then hard-refresh the browser.
3. Open **Upload**, review **In library (unpublished)**, leave checked what should ship.
4. Click **Publish** → wait for the publish workflow → packages appear under GitHub Packages.

### Monochrome (recolorable) — local / git

1. Export a monochrome SVG from Figma (or use the plugin / browser to stage).
2. Save as `packages/custom-icons/svg/kebab-name.svg` (or stage/apply / `pnpm dev` upload).
3. Run `pnpm catalog:gen` if you added files via git.
4. Commit the SVG, `packages/custom-icons/src/collection.json`, and `packages/catalog/src/data/icons.json` (Pages Apply does this in CI).

### Multi-color (preserved fills)

1. Export a multi-color SVG from Figma (or use the plugin / browser with Multi-color mode).
2. Save as `packages/custom-icons/svg/color/kebab-name.svg` (or stage/apply with Multi-color mode).
3. Run `pnpm catalog:gen` if via git.

### Gradient

1. Export an SVG that uses linear/radial gradients (plugin / browser **Gradient** mode).
2. Save as `packages/custom-icons/svg/gradient/kebab-name.svg` (or stage/apply with Gradient).
3. Run `pnpm catalog:gen` if via git. Gradient defs and `url(#…)` fills are kept; `<Icon color>` will not recolor them.

Do not reuse a kebab name that already exists as mono SVG, color SVG, gradient SVG, or brand image.


## Releases

Packages publish to **GitHub Packages** under the `@JasonTuTu2` scope when someone clicks **Publish** in the icon browser (`.github/workflows/publish-packages.yml`), or via manual workflow dispatch. The Figma plugin only exports into the browser — staging, Apply, and Publish happen there. Staging and Apply do not publish packages by themselves.

Manual publish (local):

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm version-packages
pnpm release
```

Consumers need `.npmrc` pointing `@JasonTuTu2` at GitHub Packages and a token with `read:packages` — see the README.

`@JasonTuTu2/icons-web`, `@JasonTuTu2/icons-figma`, `@JasonTuTu2/github-admin`, and `@JasonTuTu2/catalog-gen` stay private and are not published.

**Security:** The Pages build embeds `ICON_BROWSER_TOKEN` so anyone on the icon browser can **stage**. Apply/Publish require a personal PAT via the magic URL (or local `.env`). Action jobs still use the repo secret for the actual push/publish. Ensure both the baked secret and personal PATs have `contents: write` + `actions: write`. Optional variable `ICON_BROWSER_REPO` overrides the baked `owner/repo` for Pages.

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@JasonTuTu2/icons-core`.
- Do not vendor third-party icon set artwork into published packages.
- Custom brand SVGs belong in `@JasonTuTu2/icons-custom` only.
- Prefer ESM, `sideEffects: false` (except custom register entry points), and peer dependencies for the Iconify render packages used by brand SVGs.
