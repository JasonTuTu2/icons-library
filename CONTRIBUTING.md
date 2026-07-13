# Contributing

## Setup

1. Node 18+
2. Enable pnpm (`npm i -g pnpm@9` or Corepack)
3. `pnpm install`
4. `pnpm catalog:gen` — regenerate icon metadata
5. `pnpm build`

## Scripts

- `pnpm dev` — icon browser
- `pnpm test` — unit tests
- `pnpm typecheck` — TypeScript across packages
- `pnpm catalog:gen` — rebuild `packages/catalog/data/icons.json`

## Releases

This repo uses [Changesets](https://github.com/changesets/changesets):

1. `pnpm changeset`
2. `pnpm version-packages`
3. `pnpm release`

## Guidelines

- Keep React and Vue `<Icon>` prop semantics aligned via `@genvoice/icons-core`.
- Do not vendor upstream SVG artwork into GenVoice packages.
- Prefer ESM, `sideEffects: false`, and peer dependencies for Ant Design / Iconify.
- Update the catalog generator when adding Iconify collections.
