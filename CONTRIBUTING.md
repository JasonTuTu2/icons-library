# Contributing

## Setup

1. Node 18+
2. Enable pnpm (`npm i -g pnpm@9` or Corepack)
3. `pnpm install`
4. `pnpm catalog:gen` — regenerate icon metadata + custom `gv` collection and rebuild packages
5. `pnpm build`

## Scripts

- `pnpm dev` — icon browser (supports custom SVG upload locally)
- `pnpm test` — unit tests
- `pnpm typecheck` — TypeScript across packages
- `pnpm catalog:gen` — rebuild catalog JSON, custom collection, and package `dist/` outputs

## Adding a custom icon (PR)

### Monochrome (recolorable)

1. Export a monochrome SVG from Figma.
2. Save as `packages/custom-icons/svg/kebab-name.svg` (or upload with Monochrome mode in `pnpm dev`).
3. Run `pnpm catalog:gen`.
4. Commit the SVG, `packages/custom-icons/src/collection.json`, and `packages/catalog/src/data/icons.json`.
5. Open a PR.

### Multi-color (preserved fills)

1. Export a multi-color SVG from Figma.
2. Save as `packages/custom-icons/svg/color/kebab-name.svg` (or upload with Multi-color mode).
3. Run `pnpm catalog:gen`.
4. Commit as above.

Do not reuse a kebab name that already exists in the other folder.

## Releases

Packages are published to **GitHub Packages** (`https://npm.pkg.github.com`) under the `@JasonTuTu2` scope. This repo uses [Changesets](https://github.com/changesets/changesets):

1. `pnpm changeset` (open a PR with the changeset file)
2. On merge to `main`, the Release workflow opens a version PR (or publishes if one is ready)
3. Merging the version PR runs `pnpm release` and publishes to GitHub Packages

Manual publish (local):

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm version-packages
pnpm release
```

Consumers need `.npmrc` pointing `@JasonTuTu2` at GitHub Packages and a token with `read:packages` — see the README.

`@JasonTuTu2/icons-web` and `@JasonTuTu2/catalog-gen` stay private and are not published.

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@JasonTuTu2/icons-core`.
- Do not vendor upstream Ant/Iconify SVG artwork into GenVoice packages.
- Custom brand SVGs belong in `@JasonTuTu2/icons-custom` only.
- Prefer ESM, `sideEffects: false` (except custom register entry points), and peer dependencies for Ant Design / Iconify.
- Update the catalog generator when adding Iconify collections.
