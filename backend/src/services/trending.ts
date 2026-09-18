import { prisma } from "../lib/prisma.js";

/**
 * Trending score formula (see DECISIONS.md § Trending score):
 *   score = 0.40 * bookings_last_7d
 *         + 0.20 * views_last_7d / 100
 *         + 0.25 * ratingAverage
 *         + 0.15 * recency_boost
 *
 * `recency_boost = exp(-ageDays / 7)` — half-life-ish decay favouring newer gigs.
 *
 * We don't have per-day view timeseries in the schema, so `viewCount` acts as
 * a proxy for "last 7d views" divided by 100 to keep the magnitude sane.
 * When the platform grows a real time-series table this changes without
 * touching the rest of the ranking.
 */
export const TRENDING_WEIGHTS = {
  bookings7d: 0.4,
  views: 0.2,
  rating: 0.25,
  recency: 0.15,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrendingInput {
  bookings7d: number;
  viewCount: number;
  ratingAverage: number;
  ageDays: number;
}

export function computeTrendingScore(g: TrendingInput): number {
  const recencyBoost = Math.exp(-g.ageDays / 7);
  const score =
    TRENDING_WEIGHTS.bookings7d * g.bookings7d +
    TRENDING_WEIGHTS.views * (g.viewCount / 100) +
    TRENDING_WEIGHTS.rating * g.ratingAverage +
    TRENDING_WEIGHTS.recency * recencyBoost;
  return Number(score.toFixed(4));
}

/**
 * Recompute trending scores for every PUBLISHED gig and update the cached
 * column. Cheap enough to run every few minutes at demo scale (single query
 * per gig; a few hundred gigs is under 100ms total).
 */
export async function recomputeAllTrendingScores(): Promise<{ updated: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const gigs = await prisma.gig.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      viewCount: true,
      ratingAverage: true,
      createdAt: true,
      _count: {
        select: {
          bookings: {
            where: { createdAt: { gte: sevenDaysAgo } },
          },
        },
      },
    },
  });

  let updated = 0;
  await Promise.all(
    gigs.map(async (g) => {
      const ageDays = (Date.now() - g.createdAt.getTime()) / DAY_MS;
      const score = computeTrendingScore({
        bookings7d: g._count.bookings,
        viewCount: g.viewCount,
        ratingAverage: g.ratingAverage,
        ageDays,
      });
      await prisma.gig.update({ where: { id: g.id }, data: { trendingScore: score } });
      updated++;
    }),
  );
  return { updated };
}
