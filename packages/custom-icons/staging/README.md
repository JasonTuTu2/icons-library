# Custom icon staging

Pending GenVoice SVGs shared by the icon browser **before** they enter the library.

- `mono/*.svg` → applied to `packages/custom-icons/svg/`
- `color/*.svg` → applied to `packages/custom-icons/svg/color/`

**Add to staging** writes here via the GitHub Contents API (no Action).
**Apply staged to library** runs one workflow that promotes whatever is here now, regenerates the catalog, and clears these folders.

Do not put production icons here permanently — use Apply when ready.
