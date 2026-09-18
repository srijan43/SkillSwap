import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { apiRouter } from "./api.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { startTrendingJob } from "./jobs/trending.js";

/**
 * Phase 2 server: mounts `/api` (categories + gigs) with a global read
 * limiter, plus the /health probe and the shared JSON error envelope.
 */
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
  }),
);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "skillswap-backend", version: "0.5.0" });
  } catch (err) {
    logger.error({ err }, "health check DB probe failed");
    res.status(503).json({ ok: false, error: "database_unreachable" });
  }
});

// Serve locally-uploaded files. In production this mount is fronted by the
// storage adapter's real backing (S3 signed URLs, etc); the path shape stays
// the same so the frontend does not need to know which adapter is active.
app.use(
  "/uploads",
  express.static(path.resolve(config.UPLOAD_DIR), {
    fallthrough: true,
    index: false,
  }),
);

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    "skillswap-backend listening",
  );
  // Background jobs live in-process. Fine for a single-instance deploy;
  // multi-instance deploys should gate this on a leader-election flag.
  startTrendingJob();
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
