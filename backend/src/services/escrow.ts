import { Prisma, LedgerType } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

/**
 * Prisma exposes two transaction-client shapes: the top-level PrismaClient
 * and the one passed to interactive transactions. This alias covers both so
 * callers can pass either.
 */
export type PrismaTxClient =
  | typeof prisma
  | Prisma.TransactionClient;

/**
 * Read the current held balance for a booking. Zero if no entries exist yet
 * (booking was created but escrow write failed, which the caller should have
 * rolled back — we defensively return 0 rather than throwing).
 */
export async function currentEscrowBalance(
  tx: PrismaTxClient,
  bookingId: string,
): Promise<number> {
  const latest = await tx.escrowLedgerEntry.findFirst({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

export interface WriteEntryInput {
  bookingId: string;
  type: LedgerType;
  /**
   * Signed amount in paise:
   *  - positive for HOLD / ADJUSTMENT (adds to escrow)
   *  - negative for RELEASE / REFUND / PLATFORM_FEE (removes from escrow)
   * A zero-amount write is rejected because it carries no ledger meaning.
   */
  amount: number;
  memo?: string;
}

/**
 * Append an entry to a booking's escrow ledger. Enforces the balance
 * invariant (`balanceAfter >= 0`) inside the same transaction that flips
 * whatever status the entry pairs with — so a broken write rolls back the
 * status change too.
 *
 * Pass the caller's transaction client so the ledger append participates in
 * the surrounding transaction; without it the two writes could commit
 * independently and leave state inconsistent.
 */
export async function writeLedgerEntry(
  tx: PrismaTxClient,
  { bookingId, type, amount, memo }: WriteEntryInput,
) {
  if (amount === 0) {
    throw new AppError(500, "internal_error", "Zero-amount ledger write is not allowed");
  }
  // Direction / type consistency check keeps ledger reads self-explanatory.
  const shouldBePositive = type === "HOLD" || type === "ADJUSTMENT";
  if (shouldBePositive && amount <= 0) {
    throw new AppError(500, "internal_error", `${type} entries must have a positive amount`);
  }
  if (!shouldBePositive && amount >= 0) {
    throw new AppError(500, "internal_error", `${type} entries must have a negative amount`);
  }

  const current = await currentEscrowBalance(tx, bookingId);
  const balanceAfter = current + amount;
  if (balanceAfter < 0) {
    throw new AppError(
      409,
      "conflict",
      `Escrow write would take balance below zero (current=${current}, delta=${amount})`,
    );
  }

  return tx.escrowLedgerEntry.create({
    data: {
      bookingId,
      type,
      amount,
      balanceAfter,
      memo,
    },
  });
}
