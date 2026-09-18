import { customAlphabet } from "nanoid";

import { prisma } from "../lib/prisma.js";

/**
 * Human-readable order IDs (`ORD-XXXX`). We keep them short so they render
 * cleanly in the frontend chips, and we retry on the (very rare) collision
 * rather than bumping the alphabet size. Format matches the seed IDs already
 * visible in the frontend copy (`ORD-8921`, `ORD-7734`, …).
 */
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // No 0/1/I/O/L for readability.
const nano = customAlphabet(alphabet, 5);

const MAX_ATTEMPTS = 6;

export async function generateBookingId(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = `ORD-${nano()}`;
    // Uniqueness check: rare miss on 5-char alphabet of 31 chars (~28M values),
    // but the loop keeps us safe as data grows.
    const existing = await prisma.booking.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Could not generate a unique booking id after retries");
}
