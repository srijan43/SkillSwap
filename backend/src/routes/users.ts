import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseParams } from "../lib/validate.js";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export const usersRouter = Router();

const handleParamSchema = z.object({
  handle: z.string().trim().min(2).max(64),
});

/**
 * GET /api/users/by-handle/:handle
 * Small lookup so the frontend can bind a demo actor identity (no auth).
 * Returns only the fields the UI needs to render a "current user" chip.
 */
usersRouter.get(
  "/by-handle/:handle",
  asyncHandler(async (req, res) => {
    const { handle } = parseParams(handleParamSchema, req);
    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        avatarUrl: true,
        city: true,
        isCreator: true,
      },
    });
    if (!user) throw notFound("User not found");
    res.json({ data: user });
  }),
);
