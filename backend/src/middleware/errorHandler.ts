import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err }, "unhandled error");
  res.status(500).json({
    error: {
      code: "internal_error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: "not_found", message: "Route not found" },
  });
};
