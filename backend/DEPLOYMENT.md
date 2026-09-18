# SkillSwap Backend — Deployment Guide

Three tested targets are already wired: **Render** (free tier), **Railway** (usage-based), and **Fly.io** (free trial + Docker). Any Postgres 15+ works for the database — this doc assumes **Neon** (free tier, auto-suspend) because it needs no card and pairs with all three hosts.

## 0. One-time local prep (before pushing to git)

Prisma requires a checked-in migration file for `prisma migrate deploy` to run in production. Create it locally against any Postgres (Docker or Neon):

```bash
cd backend
cp .env.example .env
# Point DATABASE_URL at any reachable Postgres (Neon works fine).
npx prisma migrate dev --name init
```

This creates `backend/prisma/migrations/*/migration.sql`. **Commit that folder.** Without it, the first production deploy has nothing to apply.

Optional smoke test before deploying:

```bash
npm install
npm run build
npm run seed
npm start
curl http://localhost:4000/health   # → {"ok":true, ...}
```

## 1. Provision the database (Neon)

1. Go to <https://neon.tech> → new project → region closest to your API host.
2. Create a database named `skillswap`.
3. Copy the **pooled** connection string. It looks like `postgresql://user:pass@ep-xxx.pooler.eu-central-1.aws.neon.tech/skillswap?sslmode=require`.
4. Keep that string handy — it's the `DATABASE_URL` you paste into every host below.

Any Postgres works; Supabase / Railway Postgres / RDS all fit the same slot.

## 2. Deploy — pick one host

### Option A — Render (recommended for a first deploy)

Uses [render.yaml](render.yaml) already in the repo.

1. Push the repo to GitHub / GitLab.
2. In Render dashboard → **New +** → **Blueprint** → point at your repo.
3. Render detects `backend/render.yaml`, creates the web service + a 1GB disk for uploads.
4. In the service's **Environment** tab, paste:
   - `DATABASE_URL` — the Neon URL from §1.
   - `CORS_ORIGIN` — the origin the frontend will be served from (comma-separate if multiple).
5. Click **Manual Deploy → Deploy latest commit**. First build runs `npm install && npm run build`; start runs `prisma migrate deploy && node dist/src/server.js`.
6. Seed the deployed DB once:
   - Render dashboard → **Shell** on the service → `npm run seed:prod`.

Public URL: `https://<service-name>.onrender.com`. Health check: `/health`.

### Option B — Railway

1. `railway login`, `railway init` inside `backend/`.
2. Add a Postgres plugin OR paste the Neon URL as `DATABASE_URL` in **Variables**.
3. Also set `CORS_ORIGIN`, and (optional) `PLATFORM_FEE_PERCENT`, `RUSH_SURCHARGE_PAISE`.
4. `railway up` — Nixpacks reads [railway.json](railway.json), runs `npm install && npm run build`, starts with `npm run start:prod`.
5. Seed: `railway run npm run seed:prod`.

### Option C — Fly.io (Docker)

1. `fly launch --no-deploy` in `backend/` (accept the existing [fly.toml](fly.toml) and [Dockerfile](Dockerfile)).
2. `fly volumes create ss_uploads --size 1 --region bom` (match `primary_region`).
3. Set secrets:
   ```bash
   fly secrets set \
     DATABASE_URL="postgresql://..." \
     CORS_ORIGIN="https://<your-frontend>" \
     PLATFORM_FEE_PERCENT=5 \
     RUSH_SURCHARGE_PAISE=500000
   ```
4. `fly deploy`.
5. Seed once: `fly ssh console -C "npm run seed:prod"`.

## 3. Point the frontend at the deployed API

The static site currently ships without any live API calls. When Phase 5+ wiring lands, the fetch base URL comes from a single `window.SS_API_BASE` string. Set it in one of two ways:

- **Static hosting (Netlify, Vercel, GitHub Pages):** inject an inline `<script>window.SS_API_BASE = "https://<api>.onrender.com/api";</script>` in each HTML page's `<head>` at deploy time.
- **Same-origin serving:** front the API behind the same domain (e.g. `/api` proxied to Render). Then no config needed.

## 4. What to send me so I can wire it up for you

If you want me to finish the wiring end-to-end in Phase 5, I need any **one** set of the following:

1. **Preferred host** — Render / Railway / Fly (I recommend Render for zero-cost + zero-CC).
2. **Database URL** — either a Neon (or similar) connection string, or explicit permission to guide you through creating one.
3. **Frontend origin** — the exact URL the static site will be served from once deployed (`https://…`). Needed for the CORS allowlist. If you don't have one yet, I default to `http://localhost:8891` for local + we add the real one later.
4. **Do you want a demo domain** (e.g. `skillswap-demo.onrender.com`) or a custom domain?

I do **not** need any secrets from you — paste `DATABASE_URL` and other secrets directly into your host's dashboard. I never see them.

## 5. Post-deploy checks

Once the API is up:

```bash
curl https://<api-host>/health
# → {"ok":true,"service":"skillswap-backend","version":"0.4.0"}

curl https://<api-host>/api/categories
# → {"data":[{"id":"...","name":"3D Clay & Toys", ...}, …]}

curl https://<api-host>/api/gigs?limit=3
# → {"data":[{"title":"3D Clay Character Modeling & …", ...}], "total":6, ...}
```

If any of those return `503 database_unreachable` after seeding, double-check the `DATABASE_URL` (Neon may require `?sslmode=require`).

## 6. Environment reference

Full list lives in [`.env.example`](.env.example). Required in production:

| Var | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection | `postgresql://…?sslmode=require` |
| `PORT` | Server port | `4000` (Render / Fly ignore this; they inject their own) |
| `NODE_ENV` | Runtime mode | `production` |
| `CORS_ORIGIN` | Comma-separated frontend origins | `https://skillswap.example.com` |
| `UPLOAD_DIR` | Local disk for uploads (mount a volume in prod) | `/var/data/uploads` |
| `MAX_UPLOAD_MB` | Upload size cap | `50` |
| `LOG_LEVEL` | pino level | `info` |
| `PLATFORM_FEE_PERCENT` | Escrow fee % | `5` |
| `RUSH_SURCHARGE_PAISE` | Flat rush add-on | `500000` (₹5,000) |
| `TRENDING_CRON` | Cron for the Phase 5 job | `*/5 * * * *` |
