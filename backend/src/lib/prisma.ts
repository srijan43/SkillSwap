import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient instance for the process.
 *
 * Under `tsx watch` the module can be re-imported on hot reloads, so we cache
 * the client on `globalThis` to avoid the "too many Prisma clients" warning
 * you get otherwise.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
