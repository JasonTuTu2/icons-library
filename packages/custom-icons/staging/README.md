# Custom icon staging

Pending GenVoice SVG / brand-image **adds** and **removals** shared by the icon browser **before** they enter / leave the library.

- `mono/*.svg` → applied to `packages/custom-icons/svg/`
- `color/*.svg` → applied to `packages/custom-icons/svg/color/`
- `images/*.{png,jpg,jpeg}` → applied to `packages/custom-icons/images/`
- `remove/*.remove` → Apply deletes matching `svg/{name}.svg`, `svg/color/{name}.svg`, and/or `images/{name}.*`

**Add to staging** / **Stage removal** write here via the GitHub Contents API (no Action).
**Apply staged to library** runs one workflow that promotes adds, applies removals, regenerates the catalog, and clears these folders.

Do not put production icons or permanent removals here — use Apply when ready.
