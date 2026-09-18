import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseParams, parseQuery } from "../lib/validate.js";
import {
  getCreatorActivity,
  getCreatorDashboard,
} from "../services/dashboard.js";

export const creatorsRouter = Router();

const idParamSchema = z.object({ id: z.string().trim().min(1).max(64) });

/**
 * GET /api/creators/:id/dashboard
 * Bundle: earnings, active pipeline, success score, weekly impressions, and
 * the top 5 incoming requests + latest activity events.
 */
creatorsRouter.get(
  "/:id/dashboard",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const data = await getCreatorDashboard(id);
    res.json({ data });
  }),
);

/**
 * GET /api/creators/:id/activity?take=20
 * Recent activity events for a creator (used by the dashboard's feed).
 */
creatorsRouter.get(
  "/:id/activity",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { take } = parseQuery(
      z.object({ take: z.coerce.number().int().min(1).max(100).default(20) }),
      req,
    );
    const rows = await getCreatorActivity(id, take);
    res.json({ data: rows });
  }),
);
