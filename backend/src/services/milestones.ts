import type { MilestoneStatus, Prisma } from "@prisma/client";

import { AppError, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface AddMilestoneInput {
  bookingId: string;
  actorId: string;
  title: string;
  dueDate?: Date;
}

export interface UpdateMilestoneInput {
  milestoneId: string;
  actorId: string;
  title?: string;
  status?: MilestoneStatus;
  deliverableUrl?: string;
  dueDate?: Date;
}

/**
 * Only the creator on the booking can add or edit milestones. Clients read
 * them via the booking detail response.
 */
async function assertCreator(
  tx: Prisma.TransactionClient | typeof prisma,
  bookingId: string,
  actorId: string,
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { creatorId: true },
  });
  if (!booking) throw notFound("Booking not found");
  if (booking.creatorId !== actorId) {
    throw new AppError(403, "forbidden", "Only the creator can edit milestones");
  }
}

export async function addMilestone({ bookingId, actorId, title, dueDate }: AddMilestoneInput) {
  await assertCreator(prisma, bookingId, actorId);
  const lastPosition = await prisma.milestone.findFirst({
    where: { bookingId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (lastPosition?.position ?? -1) + 1;
  const created = await prisma.milestone.create({
    data: {
      bookingId,
      title,
      position,
      dueDate,
      status: "PENDING",
    },
  });
  await prisma.activityEvent.create({
    data: {
      userId: actorId,
      type: "MILESTONE_UPDATED",
      bookingId,
      payload: { action: "added", milestoneId: created.id, title },
    },
  });
  return created;
}

export async function updateMilestone({
  milestoneId,
  actorId,
  title,
  status,
  deliverableUrl,
  dueDate,
}: UpdateMilestoneInput) {
  const existing = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, bookingId: true, status: true },
  });
  if (!existing) throw notFound("Milestone not found");
  await assertCreator(prisma, existing.bookingId, actorId);

  const data: Prisma.MilestoneUpdateInput = {};
  if (title !== undefined) data.title = title;
  if (deliverableUrl !== undefined) data.deliverableUrl = deliverableUrl;
  if (dueDate !== undefined) data.dueDate = dueDate;
  if (status !== undefined) {
    data.status = status;
    if (status === "COMPLETED") data.completedAt = new Date();
    if (status !== "COMPLETED") data.completedAt = null;
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data,
  });

  // Serialise only the fields the caller changed; Prisma's update-input type
  // includes nested relation shapes that don't cleanly encode to JSON.
  const changes: Record<string, unknown> = {};
  if (title !== undefined) changes.title = title;
  if (status !== undefined) changes.status = status;
  if (deliverableUrl !== undefined) changes.deliverableUrl = deliverableUrl;
  if (dueDate !== undefined) changes.dueDate = dueDate.toISOString();
  await prisma.activityEvent.create({
    data: {
      userId: actorId,
      type: "MILESTONE_UPDATED",
      bookingId: existing.bookingId,
      payload: { action: "updated", milestoneId, changes } as Prisma.InputJsonValue,
    },
  });

  return updated;
}
