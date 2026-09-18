import type { BookingStatus, Prisma } from "@prisma/client";

import { AppError, conflict, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { writeLedgerEntry, currentEscrowBalance } from "./escrow.js";
import { bookingDetailInclude, type BookingDetail } from "./bookings.js";

type Actor = "CREATOR" | "CLIENT";

/**
 * State machine table. Every allowed transition names the actor who can
 * trigger it. Anything not listed here throws a 409.
 *
 * PENDING     → ACCEPTED  | DECLINED | CANCELLED
 * ACCEPTED    → IN_PROGRESS | CANCELLED
 * IN_PROGRESS → DELIVERED
 * DELIVERED   → APPROVED  | DISPUTED
 * APPROVED    → COMPLETED (auto, inside approve)
 *
 * See DECISIONS.md § Booking lifecycle.
 */
const TRANSITIONS: Record<string, { from: BookingStatus[]; to: BookingStatus; actor: Actor }> = {
  accept:   { from: ["PENDING"], to: "ACCEPTED", actor: "CREATOR" },
  decline:  { from: ["PENDING"], to: "DECLINED", actor: "CREATOR" },
  start:    { from: ["ACCEPTED"], to: "IN_PROGRESS", actor: "CREATOR" },
  deliver:  { from: ["ACCEPTED", "IN_PROGRESS"], to: "DELIVERED", actor: "CREATOR" },
  approve:  { from: ["DELIVERED"], to: "APPROVED", actor: "CLIENT" },
  dispute:  { from: ["DELIVERED"], to: "DISPUTED", actor: "CLIENT" },
  cancel:   { from: ["PENDING", "ACCEPTED"], to: "CANCELLED", actor: "CLIENT" }, // Client OR creator handled in code.
};

function assertRole(actor: Actor, booking: { clientId: string; creatorId: string }, actorId: string) {
  if (actor === "CREATOR" && booking.creatorId !== actorId) {
    throw new AppError(403, "forbidden", "Only the creator can perform this action");
  }
  if (actor === "CLIENT" && booking.clientId !== actorId) {
    throw new AppError(403, "forbidden", "Only the client can perform this action");
  }
}

function assertFrom(current: BookingStatus, allowed: BookingStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw conflict(
      `Cannot ${action} a booking in status ${current} (allowed: ${allowed.join(", ")})`,
    );
  }
}

async function loadBooking(tx: Prisma.TransactionClient, id: string) {
  const booking = await tx.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      clientId: true,
      creatorId: true,
      priceAtBooking: true,
      rushSurcharge: true,
      platformFee: true,
      totalCharged: true,
      createdAt: true,
      acceptedAt: true,
    },
  });
  if (!booking) throw notFound("Booking not found");
  return booking;
}

async function reloadDetail(tx: Prisma.TransactionClient, id: string): Promise<BookingDetail> {
  return tx.booking.findUniqueOrThrow({
    where: { id },
    include: bookingDetailInclude,
  });
}

/**
 * Update the creator's cached responseHours as bookings get accepted. Cheap
 * exponential-ish running average — good enough for a demo dashboard without
 * running a scheduled recompute.
 */
async function bumpResponseHours(
  tx: Prisma.TransactionClient,
  creatorId: string,
  createdAt: Date,
) {
  const responseHours = Math.max(
    0.1,
    (Date.now() - createdAt.getTime()) / (60 * 60 * 1000),
  );
  const creator = await tx.user.findUnique({
    where: { id: creatorId },
    select: { responseHours: true },
  });
  const prev = creator?.responseHours ?? 24;
  // 70/30 weighted moving average biased toward the newer sample.
  const next = Number((prev * 0.7 + responseHours * 0.3).toFixed(2));
  await tx.user.update({ where: { id: creatorId }, data: { responseHours: next } });
}

// ── Actions ────────────────────────────────────────────────────────────

export async function acceptBooking(id: string, actorId: string): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.accept!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.accept!.from, "accept");

    await tx.booking.update({
      where: { id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    // Push the initial milestone forward and add the standard delivery step.
    const first = await tx.milestone.findFirst({
      where: { bookingId: id },
      orderBy: { position: "asc" },
    });
    if (first) {
      await tx.milestone.update({
        where: { id: first.id },
        data: { title: "Escrow Funded & Accepted", status: "COMPLETED", completedAt: new Date() },
      });
    }
    await tx.milestone.create({
      data: {
        bookingId: id,
        title: "In Progress",
        status: "IN_PROGRESS",
        position: (first?.position ?? 0) + 1,
      },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.creatorId, type: "BOOKING_ACCEPTED", bookingId: id },
        { userId: b.clientId, type: "BOOKING_ACCEPTED", bookingId: id },
      ],
    });

    await bumpResponseHours(tx, b.creatorId, b.createdAt);

    return reloadDetail(tx, id);
  });
}

