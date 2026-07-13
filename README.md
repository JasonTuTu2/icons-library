# GenVoice Icons

Unified icon library and browser for **Ant Design Icons**, **Iconify**, and **GenVoice custom SVGs**, with a consistent API for **React** and **Vue**.

## Packages

| Package | Description |
|---------|-------------|
| `@JasonTuTu2/icons-core` | Shared types, name parsing, size & a11y helpers |
| `@JasonTuTu2/icons-catalog` | Icon metadata + search helpers for the browser |
| `@JasonTuTu2/icons-react` | React `<Icon>` component |
| `@JasonTuTu2/icons-vue` | Vue 3 `<Icon>` component |
| `@JasonTuTu2/icons-custom` | GenVoice brand SVGs + `registerCustomIcons()` |
| `@JasonTuTu2/icons-web` | Icon browser + docs (private app) |

## Quick start

```bash
pnpm install
pnpm catalog:gen
pnpm build
pnpm dev
```

### Install from GitHub Packages

Packages are published to [GitHub Packages](https://github.com/JasonTuTu2?tab=packages) (not the public npm registry). You need read access to this repo (or the packages), then authenticate with a GitHub token that has `read:packages`.

In the consuming app, add `.npmrc`:

```ini
@JasonTuTu2:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Set `NODE_AUTH_TOKEN` to a [personal access token](https://github.com/settings/tokens) with `read:packages` (and authorize SSO if your org requires it). In GitHub Actions, use `${{ secrets.GITHUB_TOKEN }}` with `packages: read`.

### React

```bash
pnpm add @JasonTuTu2/icons-react @JasonTuTu2/icons-custom @ant-design/icons @iconify/react
```

```tsx
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/react'
import { Icon } from '@JasonTuTu2/icons-react'

registerCustomIcons()

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />
```

### Vue

```bash
pnpm add @JasonTuTu2/icons-vue @JasonTuTu2/icons-custom @ant-design/icons-vue @iconify/vue
```

```vue
<script setup>
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/vue'
import { Icon } from '@JasonTuTu2/icons-vue'

registerCustomIcons()
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
  <Icon name="gv:star" :size="24" label="Favorite" />
</template>
```

## Canonical names

- Ant Design: `ant:HomeOutlined`
- Iconify: `mdi:home`, `lucide:settings`, `heroicons:home`
- GenVoice custom: `gv:billing-alert` (from `packages/custom-icons/svg/billing-alert.svg`)

## Custom icons from Figma

1. Export SVG from Figma (prefer 24×24).
2. Add via **Upload SVG** in the browser (`pnpm dev`), choosing **Monochrome** or **Multi-color**, or commit files:
   - Monochrome: `packages/custom-icons/svg/kebab-name.svg`
   - Multi-color: `packages/custom-icons/svg/color/kebab-name.svg`
3. Run `pnpm catalog:gen` after git adds (upload regenerates + rebuilds packages automatically).
4. Use `gv:kebab-name` and call `registerCustomIcons()` once at bootstrap.

Monochrome SVGs are rewritten to `currentColor` (the `color` prop works). Multi-color SVGs keep their fills; `color` may not recolor them. Names are shared across both folders — do not reuse the same kebab name.

## Offline Iconify

```ts
import { addCollection } from '@iconify/react' // or @iconify/vue
import mdi from '@iconify-json/mdi/icons.json'

addCollection(mdi)
```

## Licensing

GenVoice packages are **MIT**. Icon artwork remains under upstream licenses (Ant Design Icons MIT; Iconify collections vary). Custom `gv:` icons are GenVoice proprietary / internal unless noted. Always check the icon detail panel in the browser.

## Development

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm changeset
```

## Compatibility

| Package | Peers |
|---------|--------|
| React | `react` 18+, `@ant-design/icons` ^5–6, `@iconify/react` ^5–6 |
| Vue | `vue` 3.3+, `@ant-design/icons-vue` ^7, `@iconify/vue` ^4–5 |
| Custom | `@iconify/react` and/or `@iconify/vue` |

## Publishing

Packages publish to GitHub Packages via Changesets when release PRs merge to `main` (see `.github/workflows/release.yml`).

Local publish (requires a PAT with `write:packages`):

```bash
export NODE_AUTH_TOKEN=ghp_...
pnpm changeset
pnpm version-packages
pnpm release
```

Browse published packages: https://github.com/JasonTuTu2?tab=packages
