# SkillSwap — Decisions

Living record of the non-obvious choices made while wiring the backend to the current frontend. Additions land here as later phases ship.

## DP1 · Feed order
The public feed is primarily ordered by a composite "trending score", avoiding a pure recency sort. This composite score factors in recent bookings, views, average ratings, and a recency decay factor (half-life). This approach surfaces high-quality, in-demand services while still giving newer gigs a fighting chance to be discovered.

## DP2 · Visibility
Unverified claims (new gigs) are publicly visible immediately upon submission without a manual review gate. To maintain marketplace liquidity and avoid operational bottlenecks from manual review, we allow instant publishing. We rely instead on the post-booking Escrow & Dispute system, alongside community flags, to catch and penalize bad actors.

## DP3 · Editing
A claim (gig) can be edited freely after submission, but major structural edits flag the gig for a background trust-and-safety re-evaluation. This prevents "bait-and-switch" tactics where a creator ranks highly for a benign service and then swaps the content entirely. The gig remains live during this background check unless explicitly paused by an admin.
