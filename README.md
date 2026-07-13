# GenVoice Icons

Unified icon library and browser for **Ant Design Icons** and **Iconify**, with a consistent API for **React** and **Vue**.

## Packages

| Package | Description |
|---------|-------------|
| `@genvoice/icons-core` | Shared types, name parsing, size & a11y helpers |
| `@genvoice/icons-catalog` | Icon metadata + search helpers for the browser |
| `@genvoice/icons-react` | React `<Icon>` component |
| `@genvoice/icons-vue` | Vue 3 `<Icon>` component |
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
pnpm add @genvoice/icons-react @ant-design/icons @iconify/react
```

```tsx
import { Icon } from '@genvoice/icons-react'

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
```

### Vue

```bash
pnpm add @genvoice/icons-vue @ant-design/icons-vue @iconify/vue
```

```vue
<script setup>
import { Icon } from '@genvoice/icons-vue'
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
</template>
```

## Canonical names

- Ant Design: `ant:HomeOutlined`
- Iconify: `mdi:home`, `lucide:settings`, `heroicons:home`

## Offline Iconify

```ts
import { addCollection } from '@iconify/react' // or @iconify/vue
import mdi from '@iconify-json/mdi/icons.json'

addCollection(mdi)
```

## Licensing

GenVoice packages are **MIT**. Icon artwork remains under upstream licenses (Ant Design Icons MIT; Iconify collections vary). Always check the icon detail panel in the browser.

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
