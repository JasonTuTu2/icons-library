# Gradient custom icons

Place SVGs that use linear/radial gradients (or other paint servers) here.

- Files are registered as `ci:<kebab-name>` (same namespace as mono / multi-color).
- Gradient defs and `fill="url(#…)"` / `stroke="url(#…)"` are **preserved** (no `currentColor` rewrite).
- The `color` prop on `<Icon>` will not recolor gradient paints.
- Do not reuse a name that already exists in `svg/` or `svg/color/`.

Monochrome UI icons belong in `../`. Flat multi-color icons belong in `../color/`.
