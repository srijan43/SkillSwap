import type { Request } from "express";
import { ZodSchema, ZodError } from "zod";

import { AppError } from "./errors.js";

/**
 * Parse a request part with a Zod schema. Throws AppError(422) with a
 * `details` field the frontend can read to highlight bad inputs.
 */
export function parseWith<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      422,
      "validation_failed",
      "Request validation failed",
      formatZodError(result.error),
    );
  }
  return result.data;
}

export const parseQuery = <T>(schema: ZodSchema<T>, req: Request): T =>
  parseWith(schema, req.query);

export const parseParams = <T>(schema: ZodSchema<T>, req: Request): T =>
  parseWith(schema, req.params);

export const parseBody = <T>(schema: ZodSchema<T>, req: Request): T =>
  parseWith(schema, req.body);

function formatZodError(err: ZodError) {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
