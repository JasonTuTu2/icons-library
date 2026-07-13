# GenVoice Icons

Unified icon library and browser for **Ant Design Icons**, **Iconify**, and **GenVoice custom SVGs**, with a consistent API for **React** and **Vue**.

## Packages

| Package | Description |
|---------|-------------|
| `@genvoice/icons-core` | Shared types, name parsing, size & a11y helpers |
| `@genvoice/icons-catalog` | Icon metadata + search helpers for the browser |
| `@genvoice/icons-react` | React `<Icon>` component |
| `@genvoice/icons-vue` | Vue 3 `<Icon>` component |
| `@genvoice/icons-custom` | GenVoice brand SVGs + `registerCustomIcons()` |
| `@genvoice/icons-web` | Icon browser + docs (private app) |

## Quick start

```bash
pnpm install
pnpm catalog:gen
pnpm build
pnpm dev
```

### React

```bash
pnpm add @genvoice/icons-react @genvoice/icons-custom @ant-design/icons @iconify/react
```

```tsx
import { registerCustomIcons } from '@genvoice/icons-custom/react'
import { Icon } from '@genvoice/icons-react'

registerCustomIcons()

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />
```

### Vue

```bash
pnpm add @genvoice/icons-vue @genvoice/icons-custom @ant-design/icons-vue @iconify/vue
```

```vue
<script setup>
import { registerCustomIcons } from '@genvoice/icons-custom/vue'
import { Icon } from '@genvoice/icons-vue'

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

## Download

Download the latest release from:
https://github.com/JasonTuTu2/icons-library/releases/latest
