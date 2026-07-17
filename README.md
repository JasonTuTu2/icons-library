# Icons Library

Unified icon library for **Iconify** and **custom brand SVGs**, with a consistent API for **React** and **Vue**.

Packages are published to [GitHub Packages](https://github.com/JasonTuTu2?tab=packages) (not the public npm registry). You need access to this [repo](https://github.com/JasonTuTu2/icons-library) (or the packages) and a GitHub token with `read:packages`.

## Packages

| Package | Description |
|---------|-------------|
| `@JasonTuTu2/icons-react` | React `<Icon>` component |
| `@JasonTuTu2/icons-vue` | Vue 3 `<Icon>` component |
| `@JasonTuTu2/icons-custom` | Custom brand SVGs (pulled in by react/vue) |
| `@JasonTuTu2/icons-core` | Shared types & helpers (usually transitive) |
| `@JasonTuTu2/icons-catalog` | Icon metadata + search helpers |
| `@JasonTuTu2/icons-web` | Icon browser + docs (private app, not published) |
| `@JasonTuTu2/icons-figma` | Figma plugin — embeds the icon browser; exports canvas SVGs (private, not published) |

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
pnpm add @JasonTuTu2/icons-react @iconify/react
```

**Vue 3**

```bash
pnpm add @JasonTuTu2/icons-vue @iconify/vue
```

Optional:

```bash
pnpm add @JasonTuTu2/icons-catalog
pnpm add @iconify-json/mdi   # offline Iconify set example
```

## Usage

`ci:` icons register automatically when you import `Icon` (via `@JasonTuTu2/icons-custom`). No bootstrap call needed.

### React

```tsx
import { Icon } from '@JasonTuTu2/icons-react'

<Icon name="mdi:home" size={24} label="Home" />
<Icon name="lucide:settings" size="1.5em" decorative />
<Icon name="ci:billing-alert" size={24} label="Billing" />
```

### Vue

```vue
<script setup>
import { Icon } from '@JasonTuTu2/icons-vue'
</script>

<template>
  <Icon name="mdi:home" :size="24" label="Home" />
  <Icon name="lucide:settings" size="1.5em" decorative />
  <Icon name="ci:cart" :size="24" label="Cart" />
</template>
```

### Icon names

| Source | Format | Example |
|--------|--------|---------|
| Iconify | `set:name` | `mdi:home`, `lucide:settings` |
| Custom | `ci:kebab-name` | `ci:billing-alert` |

### Props

| Prop | Type | Default | Notes |
|------|------|---------|--------|
| `name` | `string` | — | Required. Canonical id (`ci:…`, or Iconify `prefix:name`) |
| `size` | `number \| string` | `1em` | Number = px; string = CSS length |
| `color` | `string` | `currentColor` | Monochrome `ci:` icons follow this; multi-color `ci:` icons keep baked fills |
| `label` | `string` | — | Accessible name for meaningful icons |
| `decorative` | `boolean` | `false` | Presentational; sets `aria-hidden` |
| `className` / `class` | `string` | — | React / Vue |
| `style` | CSS object | — | Merged with size/color/rotate |
| `rotate` | `number` | — | Degrees (CSS `transform`) |

Use **`label`** for meaningful icons, or **`decorative`** for pure decoration. Prefer wrapping interactive icons in a button or link rather than putting click handlers on the icon alone.

### Catalog (optional)

```ts
import { searchIcons, getIconById } from '@JasonTuTu2/icons-catalog'

searchIcons({ query: 'billing', source: 'custom', limit: 20 })
getIconById('ci:billing-alert')
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
| React | `react` 18+, `@iconify/react` ^5–6 |
| Vue | `vue` 3.3+, `@iconify/vue` ^4–5 |
| Custom | `@iconify/react` and/or `@iconify/vue` |

Changelogs: [`packages/react`](packages/react/CHANGELOG.md), [`packages/vue`](packages/vue/CHANGELOG.md), [`packages/custom-icons`](packages/custom-icons/CHANGELOG.md), and siblings under `packages/*/CHANGELOG.md`. Published versions: https://github.com/JasonTuTu2?tab=packages

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Token missing/expired; needs `read:packages` |
| `404 Not Found` | No access to the repo/package, or wrong package name |
| `ci:` icons missing | Upgrade `@JasonTuTu2/icons-react` / `icons-vue` (and transitive `icons-custom`); confirm the SVG was published |
| `iconExists` / build error with Iconify React 6 | Fixed in latest packages — upgrade `@JasonTuTu2/icons-react` (uses `iconLoaded` with v5 fallback) |
| `color` does nothing on a `ci:` icon | Multi-color icons preserve fills; use a monochrome SVG if you need recoloring |
| Works locally, fails in CI | Set `NODE_AUTH_TOKEN` and `packages: read` in the workflow |

## Icon browser

Search icons, preview them, check licensing, and copy React/Vue snippets.

- **Live:** https://JasonTuTu2.github.io/icons-library/
- **Local (contributors):** `pnpm catalog:gen && pnpm build && pnpm dev` → http://localhost:5173

Product apps still install packages from GitHub Packages — the browser is a catalog UI, not an npm package. Adding/publishing brand SVGs is for maintainers (see below).

## Licensing

Published packages are **MIT**. Icon artwork remains under upstream licenses (Iconify collections vary). Custom `ci:` icons are proprietary / internal unless noted.

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

**App consumers** do not add icons to this library — they install packages and use names (`ci:…`, `mdi:…`). New brand SVGs are added here, then published.

**Preferred (Figma):** build and import the Development plugin (`apps/figma-plugin` — see [CONTRIBUTING.md](CONTRIBUTING.md)). The plugin panel loads SVGs only (**Load selection** → **Stage**). Apply/Publish happen in the full icon browser (magic-URL PAT for maintainers). PNG/JPG brand images are uploaded in the full browser, not the plugin.

**Alternative (Pages):** open the [icon browser](https://JasonTuTu2.github.io/icons-library/), **Upload** SVG / PNG / JPG → **Add to staging**, then **Apply staged to library** when ready. Wait for Actions + Pages refresh, then **Publish** for a new package version.

### First publish (happy path)

1. **Stage** (Figma plugin **Load selection** → **Stage**, or Upload SVG/PNG/JPG) → **Apply staged to library**.
2. Open the linked **Actions** run — wait ~1–2 minutes, then hard-refresh Pages.
3. In **Upload**, under **In library (unpublished)**, check assets to ship (unchecked stay out of this package, then return to the library).
4. **Publish** → wait for the publish Action → confirm versions under GitHub Packages.

From Figma / git:

1. Prefer the Figma plugin: **Load selection** → review names / Mono·Multi → **Stage**.
2. Or commit files / use Upload in the browser (Pages or `pnpm dev`):
   - Monochrome SVG: `packages/custom-icons/svg/kebab-name.svg`
   - Multi-color SVG: `packages/custom-icons/svg/color/kebab-name.svg`
   - Gradient SVG: `packages/custom-icons/svg/gradient/kebab-name.svg`
   - Brand image: `packages/custom-icons/images/kebab-name.png` (or `.jpg` / `.jpeg`)
3. Local git adds: run `pnpm catalog:gen` (Pages **Apply** regenerates in CI).
4. Use `ci:kebab-name` with `<Icon />` for SVGs. Brand images use `img:kebab-name` and ship as files — import from `@JasonTuTu2/icons-custom/images/…` (not `<Icon />`).

Monochrome SVGs are rewritten to `currentColor` (the `color` prop works). Multi-color and gradient SVGs keep their fills / paint servers; `color` may not recolor them. Do not reuse the same kebab name across mono, color, gradient, and images.

### Upload & publish from Pages

On the live icon browser, **staging** uses the embedded Pages token (no personal PAT). **Apply** and **Publish** only appear for developers who open the site with a session PAT (see CONTRIBUTING — magic URL `#gv-github-token=`).

1. **Add to staging** — writes SVGs into `staging/mono|color|gradient/` and images into `staging/images/` via the GitHub Contents API (**no Action**; multi-file OK). Staging-only commits do **not** redeploy Pages. In the Figma plugin, use **Load selection** then **Stage** (SVG only; choose Mono / Multi / Gradient).
2. **Apply staged to library** — dispatches an Action that promotes **whatever is staged on GitHub right now**, runs `catalog:gen`, clears staging, then Pages redeploys. The Action authenticates with the **`ICON_BROWSER_TOKEN`** repo secret.
3. **Publish** — check unpublished icons/images to include; unchecked assets are held aside for this package only, then restored to the library as unpublished. Then dispatch publish; Action uses secrets to patch-bump and publish to GitHub Packages.

The Figma plugin loads a dedicated Pages panel (`figma.html`) for Load/Stage (SVG); Apply/Publish and PNG/JPG upload happen in the full icon browser.

**Remove a custom asset:** select `ci:…` or `img:…` in the browser → **Stage removal** → **Apply staged** (deletes the file + regenerates catalog) → **Publish** so packages no longer ship it. Markers live in `packages/custom-icons/staging/remove/`.

**Repo setup (secrets & variables):**

| Kind | Name | Purpose |
|------|------|---------|
| Secret | `ICON_BROWSER_TOKEN` | PAT with `contents: write` + `actions: write`. Used in Actions for apply/publish pushes, and baked into Pages so anyone can **stage** |
| Variable (optional) | `ICON_BROWSER_REPO` | Override `owner/repo` baked into Pages (`VITE_GITHUB_REPO`). Defaults to `github.repository` |

Anyone with the Pages URL can stage. Apply/Publish need a personal PAT via `#gv-github-token=…` (stored in sessionStorage for that tab). Note: a determined user can still extract the baked token from the JS bundle and call the API — rotate the PAT or narrow scopes if you need a harder lock.

| Action | What happens |
|--------|----------------|
| Add to staging | Embedded token → Contents API → `staging/mono`, `staging/color`, `staging/gradient`, or `staging/images` |
| Stage removal | Embedded token → Contents API → `staging/remove/{name}.remove` |
| Apply staged | Session PAT dispatches → Action uses `ICON_BROWSER_TOKEN` → library adds/removes + `catalog:gen` |
| Publish | Session PAT dispatches → Action publishes with package permissions |

Local `pnpm dev` still uploads to disk (Vite plugin) without GitHub staging. For local GitHub staging, set `VITE_GITHUB_TOKEN` in `.env.local`.

### Publishing

Packages publish to GitHub Packages when someone clicks **Publish** in the icon browser (see `.github/workflows/publish-packages.yml`), or via manual `workflow_dispatch`. Staging/Apply do **not** auto-publish. The Figma plugin stages through the embedded browser UI (it does not call GitHub itself).

Local publish:

```bash
export NODE_AUTH_TOKEN=ghp_...   # write:packages
pnpm changeset
pnpm version-packages
pnpm release
```

Browse published packages: https://github.com/JasonTuTu2?tab=packages
