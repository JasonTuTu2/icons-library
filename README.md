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

## Icon browser (UI)

Search icons, preview them, check licensing, and copy React/Vue snippets.

- **Live:** https://JasonTuTu2.github.io/icons-library/ (GitHub Pages; deploys from `main`)
- **Local:** `pnpm dev` → http://localhost:5173

### Upload & publish from Pages

On the live browser:

1. **Add to staging** — writes SVGs into the shared `packages/custom-icons/staging/` folder via the GitHub Contents API (**no Action**; cheap; multi-file OK). Staging-only commits do **not** redeploy Pages.
2. **Apply staged to library** — one Action promotes **whatever is staged on GitHub right now** (everyone’s pending icons), runs `catalog:gen`, clears staging, then Pages redeploys.
3. **Publish** — separate; patch-bumps and publishes packages to GitHub Packages (unchanged).

**One-time repo setup:** add a secret named `ICON_BROWSER_TOKEN` (fine-grained or classic PAT) with:

- `contents: write`
- `actions: write`

Use that same secret for Pages build injection and for Apply workflow pushes. Then redeploy Pages (push to `main` or run **Deploy icon browser**).

**Caveat:** until login/auth is added, anyone who can open the public Pages site can stage/apply/publish (they can also extract the baked token). Treat this as temporary open access.

| Action | What happens |
|--------|----------------|
| Add to staging | Contents API → `staging/mono` or `staging/color` (shared queue; no Action) |
| Apply staged | `workflow_dispatch` → `apply-staged-icons` moves staging → library, `catalog:gen`, Pages redeploys |
| Publish | `workflow_dispatch` → `publish-packages` patch bump + GitHub Packages |

Local `pnpm dev` still uploads to disk (Vite plugin) without GitHub staging.

```bash
pnpm install
pnpm catalog:gen   # first time / after SVG changes
pnpm build
pnpm dev
```

Product apps still install `@JasonTuTu2/icons-react` / `icons-vue` from GitHub Packages — the browser is a catalog, not an npm package.

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
4. Use `gv:kebab-name` and call `registerCustomIcons()` once at bootstrap. Publish so consumers get the new version.

Monochrome SVGs are rewritten to `currentColor` (the `color` prop works). Multi-color SVGs keep their fills; `color` may not recolor them. Names are shared across both folders — do not reuse the same kebab name.

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
