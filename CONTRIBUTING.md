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
3. Select icon frame(s)/component(s) → **Load selection** → edit kebab names → choose **Mono** or **Multi** → **Send to icon browser**.
4. In the [icon browser](https://JasonTuTu2.github.io/icons-library/): **Connect GitHub** (session PAT) → **Add to staging** → **Apply staged to library** → **Publish** when releasing packages.

The plugin never talks to GitHub — it only opens the browser with your SVGs (or downloads `gv-icons-handoff.json` if the payload is too large for a URL). Override the browser URL at build time with `ICON_BROWSER_URL=…`.

### Pages icon browser

1. **Connect GitHub** — session PAT (`contents: write` + `actions: write`); not embedded in the site.
2. **Add to staging** — shared `packages/custom-icons/staging/` via Contents API (no Action; multiple people can stage).
3. **Apply staged to library** — dispatches an Action (uses secret `ICON_BROWSER_TOKEN` for the push) that promotes whatever is staged now, regenerates the catalog, clears staging.
4. **Publish** — check unpublished icons to include (unchecked stay out of the package, then return to the library as unpublished), then dispatch publish.

To **remove** a custom icon: open it in the browser → **Stage removal** → **Apply staged to library** → **Publish**. Removals are shared markers under `packages/custom-icons/staging/remove/`; Apply deletes the SVG from the library.

### First publish (happy path)

1. **Connect GitHub** in the icon browser.
2. **Add to staging** (from Upload SVG, or via the Figma plugin handoff) → **Apply staged to library**.
3. Open [Actions](https://github.com/JasonTuTu2/icons-library/actions) — wait ~1–2 minutes for Apply + Pages, then hard-refresh the browser.
4. Open **Upload SVG**, review **In library (unpublished)**, leave checked what should ship.
5. Click **Publish** → wait for the publish workflow → packages appear under GitHub Packages.

### Monochrome (recolorable) — local / git

1. Export a monochrome SVG from Figma (or use the plugin / browser to stage).
2. Save as `packages/custom-icons/svg/kebab-name.svg` (or stage/apply / `pnpm dev` upload).
3. Run `pnpm catalog:gen` if you added files via git.
4. Commit the SVG, `packages/custom-icons/src/collection.json`, and `packages/catalog/src/data/icons.json` (Pages Apply does this in CI).

### Multi-color (preserved fills)

1. Export a multi-color SVG from Figma (or use the plugin / browser with Multi-color mode).
2. Save as `packages/custom-icons/svg/color/kebab-name.svg` (or stage/apply with Multi-color mode).
3. Run `pnpm catalog:gen` if via git.

Do not reuse a kebab name that already exists in the other folder.


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

**Security:** Pages and the Figma plugin do **not** embed write tokens. Maintainers connect a PAT in the icon browser session; Apply/Publish Action jobs use the `ICON_BROWSER_TOKEN` repo secret. Optional variable `ICON_BROWSER_REPO` overrides the baked `owner/repo` for Pages.

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@JasonTuTu2/icons-core`.
- Do not vendor upstream Ant/Iconify SVG artwork into GenVoice packages.
- Custom brand SVGs belong in `@JasonTuTu2/icons-custom` only.
- Prefer ESM, `sideEffects: false` (except custom register entry points), and peer dependencies for Ant Design / Iconify.
- Update the catalog generator when adding Iconify collections.
