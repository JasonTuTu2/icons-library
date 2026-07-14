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

Preferred: use **Upload SVG** on the [GitHub Pages icon browser](https://JasonTuTu2.github.io/icons-library/) (requires `ICON_BROWSER_TOKEN` secret). That commits to `main` via Actions — no PR.

### Monochrome (recolorable) — local / git

1. Export a monochrome SVG from Figma.
2. Save as `packages/custom-icons/svg/kebab-name.svg` (or upload with Monochrome mode in `pnpm dev` / Pages).
3. Run `pnpm catalog:gen` if you added files via git.
4. Commit the SVG, `packages/custom-icons/src/collection.json`, and `packages/catalog/src/data/icons.json` (Pages upload does this in CI).

### Multi-color (preserved fills)

1. Export a multi-color SVG from Figma.
2. Save as `packages/custom-icons/svg/color/kebab-name.svg` (or upload with Multi-color mode).
3. Run `pnpm catalog:gen` if via git.

Do not reuse a kebab name that already exists in the other folder.

## Releases

Packages publish to **GitHub Packages** under the `@JasonTuTu2` scope when someone clicks **Publish** in the icon browser (`.github/workflows/publish-packages.yml`), or via manual workflow dispatch. Uploading icons does not publish packages by itself.

Manual publish (local):

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm version-packages
pnpm release
```

Consumers need `.npmrc` pointing `@JasonTuTu2` at GitHub Packages and a token with `read:packages` — see the README.

`@JasonTuTu2/icons-web` and `@JasonTuTu2/catalog-gen` stay private and are not published.

**Security note:** the Pages build embeds `ICON_BROWSER_TOKEN` so the public UI can call GitHub. Until auth is added, treat upload/publish as open to anyone with the site URL.

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@JasonTuTu2/icons-core`.
- Do not vendor upstream Ant/Iconify SVG artwork into GenVoice packages.
- Custom brand SVGs belong in `@JasonTuTu2/icons-custom` only.
- Prefer ESM, `sideEffects: false` (except custom register entry points), and peer dependencies for Ant Design / Iconify.
- Update the catalog generator when adding Iconify collections.
