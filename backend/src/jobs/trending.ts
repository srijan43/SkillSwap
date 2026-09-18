import cron from "node-cron";

import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { recomputeAllTrendingScores } from "../services/trending.js";

/**
 * Register the trending-score recompute on the configured cron schedule
 * (default every 5 minutes). Non-fatal errors get logged so one bad run does
 * not tank the process.
 */
export function startTrendingJob() {
  if (!cron.validate(config.TRENDING_CRON)) {
    logger.error({ TRENDING_CRON: config.TRENDING_CRON }, "invalid TRENDING_CRON expression");
    return;
  }
  logger.info({ schedule: config.TRENDING_CRON }, "trending recompute job scheduled");
  cron.schedule(config.TRENDING_CRON, async () => {
    try {
      const start = Date.now();
      const { updated } = await recomputeAllTrendingScores();
      logger.info({ updated, ms: Date.now() - start }, "trending recompute complete");
    } catch (err) {
      logger.error({ err }, "trending recompute failed");
    }
  });
}
