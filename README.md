# GenVoice Icons

Unified icon library for **Ant Design Icons**, **Iconify**, and **GenVoice custom SVGs**, with a consistent API for **React** and **Vue**.

Packages are published to [GitHub Packages](https://github.com/JasonTuTu2?tab=packages) (not the public npm registry). You need access to this [repo](https://github.com/JasonTuTu2/icons-library) (or the packages) and a GitHub token with `read:packages`.

## Packages

| Package | Description |
|---------|-------------|
| `@JasonTuTu2/icons-react` | React `<Icon>` component |
| `@JasonTuTu2/icons-vue` | Vue 3 `<Icon>` component |
| `@JasonTuTu2/icons-custom` | GenVoice brand SVGs (pulled in by react/vue) |
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
pnpm add @JasonTuTu2/icons-react @ant-design/icons @iconify/react
```

**Vue 3**

```bash
pnpm add @JasonTuTu2/icons-vue @ant-design/icons-vue @iconify/vue
```

Optional:

```bash
pnpm add @JasonTuTu2/icons-catalog
pnpm add @iconify-json/mdi   # offline Iconify set example
```

## Usage

`gv:` icons register automatically when you import `Icon` (via `@JasonTuTu2/icons-custom`). No bootstrap call needed.

### React

```tsx
import { Icon } from '@JasonTuTu2/icons-react'

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />
```

### Vue

```vue
<script setup>
import { Icon } from '@JasonTuTu2/icons-vue'
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

### Props

| Prop | Type | Default | Notes |
|------|------|---------|--------|
| `name` | `string` | — | Required. Canonical id (`ant:…`, `gv:…`, or Iconify `prefix:name`) |
| `size` | `number \| string` | `1em` | Number = px; string = CSS length |
| `color` | `string` | `currentColor` | Monochrome `gv:` icons follow this; multi-color `gv:` icons keep baked fills |
| `label` | `string` | — | Accessible name for meaningful icons |
| `decorative` | `boolean` | `false` | Presentational; sets `aria-hidden` |
| `className` / `class` | `string` | — | React / Vue |
| `style` | CSS object | — | Merged with size/color/rotate |
| `rotate` | `number` | — | Degrees (CSS `transform`) |
| `spin` | `boolean` | `false` | **Ant icons only** — ignored for Iconify and `gv:` |

Use **`label`** for meaningful icons, or **`decorative`** for pure decoration. Prefer wrapping interactive icons in a button or link rather than putting click handlers on the icon alone.

### Catalog (optional)

```ts
import { searchIcons, getIconById } from '@JasonTuTu2/icons-catalog'

searchIcons({ query: 'billing', source: 'custom', limit: 20 })
getIconById('gv:billing-alert')
```

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

Changelogs: [`packages/react`](packages/react/CHANGELOG.md), [`packages/vue`](packages/vue/CHANGELOG.md), [`packages/custom-icons`](packages/custom-icons/CHANGELOG.md), and siblings under `packages/*/CHANGELOG.md`. Published versions: https://github.com/JasonTuTu2?tab=packages

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Token missing/expired; needs `read:packages` |
| `404 Not Found` | No access to the repo/package, or wrong package name |
| `gv:` icons missing | Upgrade `@JasonTuTu2/icons-react` / `icons-vue` (and transitive `icons-custom`); confirm the SVG was published |
| `iconExists` / build error with Iconify React 6 | Fixed in latest packages — upgrade `@JasonTuTu2/icons-react` (uses `iconLoaded` with v5 fallback) |
| `color` does nothing on a `gv:` icon | Multi-color icons preserve fills; use a monochrome SVG if you need recoloring |
| Works locally, fails in CI | Set `NODE_AUTH_TOKEN` and `packages: read` in the workflow |

## Icon browser

Search icons, preview them, check licensing, and copy React/Vue snippets.

- **Live:** https://JasonTuTu2.github.io/icons-library/
- **Local (contributors):** `pnpm catalog:gen && pnpm build && pnpm dev` → http://localhost:5173

Product apps still install packages from GitHub Packages — the browser is a catalog UI, not an npm package. Adding/publishing brand SVGs is for maintainers (see below).

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

### Adding custom icons

**App consumers** do not add icons to this library — they install packages and use names (`gv:…`, `ant:…`, `mdi:…`). New brand SVGs are added here, then published.

**Preferred (Pages):** open the [icon browser](https://JasonTuTu2.github.io/icons-library/), **Add to staging** (multi-file OK), then **Apply staged to library** when ready. Wait for Actions + Pages refresh, then **Publish** for a new package version.

From Figma / git:

1. Export SVG (prefer 24×24).
2. Add via **Upload SVG** in the browser (Pages or `pnpm dev`), choosing **Monochrome** or **Multi-color**, or commit files:
   - Monochrome: `packages/custom-icons/svg/kebab-name.svg`
   - Multi-color: `packages/custom-icons/svg/color/kebab-name.svg`
3. Local git adds: run `pnpm catalog:gen` (Pages **Apply** regenerates in CI).
4. Use `gv:kebab-name` in designs and code. Publish so consumers get the new version (`Icon` auto-registers custom icons).

Monochrome SVGs are rewritten to `currentColor` (the `color` prop works). Multi-color SVGs keep their fills; `color` may not recolor them. Names are shared across both folders — do not reuse the same kebab name.

### Upload & publish from Pages

On the live browser:

1. **Connect GitHub** — paste a PAT into the toolbar (stored in tab `sessionStorage` only). Needs `contents: write` + `actions: write` on this repo.
2. **Add to staging** — writes SVGs into the shared `packages/custom-icons/staging/` folder via the GitHub Contents API (**no Action**; multi-file OK). Staging-only commits do **not** redeploy Pages.
3. **Apply staged to library** — dispatches an Action that promotes **whatever is staged on GitHub right now**, runs `catalog:gen`, clears staging, then Pages redeploys. The Action authenticates with the **`ICON_BROWSER_TOKEN`** repo secret (not the browser).
4. **Publish** — dispatches publish; Action uses secrets to patch-bump and publish to GitHub Packages.

**Repo setup (secrets & variables):**

| Kind | Name | Purpose |
|------|------|---------|
| Secret | `ICON_BROWSER_TOKEN` | PAT used **only in Actions** for apply/publish git pushes (`contents: write`; include `actions: write` if the same token is also used by maintainers in the browser) |
| Variable (optional) | `ICON_BROWSER_REPO` | Override `owner/repo` baked into Pages (`VITE_GITHUB_REPO`). Defaults to `github.repository` |

The Pages build **does not** embed a write token. Anonymous visitors cannot stage/apply/publish.

| Action | What happens |
|--------|----------------|
| Add to staging | Session PAT → Contents API → `staging/mono` or `staging/color` |
| Apply staged | Session PAT dispatches → Action uses `ICON_BROWSER_TOKEN` → library + `catalog:gen` |
| Publish | Session PAT dispatches → Action publishes with package permissions |

Local `pnpm dev` still uploads to disk (Vite plugin) without GitHub staging.

### Publishing

Packages publish to GitHub Packages when someone clicks **Publish** in the icon browser (see `.github/workflows/publish-packages.yml`), or via manual `workflow_dispatch`. Staging/Apply do **not** auto-publish.

Local publish:

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm changeset
pnpm version-packages
pnpm release
```

Browse published packages: https://github.com/JasonTuTu2?tab=packages
