import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const categoriesRouter = Router();

/**
 * GET /api/categories
 * List every category with its cached gig count. Backs the 6 specialist-hub
 * cards on the marketplace page. Sort matches the frontend's fixed order.
 */
categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ data: rows });
  }),
);
