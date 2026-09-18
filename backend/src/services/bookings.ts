import type { Prisma } from "@prisma/client";

import { AppError, badRequest, notFound, conflict } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { computeBreakdown } from "./money.js";
import { writeLedgerEntry, currentEscrowBalance } from "./escrow.js";
import { generateBookingId } from "./bookingId.js";

export interface CreateBookingInput {
  gigId: string;
  tierSlug: string;
  clientId: string;
  briefText: string;
  deliveryPace: "STANDARD" | "RUSH";
  attachments?: string[];
}

/**
 * Full include shape for booking reads. Bookings almost always come with
 * their tier, milestones and current ledger tail, so we centralise the shape
 * to avoid drift across services.
 */
export const bookingDetailInclude = {
  gig: {
    select: {
      id: true,
      slug: true,
      title: true,
      turnaroundDays: true,
      coverBadge: true,
      category: { select: { id: true, name: true, slug: true, colorToken: true } },
      creator: { select: { id: true, handle: true, name: true, avatarUrl: true, city: true } },
      media: {
        orderBy: { position: "asc" as const },
        take: 1,
        select: { url: true, type: true, caption: true },
      },
    },
  },
  tier: true,
  client: { select: { id: true, handle: true, name: true, avatarUrl: true, city: true } },
  creator: { select: { id: true, handle: true, name: true, avatarUrl: true, city: true } },
  milestones: { orderBy: { position: "asc" as const } },
  ledger: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

export type BookingDetail = Prisma.BookingGetPayload<{
  include: typeof bookingDetailInclude;
}>;

export async function createBooking(input: CreateBookingInput): Promise<BookingDetail> {
  // Client is guaranteed to be present here because the router validates it.
  const client = await prisma.user.findUnique({
    where: { id: input.clientId },
    select: { id: true },
  });
  if (!client) throw badRequest("Unknown clientId", { clientId: input.clientId });

  const gig = await prisma.gig.findUnique({
    where: { id: input.gigId },
    select: { id: true, status: true, creatorId: true, title: true, turnaroundDays: true },
  });
  if (!gig) throw notFound("Gig not found");
  if (gig.status !== "PUBLISHED") {
    throw conflict("Gig is not currently accepting bookings");
  }
  if (gig.creatorId === input.clientId) {
    throw badRequest("A creator cannot book their own gig");
  }

  const tier = await prisma.gigTier.findUnique({
    where: { gigId_slug: { gigId: input.gigId, slug: input.tierSlug } },
  });
  if (!tier) throw notFound("Tier not found for this gig");

  const breakdown = computeBreakdown(tier.price, input.deliveryPace);
  const bookingId = await generateBookingId();

  const dueAt = new Date(
    Date.now() +
      (input.deliveryPace === "RUSH" ? 1 : tier.deliveryDays) * 24 * 60 * 60 * 1000,
  );

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        id: bookingId,
        gigId: gig.id,
        tierId: tier.id,
        clientId: input.clientId,
        creatorId: gig.creatorId,
        briefText: input.briefText,
        attachments: input.attachments ?? [],
        deliveryPace: input.deliveryPace,
        priceAtBooking: tier.price,
        rushSurcharge: breakdown.rushSurcharge,
        platformFee: breakdown.platformFee,
        totalCharged: breakdown.total,
        status: "PENDING",
        dueAt,
      },
    });

    // First milestone: awaiting creator acceptance.
    await tx.milestone.create({
      data: {
        bookingId: booking.id,
        title: "Awaiting Creator Acceptance",
        position: 0,
        status: "PENDING",
      },
    });

    // HOLD includes the platform fee — the fee only leaves escrow on approval.
    await writeLedgerEntry(tx, {
      bookingId: booking.id,
      type: "HOLD",
      amount: breakdown.total,
      memo: `Escrow hold for ${booking.id}`,
    });

    await tx.activityEvent.createMany({
      data: [
        { userId: booking.creatorId, type: "BOOKING_CREATED", bookingId: booking.id, gigId: gig.id },
        { userId: booking.clientId, type: "ESCROW_HELD", bookingId: booking.id },
      ],
    });

    await tx.gig.update({
      where: { id: gig.id },
      data: { bookingCount: { increment: 1 } },
    });

    return tx.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: bookingDetailInclude,
    });
  });
}

export async function getBookingById(id: string): Promise<BookingDetail> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  });
  if (!booking) throw notFound("Booking not found");
  return booking;
}

/**
 * Escrow summary is derived, not stored. Reads the latest ledger balance and
 * reconstructs the checkout breakdown from the snapshot on the booking.
 */
export async function getEscrowSummary(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      priceAtBooking: true,
      rushSurcharge: true,
      platformFee: true,
      totalCharged: true,
      status: true,
      ledger: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) throw notFound("Booking not found");
  const balance = booking.ledger.at(-1)?.balanceAfter ?? 0;
  return {
    bookingId: booking.id,
    status: booking.status,
    priceAtBooking: booking.priceAtBooking,
    rushSurcharge: booking.rushSurcharge,
    subtotal: booking.priceAtBooking + booking.rushSurcharge,
    platformFee: booking.platformFee,
    totalCharged: booking.totalCharged,
    currentBalance: balance,
    entries: booking.ledger,
  };
}

export async function addAttachments(bookingId: string, urls: string[]) {
  if (urls.length === 0) return getBookingById(bookingId);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { attachments: true },
  });
  if (!booking) throw notFound("Booking not found");
  await prisma.booking.update({
    where: { id: bookingId },
    data: { attachments: [...booking.attachments, ...urls] },
  });
  return getBookingById(bookingId);
}

/**
 * Guardrail for routes that scope reads by actor. Throws 404 if the actor is
 * neither the client nor the creator on this booking.
 */
export function assertActorOnBooking(booking: BookingDetail, actorId: string) {
  if (booking.clientId !== actorId && booking.creatorId !== actorId) {
    throw new AppError(404, "not_found", "Booking not found");
  }
}

/** Re-export for tests. */
export { currentEscrowBalance };

// ─── Listing ───────────────────────────────────────────────────────────

export type BookingRole = "client" | "creator";

export interface ListBookingsInput {
  actorId: string;
  role: BookingRole;
  status?: Prisma.BookingWhereInput["status"];
  page: number;
  limit: number;
}

export async function listBookings({ actorId, role, status, page, limit }: ListBookingsInput) {
  const where: Prisma.BookingWhereInput = {
    ...(role === "client" ? { clientId: actorId } : { creatorId: actorId }),
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: bookingDetailInclude,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { total, rows };
}
