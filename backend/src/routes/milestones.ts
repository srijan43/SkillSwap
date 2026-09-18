import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { parseBody, parseParams } from "../lib/validate.js";
import { updateMilestone } from "../services/milestones.js";

export const milestonesRouter = Router();

const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

const updateSchema = z.object({
  actorId: z.string().trim().min(1),
  title: z.string().trim().min(3).max(120).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  deliverableUrl: z
    .string()
    .url()
    .or(z.string().startsWith("/uploads/"))
    .optional(),
  dueDate: z.coerce.date().optional(),
});

/**
 * PATCH /api/milestones/:id
 * Creator-only update. Status flips to COMPLETED also stamp `completedAt`.
 */
milestonesRouter.patch(
  "/:id",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const body = parseBody(updateSchema, req);
    const milestone = await updateMilestone({ milestoneId: id, ...body });
    res.json({ data: milestone });
  }),
);
