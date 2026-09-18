# SkillSwap — Decisions

Living record of the non-obvious choices made while wiring the backend to the current frontend. Additions land here as later phases ship.

## Scope

**Cash-only marketplace.** The frontend was scrubbed of skill-swap / barter surfaces before backend work began, so the backend drops `SwapProposal`, `SwapCriteria`, `BARTER` / `HYBRID` exchange types, and the `/api/gigs/:id/swap-matches` endpoint from the original build prompt. The `Gig.exchangeType` column is gone; every gig is cash-priced against one or more `GigTier` rows. If swap resurfaces in the UI later, we re-add these tables in a new migration rather than carrying them dormant.

## Auth

**No auth, no sessions, no signup.** Explicit `creatorId` / `clientId` route or query params identify the actor on every call, per the build prompt's constraints. Consequences:

- Any client that knows a booking ID can read it. Access controls are `where: { OR: [{ clientId }, { creatorId }] }` guards inside the query, not middleware. Enforce this at every read that touches booking-scoped data.
- Socket.io rooms (`creator:{id}:requests`, `booking:{id}:escrow`) accept any join. In a real build these would be gated by a session token; here they're demo-open.
- File deliverables served from `UPLOAD_DIR` are not signed. Anyone with the URL can fetch. Acceptable for the demo; document a signed-URL upgrade path when we swap in S3.

## Money

- **Currency is INR.** Every visible amount on the frontend and every stored amount in the database is in Indian Rupees. Original USD prices from the mockups were converted at **1 USD ≈ ₹83** and rounded so totals in seed rows line up with what the checkout shows.
- **Paise, integer.** All prices, surcharges, fees, and ledger amounts are integer paise (₹1 = 100 paise). No floats anywhere in money paths. Displays convert to rupees at the response boundary or (preferably) in the frontend with `Intl.NumberFormat('en-IN')`.
- **Platform fee.** `PLATFORM_FEE_PERCENT` (default 5%) is charged **on top of** the tier price + rush surcharge, and held in the same escrow row as the base amount. On approval the ledger writes two entries: `PLATFORM_FEE` (negative, to the platform), then `RELEASE` (negative, to the creator). Together they zero the balance.
- **Rush delivery.** Flat `RUSH_SURCHARGE_PAISE` (default ₹5,000 = 500,000 paise) added to the subtotal when `deliveryPace = RUSH`. Matches the frontend's "+₹5,000 Rush" pill.

## Booking lifecycle

State machine (transitions enforced in the booking service, tested in `tests/bookingStateMachine.test.ts` from Phase 4):

```
PENDING ──accept──▶ ACCEPTED ──▶ IN_PROGRESS ──deliver──▶ DELIVERED
   │                    │                                        │
   ├─decline──▶ DECLINED│                                        ├─approve──▶ APPROVED ──▶ COMPLETED
   └─cancel───▶ CANCELLED└─cancel──▶ CANCELLED                   └─dispute──▶ DISPUTED
```

- **Decline refunds immediately.** When a creator declines a `PENDING` booking, the service writes a `REFUND` ledger entry inside the same transaction that flips `status → DECLINED`. The booking stays visible in the client's history under a `Declined` filter — we do not soft-delete.
- **Cancel from `PENDING` or `ACCEPTED`.** After `IN_PROGRESS`, cancellation becomes `DISPUTED` instead. Prevents a client from pulling funds out of an in-flight job.
- **Approve is idempotent-ish.** `POST /api/bookings/:id/approve` on an already-`APPROVED` booking is a 409 with `code: "booking_already_approved"`, not a re-release. The client's UI should show the terminal state before allowing the click, but the server refuses to double-release.

## Concurrent bookings per gig

**Allowed.** A gig can hold any number of `PENDING` bookings simultaneously — this is how Fiverr / Upwork behave and it stops legitimate demand from being locked out by a stale request. The creator's dashboard lists them all; they accept/decline one at a time. If a creator wants exclusivity, they pause the gig (`status = PAUSED`), which stops new `POST /api/bookings` calls but leaves existing bookings untouched.

## Escrow ledger

- **Balance is derived, not stored.** `Booking` has no `escrowBalance` column. The current held amount is `EscrowLedgerEntry` with the newest `createdAt` for that booking, `balanceAfter` field. This is O(1) via the `(bookingId, createdAt)` index.
- **Non-negative invariant.** The escrow service refuses to write an entry that would take `balanceAfter` below zero. Enforced with a runtime check inside the Prisma transaction; a broken write throws and rolls back the status change tied to it.
- **Two-entry release.** Approving a booking writes `PLATFORM_FEE` then `RELEASE`, both within the same transaction as the `status → APPROVED` flip. If any one write fails, the whole thing rolls back and the funds stay held.

## Trending score

Recomputed every `TRENDING_CRON` (default 5 minutes) for all `PUBLISHED` gigs. Formula:

```
score = 0.40 * bookings_last_7d
      + 0.20 * views_last_7d / 100
      + 0.25 * rating_average
      + 0.15 * recency_boost
```

Where `recency_boost = exp(-ageDays / 7)` — a half-life-like decay favouring gigs published in the last week. Weights are named constants in `src/jobs/trending.ts` so they're easy to justify in a demo.

## Success score

Per-creator composite, in `[0, 100]`:

```
success = 0.5 * completionRate * 100
        + 0.3 * (ratingAverage / 5) * 100
        + 0.2 * responseBonus
```

Where `responseBonus = clamp(100 - responseHours * 2, 0, 100)` — quicker responses earn more, floors at 0 when average response is 50h+. Recomputed on booking `COMPLETED` transition; cached on `User.successScore` so the dashboard doesn't recompute per request.

## Rate limits

Rolling window via `express-rate-limit`:

- **Writes** (POST / PATCH / DELETE): 60 requests / IP / minute.
- **Reads** (GET): 300 requests / IP / minute.

Bypassed for `/health`. In production the frontend-served origin and any known e2e-test IP go on the allowlist.

## Sockets (deferred)

The spec calls for a Socket.io layer for two things: creator dashboard incoming requests and escrow-write notifications. **We shipped without it.** Every screen already renders correctly on plain request/response, and the dashboard fetches its data on page load. When the UX needs live push (multiple viewers on the same booking, in particular), add:

- `creator:{id}:requests` — a new `BOOKING_CREATED` lands.
- `booking:{id}:escrow` — an `EscrowLedgerEntry` was written for the booking.

Both are demo-open (no auth) and would emit from inside the same Prisma transactions that write the underlying row.

## Storage

Uploads (gig media, booking attachments, deliverables) go through a `StorageAdapter` interface with a local-disk implementation for now. Swap to S3 or Cloudinary later without touching route handlers.

## Deployment

Not yet deployed. Target: Render (API) + Neon (Postgres) once Phase 7 lands. The API is stateless apart from local uploads, so scaling horizontally is safe once the storage adapter points at S3.