export async function declineBooking(
  id: string,
  actorId: string,
  reason?: string,
): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.decline!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.decline!.from, "decline");

    // Full refund back to the client. Balance goes to zero.
    const balance = await currentEscrowBalance(tx, id);
    if (balance > 0) {
      await writeLedgerEntry(tx, {
        bookingId: id,
        type: "REFUND",
        amount: -balance,
        memo: reason ? `Declined by creator: ${reason}` : "Declined by creator",
      });
    }

    await tx.booking.update({
      where: { id },
      data: { status: "DECLINED" },
    });

    await tx.gig.update({
      where: { id: (await tx.booking.findUniqueOrThrow({ where: { id }, select: { gigId: true } })).gigId },
      data: { bookingCount: { decrement: 1 } },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.creatorId, type: "BOOKING_DECLINED", bookingId: id, payload: reason ? { reason } : undefined },
        { userId: b.clientId, type: "ESCROW_REFUNDED", bookingId: id },
      ],
    });

    return reloadDetail(tx, id);
  });
}

export async function startBooking(id: string, actorId: string): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.start!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.start!.from, "start");
    await tx.booking.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    return reloadDetail(tx, id);
  });
}

export async function deliverBooking(
  id: string,
  actorId: string,
  deliverableUrl?: string,
  note?: string,
): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.deliver!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.deliver!.from, "deliver");

    await tx.booking.update({
      where: { id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });

    // Mark the current IN_PROGRESS milestone completed and add a review step.
    const inProgress = await tx.milestone.findFirst({
      where: { bookingId: id, status: { in: ["IN_PROGRESS", "PENDING"] } },
      orderBy: { position: "desc" },
    });
    if (inProgress) {
      await tx.milestone.update({
        where: { id: inProgress.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          deliverableUrl: deliverableUrl ?? inProgress.deliverableUrl,
        },
      });
    }
    await tx.milestone.create({
      data: {
        bookingId: id,
        title: "Awaiting Client Review",
        status: "IN_PROGRESS",
        position: (inProgress?.position ?? 0) + 1,
      },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.creatorId, type: "BOOKING_DELIVERED", bookingId: id, payload: note ? { note } : undefined },
        { userId: b.clientId, type: "BOOKING_DELIVERED", bookingId: id },
      ],
    });

    return reloadDetail(tx, id);
  });
}

export async function approveBooking(id: string, actorId: string): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.approve!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.approve!.from, "approve");

    // Two ledger writes: platform fee first (to the platform), then the
    // remaining balance out to the creator. Together they zero the balance.
    if (b.platformFee > 0) {
      await writeLedgerEntry(tx, {
        bookingId: id,
        type: "PLATFORM_FEE",
        amount: -b.platformFee,
        memo: "Platform fee",
      });
    }
    const balance = await currentEscrowBalance(tx, id);
    if (balance > 0) {
      await writeLedgerEntry(tx, {
        bookingId: id,
        type: "RELEASE",
        amount: -balance,
        memo: "Payout to creator",
      });
    }

    const now = new Date();
    await tx.booking.update({
      where: { id },
      data: {
        status: "COMPLETED",
        approvedAt: now,
        completedAt: now,
      },
    });

    // Close out the final milestone.
    const last = await tx.milestone.findFirst({
      where: { bookingId: id },
      orderBy: { position: "desc" },
    });
    if (last) {
      await tx.milestone.update({
        where: { id: last.id },
        data: { status: "COMPLETED", completedAt: now },
      });
    }

    // Bump the creator's cached rollups so the dashboard reflects the completion
    // without waiting for the Phase 5 recompute job.
    await tx.user.update({
      where: { id: b.creatorId },
      data: { gigsCompleted: { increment: 1 } },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.clientId, type: "BOOKING_APPROVED", bookingId: id },
        { userId: b.creatorId, type: "ESCROW_RELEASED", bookingId: id },
      ],
    });

    return reloadDetail(tx, id);
  });
}

export async function disputeBooking(
  id: string,
  actorId: string,
  reason: string,
): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    assertRole(TRANSITIONS.dispute!.actor, b, actorId);
    assertFrom(b.status, TRANSITIONS.dispute!.from, "dispute");

    await tx.booking.update({
      where: { id },
      data: { status: "DISPUTED" },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.clientId, type: "BOOKING_DISPUTED", bookingId: id, payload: { reason } },
        { userId: b.creatorId, type: "BOOKING_DISPUTED", bookingId: id, payload: { reason } },
      ],
    });

    return reloadDetail(tx, id);
  });
}

/**
 * Cancel a booking (client or creator). Refunds the current escrow balance
 * back to the client. Only valid while the booking is still PENDING or
 * ACCEPTED — after IN_PROGRESS work has started, use dispute instead.
 */
export async function cancelBooking(
  id: string,
  actorId: string,
  reason?: string,
): Promise<BookingDetail> {
  return prisma.$transaction(async (tx) => {
    const b = await loadBooking(tx, id);
    // Either party can cancel; check membership only.
    if (b.clientId !== actorId && b.creatorId !== actorId) {
      throw new AppError(403, "forbidden", "Only a booking participant can cancel");
    }
    assertFrom(b.status, TRANSITIONS.cancel!.from, "cancel");

    const balance = await currentEscrowBalance(tx, id);
    if (balance > 0) {
      await writeLedgerEntry(tx, {
        bookingId: id,
        type: "REFUND",
        amount: -balance,
        memo: reason ? `Cancelled: ${reason}` : "Cancelled",
      });
    }

    await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: b.clientId, type: "BOOKING_CANCELLED", bookingId: id, payload: reason ? { reason } : undefined },
        { userId: b.creatorId, type: "BOOKING_CANCELLED", bookingId: id, payload: reason ? { reason } : undefined },
      ],
    });

    return reloadDetail(tx, id);
  });
}
