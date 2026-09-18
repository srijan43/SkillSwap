# SkillSwap Backend

Node.js + TypeScript + Express + Prisma + PostgreSQL. Cash-only creator marketplace API that backs the existing static frontend in the sibling folder.

**Status:** Phase 1 shipped — schema, seed, boot skeleton. Phases 2–7 land per `../DECISIONS.md` in later commits.

## Prerequisites

- Node.js **≥ 20**
- Docker (for local Postgres) **or** any Postgres 15+ instance you already run
- npm 10+ (ships with Node 20)

## Setup

```bash
cd backend
cp .env.example .env
npm install
docker compose up -d postgres      # start local Postgres on :5432
npm run prisma:migrate -- --name init
npm run seed
npm run dev                        # http://localhost:4000/health
```

If you have Postgres already (Neon, Supabase, local install), skip the `docker compose` line and edit `DATABASE_URL` in `.env` to point at it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Boot the API with `tsx watch` (reloads on save). |
| `npm run build` | Compile TS to `dist/`. |
| `npm start` | Run the compiled server. |
| `npm run prisma:migrate` | Create a new migration and apply it locally. |
| `npm run prisma:migrate:deploy` | Apply committed migrations in a deploy env. |
| `npm run prisma:reset` | Drop the DB and re-run migrations + seed. Destructive. |
| `npm run prisma:studio` | Open Prisma Studio at `:5555`. |
| `npm run seed` | Idempotent demo seed (creators, gigs, bookings). |
| `npm test` | Run Jest + Supertest suite. |

## Environment variables

See [`.env.example`](.env.example) for the full list. Notable ones:

- `DATABASE_URL` — Postgres connection string. Required.
- `PORT` — API port (default 4000).
- `CORS_ORIGIN` — comma-separated allowlist for the frontend origin(s).
- `PLATFORM_FEE_PERCENT` — Platform fee held with escrow (default 5%).
- `RUSH_SURCHARGE_PAISE` — Flat rush-delivery surcharge in paise (default 500000 = ₹5,000).

## Data model

Full schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). Highlights:

- **Money is paise.** Every price, fee, and ledger amount is an integer number of paise (₹1 = 100 paise). Avoids float drift.
- **Escrow is a ledger, not a flag.** `EscrowLedgerEntry` rows carry `type` (`HOLD | RELEASE | REFUND | PLATFORM_FEE | ADJUSTMENT`), signed `amount`, and `balanceAfter`. The current escrow balance for any booking is the newest entry's `balanceAfter`; there's no mutable "paid" boolean that can drift.
- **No auth.** `creatorId` / `clientId` come in as route or query params. See `../DECISIONS.md`.

## Deploy notes

- API: Render, Railway, or Fly.io all work with the built-in `npm start`.
- DB: Neon, Supabase, or Railway Postgres. Set `DATABASE_URL` and run `npm run prisma:migrate:deploy` at release time.
- Uploads land in `UPLOAD_DIR` (local disk) via a storage adapter interface — swap for S3/Cloudinary later without touching business logic.

## Phase roadmap

1. ✅ Schema, migrations, seed data
2. ✅ Gigs, categories, marketplace search/filter
3. ✅ Booking creation + escrow HOLD
4. ✅ Booking status transitions + escrow RELEASE/REFUND
5. ✅ Trending score cron, creator dashboard rollups, gig create, user lookup
6. Deferred — Socket.io realtime (request/response covers every screen; add later if the UX needs live push)
7. Deferred — Jest suite + Swagger (fold in with the hardening pass after first deploy)
