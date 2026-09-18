import rateLimit from "express-rate-limit";

/**
 * See DECISIONS.md § Rate limits. We keep two buckets: reads are permissive
 * enough for a lively marketplace UI, writes are tight enough to make abuse
 * expensive.
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "rate_limited", message: "Too many read requests" },
  },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "rate_limited", message: "Too many write requests" },
  },
});
