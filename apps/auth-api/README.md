# Icon browser auth API (Cloudflare Worker)

Tiny authenticated API so designers/devs log in with username + password instead of personal GitHub PATs.

| Role | Stage (local) | Apply | Publish |
|------|---------------|-------|---------|
| `designer` | yes (browser) | yes | no |
| `dev` | yes | yes | yes |

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
4. Local smoke test:
   ```bash
   pnpm --filter @JasonTuTu2/icons-auth-api dev
   ```
5. Deploy:
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
6. Copy the Worker URL (e.g. `https://icons-library-auth.<subdomain>.workers.dev`).
7. In the GitHub repo → **Settings → Secrets and variables → Actions → Variables**:
   - Add **`AUTH_API_URL`** = that Worker URL (no trailing slash).
8. Redeploy Pages (push to `main` or run the Pages workflow) so the browser gets `VITE_AUTH_API_URL`.

Until step 7–8, the browser keeps the old magic-URL PAT path for Apply/Publish.

## Endpoints

- `POST /api/login` `{ username, password }` → `{ token, username, role }`
- `GET /api/me` `Authorization: Bearer …`
- `POST /api/apply` body `{ icons, removals }` — designer or dev
- `POST /api/publish` body publish options — **dev only**
- `GET /health`
