import type { LedgerType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

/**
 * Dashboard rollup for a single creator. One query per metric, all fired in
 * parallel — enough for a demo dashboard without a materialised view.
 */
export async function getCreatorDashboard(creatorId: string) {
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: {
      id: true,
      handle: true,
      name: true,
      avatarUrl: true,
      city: true,
      successScore: true,
      responseHours: true,
      gigsCompleted: true,
      ratingAverage: true,
      reviewCount: true,
    },
  });
  if (!creator) throw notFound("Creator not found");

  const [
    totalEarnings,
    monthlyEarnings,
    activeCounts,
    upcomingRequests,
    weeklyViews,
    activity,
    pendingPayout,
  ] = await Promise.all([
    // Lifetime earnings = sum of RELEASE ledger entries flowing to this creator.
    sumLedgerForCreator(creatorId, "RELEASE"),
    // Last-30-days earnings for the sparkline caption.
    sumLedgerForCreator(creatorId, "RELEASE", 30),
    prisma.booking.groupBy({
      by: ["status"],
      where: { creatorId },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { creatorId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        gig: { select: { title: true } },
        tier: { select: { name: true, price: true } },
        client: { select: { id: true, handle: true, name: true, avatarUrl: true } },
      },
    }),
    // Simple weekly-impressions proxy: sum of view counts on this creator's gigs.
    prisma.gig
      .aggregate({ where: { creatorId }, _sum: { viewCount: true } })
      .then((r) => r._sum.viewCount ?? 0),
    prisma.activityEvent.findMany({
      where: { userId: creatorId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // "Payout" pill in the dashboard: currently-held escrow balance across
    // in-flight bookings, i.e. cash the creator will receive on approval.
    heldForCreator(creatorId),
  ]);

  const activeMap: Record<string, number> = {};
  for (const row of activeCounts) activeMap[row.status] = row._count._all;
  const activePipeline =
    (activeMap.ACCEPTED ?? 0) + (activeMap.IN_PROGRESS ?? 0) + (activeMap.DELIVERED ?? 0);

  return {
    creator,
    earnings: {
      totalPaise: totalEarnings,
      last30DaysPaise: monthlyEarnings,
      pendingPayoutPaise: pendingPayout,
    },
    activePipeline: {
      total: activePipeline,
      byStatus: activeMap,
    },
    successScore: creator.successScore,
    weeklyImpressions: weeklyViews,
    incomingRequests: upcomingRequests,
    activity,
  };
}

export async function getCreatorActivity(creatorId: string, take = 20) {
  return prisma.activityEvent.findMany({
    where: { userId: creatorId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function sumLedgerForCreator(
  creatorId: string,
  type: LedgerType,
  windowDays?: number,
): Promise<number> {
  const where = {
    type,
    booking: { creatorId },
    ...(windowDays
      ? { createdAt: { gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) } }
      : {}),
  };
  const agg = await prisma.escrowLedgerEntry.aggregate({
    where,
    _sum: { amount: true },
  });
  // RELEASE amounts are negative in the ledger; flip the sign for a positive earning number.
  return Math.abs(agg._sum.amount ?? 0);
}

async function heldForCreator(creatorId: string): Promise<number> {
  const bookings = await prisma.booking.findMany({
    where: {
      creatorId,
      status: { in: ["ACCEPTED", "IN_PROGRESS", "DELIVERED"] },
    },
    select: {
      id: true,
      ledger: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { balanceAfter: true },
      },
    },
  });
  return bookings.reduce((s, b) => s + (b.ledger[0]?.balanceAfter ?? 0), 0);
}
