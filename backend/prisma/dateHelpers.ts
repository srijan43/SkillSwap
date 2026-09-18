/**
 * Tiny date helpers used by the seed. We avoid pulling in date-fns just for
 * three functions in a single seed script.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const subDays = (from: Date, days: number): Date =>
  new Date(from.getTime() - days * DAY_MS);

export const addDays = (from: Date, days: number): Date =>
  new Date(from.getTime() + days * DAY_MS);

export const subHours = (from: Date, hours: number): Date =>
  new Date(from.getTime() - hours * HOUR_MS);
