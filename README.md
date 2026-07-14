# GenVoice Icons

Unified icon library for **Ant Design Icons**, **Iconify**, and **GenVoice custom SVGs**, with a consistent API for **React** and **Vue**.

Packages are published to [GitHub Packages](https://github.com/JasonTuTu2?tab=packages) (not the public npm registry). You need access to this [repo](https://github.com/JasonTuTu2/icons-library) (or the packages) and a GitHub token with `read:packages`.

## Packages

| Package | Description |
|---------|-------------|
| `@JasonTuTu2/icons-react` | React `<Icon>` component |
| `@JasonTuTu2/icons-vue` | Vue 3 `<Icon>` component |
| `@JasonTuTu2/icons-custom` | GenVoice brand SVGs + `registerCustomIcons()` |
| `@JasonTuTu2/icons-core` | Shared types & helpers (usually transitive) |
| `@JasonTuTu2/icons-catalog` | Icon metadata + search helpers |
| `@JasonTuTu2/icons-web` | Icon browser + docs (private app, not published) |

## Install

### 1. Authenticate

Create a [personal access token](https://github.com/settings/tokens) with **`read:packages`**. If packages inherit from a private repo, also include **`repo`**.

In your app root, add `.npmrc`:

```ini
@JasonTuTu2:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Set the token in your environment (do not commit it):

```bash
# PowerShell
$env:NODE_AUTH_TOKEN = "ghp_..."

# bash
export NODE_AUTH_TOKEN=ghp_...
```

**GitHub Actions:**

```yaml
permissions:
  packages: read

jobs:
  build:
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
          scope: "@JasonTuTu2"
      - run: pnpm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If `GITHUB_TOKEN` cannot see packages under another user’s account, use a PAT secret with `read:packages` instead.

### 2. Add packages

**React**

```bash
pnpm add @JasonTuTu2/icons-react @JasonTuTu2/icons-custom @ant-design/icons @iconify/react
```

**Vue 3**

```bash
pnpm add @JasonTuTu2/icons-vue @JasonTuTu2/icons-custom @ant-design/icons-vue @iconify/vue
```

Optional:

```bash
pnpm add @JasonTuTu2/icons-catalog
pnpm add @iconify-json/mdi   # offline Iconify set example
```

## Usage

Call `registerCustomIcons()` once at app bootstrap before using any `gv:` icon.

### React

```tsx
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/react'
import { Icon } from '@JasonTuTu2/icons-react'

registerCustomIcons()

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />
```

### Vue

```vue
<script setup>
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/vue'
import { Icon } from '@JasonTuTu2/icons-vue'

registerCustomIcons()
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
  <Icon name="gv:cart" :size="24" label="Cart" />
</template>
```

### Icon names

| Source | Format | Example |
|--------|--------|---------|
| Ant Design | `ant:IconName` | `ant:HomeOutlined` |
| Iconify | `set:name` | `mdi:home`, `lucide:settings` |
| GenVoice custom | `gv:kebab-name` | `gv:billing-alert` |

Use **`label`** for meaningful icons, or **`decorative`** for pure decoration.

### Offline Iconify (optional)

```ts
import { addCollection } from '@iconify/react' // or @iconify/vue
import mdi from '@iconify-json/mdi/icons.json'

addCollection(mdi)
```

## Compatibility

| Package | Peers |
|---------|--------|
| React | `react` 18+, `@ant-design/icons` ^5–6, `@iconify/react` ^5–6 |
| Vue | `vue` 3.3+, `@ant-design/icons-vue` ^7, `@iconify/vue` ^4–5 |
| Custom | `@iconify/react` and/or `@iconify/vue` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Token missing/expired; needs `read:packages` |
| `404 Not Found` | No access to the repo/package, or wrong package name |
| `gv:` icons missing | Call `registerCustomIcons()` once at bootstrap |
| `iconExists` / build error with Iconify React 6 | Fixed in latest packages — upgrade `@JasonTuTu2/icons-react` (uses `iconLoaded` with v5 fallback) |
| Works locally, fails in CI | Set `NODE_AUTH_TOKEN` and `packages: read` in the workflow |

## Licensing

GenVoice packages are **MIT**. Icon artwork remains under upstream licenses (Ant Design Icons MIT; Iconify collections vary). Custom `gv:` icons are GenVoice proprietary / internal unless noted.

## Development (contributors)

```bash
pnpm install
pnpm catalog:gen
pnpm build
pnpm dev
```

```bash
pnpm test
pnpm typecheck
pnpm changeset
```

### Custom icons from Figma

1. Export SVG from Figma (prefer 24×24).
2. Add via **Upload SVG** in the browser (`pnpm dev`), choosing **Monochrome** or **Multi-color**, or commit files:
   - Monochrome: `packages/custom-icons/svg/kebab-name.svg`
   - Multi-color: `packages/custom-icons/svg/color/kebab-name.svg`
3. Run `pnpm catalog:gen` after git adds (upload regenerates + rebuilds packages automatically).
4. Use `gv:kebab-name` and call `registerCustomIcons()` once at bootstrap.

Monochrome SVGs are rewritten to `currentColor` (the `color` prop works). Multi-color SVGs keep their fills; `color` may not recolor them. Names are shared across both folders — do not reuse the same kebab name.

### Publishing

Packages publish to GitHub Packages via Changesets when release PRs merge to `main` (see `.github/workflows/release.yml`).

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm changeset
pnpm version-packages
pnpm release
```

Browse published packages: https://github.com/JasonTuTu2?tab=packages
