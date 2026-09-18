import { config } from "../lib/config.js";

/**
 * Single source of truth for the checkout math. Everything is in paise so
 * rounding drift stays out of ledger balances.
 */
export interface PriceBreakdown {
  tierPrice: number;
  rushSurcharge: number;
  subtotal: number;
  platformFee: number;
  total: number;
}

export function computeBreakdown(
  tierPrice: number,
  deliveryPace: "STANDARD" | "RUSH",
): PriceBreakdown {
  const rushSurcharge = deliveryPace === "RUSH" ? config.RUSH_SURCHARGE_PAISE : 0;
  const subtotal = tierPrice + rushSurcharge;
  const platformFee = Math.round((subtotal * config.PLATFORM_FEE_PERCENT) / 100);
  const total = subtotal + platformFee;
  return { tierPrice, rushSurcharge, subtotal, platformFee, total };
}
