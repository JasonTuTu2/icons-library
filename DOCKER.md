# Docker Compose stack (branch `docker-stack`)

Run the **icon browser + auth API + Redis** locally with Docker. GitHub Pages and the Cloudflare Worker on `main` stay as-is until you choose to cut over.

## You need

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Engine + Compose v2) — install and start it if `docker` is not on your PATH
2. A GitHub PAT with **`contents:write`** + **`actions:write`** (same as `ICON_BROWSER_TOKEN` / Worker `GITHUB_TOKEN`)

## Setup

```bash
git checkout docker-stack
cp .env.example .env
```

Edit `.env`: set `GITHUB_TOKEN`, `SESSION_SECRET`, and `AUTH_USERS` password.

```bash
docker compose up --build
```

- Browser: http://localhost:8080  
- Auth API: http://localhost:8787/health  
- Redis: localhost:6379 (Compose service `redis`)

Sign in with the bootstrap user from `AUTH_USERS`. Accounts persist in the `auth-redis` volume.

## Without Docker (Node auth only)

Needs Redis running locally (or omit `REDIS_URL` to use a file under `apps/auth-api/.data/`):

```bash
pnpm install
pnpm --filter @JasonTuTu2/github-admin build
# set env from .env.example, plus REDIS_URL=redis://127.0.0.1:6379
pnpm --filter @JasonTuTu2/icons-auth-api start:node
```

## What this does / does not

| In Compose | Still on GitHub |
|------------|-----------------|
| Web UI (nginx) | Apply / Publish Actions |
| Auth API (Node) | Package publish to GitHub Packages |
| Redis (users, invites, staging) | Cloudflare Worker + KV (production) |

Figma plugin: point it at http://localhost:8080/figma.html (or keep Pages).

## Port already allocated (`Bind for 0.0.0.0:8080 failed`)

Something else on the machine is using that port. Either free it or pick another:

```bash
# See who owns 8080
docker ps
ss -tlnp | grep -E '8080|8787|6379' || true

# Easiest: use different host ports in `.env`
WEB_PORT=18080
AUTH_PORT=18787
# if Redis host port conflicts too:
# REDIS_PORT=16379

# Match browser URLs (same host you open in the browser)
VITE_AUTH_API_URL=http://localhost:18787
CORS_ORIGINS=http://localhost:18080,http://127.0.0.1:18080
```

Then:

```bash
docker compose down
docker compose up --build
```

Open http://localhost:18080 (or `http://<spark-hostname>:18080` from another PC — then put that host in `VITE_AUTH_API_URL` / `CORS_ORIGINS` and rebuild).

## Stop / reset

```bash
docker compose down
docker volume rm icons-library_auth-redis   # wipes local accounts
```
