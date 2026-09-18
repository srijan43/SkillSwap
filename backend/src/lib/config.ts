import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  TRENDING_CRON: z.string().default("*/5 * * * *"),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(5),
  RUSH_SURCHARGE_PAISE: z.coerce.number().int().nonnegative().default(500_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly at boot rather than at first request.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
};

export type AppConfig = typeof config;
