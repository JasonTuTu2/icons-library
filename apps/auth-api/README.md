# Icon browser auth API (Cloudflare Worker)

Authenticated API so designers/devs sign in with username + password. The browser and Figma plugin stay locked until Sign in; GitHub admin uses the Worker’s `GITHUB_TOKEN` (no personal PAT, no token baked into Pages).

| Role | Browse / Stage | Apply | Publish | Metadata edits |
|------|----------------|-------|---------|----------------|
| `designer` | yes | yes | no | yes |
| `dev` | yes | yes | yes | yes |

## What you need to do (one-time)

1. **Cloudflare account** (free) + install nothing beyond this repo.
2. From repo root:
   ```bash
   pnpm install
   pnpm --filter @JasonTuTu2/github-admin build
   cd apps/auth-api
   cp .dev.vars.example .dev.vars
   ```
3. Edit `.dev.vars`:
   - `GITHUB_TOKEN` — same bot PAT as repo secret `ICON_BROWSER_TOKEN` (`contents:write` + `actions:write`)
   - `GITHUB_REPO` — e.g. `JasonTuTu2/icons-library`
   - `SESSION_SECRET` — long random string
   - `AUTH_USERS` — JSON array, e.g.
     ```json
     [{"username":"designer","password":"…","role":"designer"},{"username":"dev","password":"…","role":"dev"}]
     ```
   - `CORS_ORIGINS` — Pages origin, e.g. `https://jasontutu2.github.io`
4. Local smoke test:
   ```bash
   pnpm --filter @JasonTuTu2/icons-auth-api dev
   ```
5. Deploy (and re-deploy whenever Worker routes change):
   ```bash
   pnpm --filter @JasonTuTu2/icons-auth-api deploy
   ```
   Then set Worker secrets (same values as `.dev.vars`):
   ```bash
   cd apps/auth-api
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put GITHUB_REPO
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put AUTH_USERS
   ```
   Optional: `npx wrangler secret put CORS_ORIGINS`
6. Copy the Worker URL (e.g. `https://icons-library-auth.<subdomain>.workers.dev`).
7. In the GitHub repo → **Settings → Secrets and variables → Actions → Variables**:
   - **`AUTH_API_URL`** = that Worker URL (no trailing slash).
8. Redeploy Pages (push to `main` or run the Pages workflow) so the browser gets `VITE_AUTH_API_URL`.

Until step 7–8, the local browser can still use `VITE_GITHUB_TOKEN` / `#gv-github-token=` when `VITE_AUTH_API_URL` is unset.

If every authed call returns `GitHub API 403: Forbidden`, redeploy the Worker after updating `@JasonTuTu2/github-admin` (GitHub requires a `User-Agent` on API requests; the Worker bundle must include that fix).

## Endpoints

- `POST /api/login` `{ username, password }` → `{ token, username, role }`
- `GET /api/me` `Authorization: Bearer …`
- `GET /api/metadata` — live `metadata.json`
- `POST /api/icon-metadata` `{ name, patch }` — sidebar property edits
- `POST /api/library-conflicts` `{ names }` → `{ conflicts }`
- `GET /api/unpublished-icons` / `unpublished-removals`
- `GET /api/publish-history?limit=`
- `GET /api/publish-readiness`
- `GET /api/published-version` → `{ version }`
- `GET /api/library-asset-path?name=` → `{ path }`
- `GET /api/asset-preview?path=` → `{ preview }`
- `POST /api/apply` body `{ icons, removals }` — designer or dev
- `POST /api/stage-icons` body `{ icons }` — Figma plugin → GitHub staging (Contents API)
- `GET /api/staged-icons` / `staged-removals` — remote staging queue
- `POST /api/staging-handoff` body `{ v:1, icons, removals }` → `{ id }` (15 min, one-time fetch)
- `GET /api/staging-handoff/:id` — returns queue, then deletes (designer or dev)
- `POST /api/publish` body publish options — **dev only**
- `GET /health`
