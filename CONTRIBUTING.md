# Contributing

## Setup

1. Node 18+
2. Enable pnpm (`npm i -g pnpm@9` or Corepack)
3. `pnpm install`
4. `pnpm catalog:gen` — regenerate icon metadata + custom `gv` collection and rebuild packages
5. `pnpm build`

## Scripts

- `pnpm dev` — icon browser (local SVG upload to disk)
- `pnpm test` — unit tests
- `pnpm typecheck` — TypeScript across packages
- `pnpm catalog:gen` — rebuild catalog JSON, custom collection, and package `dist/` outputs

## Adding a custom icon

Preferred: use the [GitHub Pages icon browser](https://JasonTuTu2.github.io/icons-library/):

1. **Connect GitHub** — session PAT (`contents: write` + `actions: write`); not embedded in the site.
2. **Add to staging** — shared `packages/custom-icons/staging/` via Contents API (no Action; multiple people can stage).
3. **Apply staged to library** — dispatches an Action (uses secret `ICON_BROWSER_TOKEN` for the push) that promotes whatever is staged now, regenerates the catalog, clears staging.

### Monochrome (recolorable) — local / git

1. Export a monochrome SVG from Figma.
2. Save as `packages/custom-icons/svg/kebab-name.svg` (or stage/apply / `pnpm dev` upload).
3. Run `pnpm catalog:gen` if you added files via git.
4. Commit the SVG, `packages/custom-icons/src/collection.json`, and `packages/catalog/src/data/icons.json` (Pages Apply does this in CI).

### Multi-color (preserved fills)

1. Export a multi-color SVG from Figma.
2. Save as `packages/custom-icons/svg/color/kebab-name.svg` (or stage/apply with Multi-color mode).
3. Run `pnpm catalog:gen` if via git.

Do not reuse a kebab name that already exists in the other folder.

## Releases

Packages publish to **GitHub Packages** under the `@JasonTuTu2` scope when someone clicks **Publish** in the icon browser (`.github/workflows/publish-packages.yml`), or via manual workflow dispatch. Staging and Apply do not publish packages by themselves.

Manual publish (local):

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm version-packages
pnpm release
```

Consumers need `.npmrc` pointing `@JasonTuTu2` at GitHub Packages and a token with `read:packages` — see the README.

`@JasonTuTu2/icons-web` and `@JasonTuTu2/catalog-gen` stay private and are not published.

**Security:** Pages does **not** embed write tokens. Maintainers connect a session PAT in the browser; Apply/Publish Action jobs use the `ICON_BROWSER_TOKEN` repo secret. Optional variable `ICON_BROWSER_REPO` overrides the baked `owner/repo`.

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@JasonTuTu2/icons-core`.
- Do not vendor upstream Ant/Iconify SVG artwork into GenVoice packages.
- Custom brand SVGs belong in `@JasonTuTu2/icons-custom` only.
- Prefer ESM, `sideEffects: false` (except custom register entry points), and peer dependencies for Ant Design / Iconify.
- Update the catalog generator when adding Iconify collections.
