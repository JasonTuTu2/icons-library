# Custom icon staging

Pending GenVoice SVG **adds** and **removals** shared by the icon browser **before** they enter / leave the library.

- `mono/*.svg` → applied to `packages/custom-icons/svg/`
- `color/*.svg` → applied to `packages/custom-icons/svg/color/`
- `remove/*.remove` → Apply deletes `svg/{name}.svg` and/or `svg/color/{name}.svg`

**Add to staging** / **Stage removal** write here via the GitHub Contents API (no Action).
**Apply staged to library** runs one workflow that promotes adds, applies removals, regenerates the catalog, and clears these folders.

Do not put production icons or permanent removals here — use Apply when ready.
