# Docker Compose stack (branch `docker-stack`)

Run the **icon browser + auth API** locally with Docker. GitHub Pages and the Cloudflare Worker on `main` stay as-is until you choose to cut over.

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

Sign in with the bootstrap user from `AUTH_USERS`. Accounts persist in the `auth-kv` Docker volume.

## Without Docker (Node auth only)

```bash
pnpm install
pnpm --filter @JasonTuTu2/github-admin build
# set the same env vars as .env.example, then:
pnpm --filter @JasonTuTu2/icons-auth-api start:node
```

## What this does / does not

| In Compose | Still on GitHub |
|------------|-----------------|
| Web UI (nginx) | Apply / Publish Actions |
| Auth API (Node + file KV) | Package publish to GitHub Packages |
| Local accounts / invites / staging sync | Cloudflare Worker (production) |

Figma plugin: point it at http://localhost:8080/figma.html (or keep Pages).

## Stop / reset

```bash
docker compose down
docker volume rm icons-library_auth-kv   # wipes local accounts
```
