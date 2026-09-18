import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { paginationSchema, paginatedEnvelope } from "../lib/pagination.js";
import { parseBody, parseParams, parseQuery } from "../lib/validate.js";
import {
  applyPriceSort,
  createGig,
  getGigBySlugOrId,
  incrementGigView,
  listGigs,
  listReviewsForGig,
  listSimilarGigs,
  type GigSort,
} from "../services/gigs.js";

export const gigsRouter = Router();

const sortEnum = z.enum(["trending", "rating", "price_asc", "price_desc", "newest"] as const);

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(64).optional(),
  creator: z.string().trim().min(1).max(64).optional(),
  priceMin: z.coerce.number().int().nonnegative().optional(),
  priceMax: z.coerce.number().int().nonnegative().optional(),
  sort: sortEnum.default("trending"),
});

const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

const createGigSchema = z.object({
  creatorId: z.string().trim().min(1),
  title: z.string().trim().min(6).max(160),
  categorySlug: z.string().trim().min(1).max(64),
  description: z.string().trim().min(20).max(8000),
  disciplineTags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  turnaroundDays: z.number().int().min(1).max(60).default(3),
  tiers: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        slug: z.enum(["basic", "standard", "premium"]),
        price: z.number().int().nonnegative(),
        deliverables: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
        revisions: z.number().int().min(0).max(999).default(1),
        deliveryDays: z.number().int().min(1).max(90).default(3),
        isFeatured: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(3),
});

/**
 * GET /api/gigs
 * Marketplace search / filter. Query params:
 *   q, category (slug), creator (handle), priceMin, priceMax (paise),
 *   sort=trending|rating|price_asc|price_desc|newest, page, limit
 */
gigsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parseQuery(listQuerySchema, req);
    const pagination = { page: q.page ?? 1, limit: q.limit ?? 20 };
    const { rows, total } = await listGigs(
      {
        q: q.q,
        categorySlug: q.category,
        creatorHandle: q.creator,
        priceMin: q.priceMin,
        priceMax: q.priceMax,
        sort: q.sort as GigSort,
      },
      pagination,
    );
    const sorted = applyPriceSort(rows, q.sort as GigSort);
    res.json(paginatedEnvelope(sorted, pagination, total));
  }),
);

/**
 * POST /api/gigs
 * Creator publishes a new gig with its tier ladder in one transaction.
 */
gigsRouter.post(
  "/",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(createGigSchema, req);
    const gig = await createGig({
      creatorId: body.creatorId,
      title: body.title,
      categorySlug: body.categorySlug,
      description: body.description,
      disciplineTags: body.disciplineTags ?? [],
      turnaroundDays: body.turnaroundDays ?? 3,
      tiers: body.tiers.map((t) => ({
        name: t.name,
        slug: t.slug,
        price: t.price,
        deliverables: t.deliverables,
        revisions: t.revisions ?? 1,
        deliveryDays: t.deliveryDays ?? 3,
        isFeatured: t.isFeatured ?? false,
      })),
    });
    res.status(201).json({ data: gig });
  }),
);

/**
 * GET /api/gigs/:id
 * Full detail (id or slug). Increments viewCount asynchronously so the trending
 * job has fresh signal.
 */
gigsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const gig = await getGigBySlugOrId(id);
    // Fire and forget; the response does not wait on it.
    void incrementGigView(gig.id);
    res.json({ data: gig });
  }),
);

/**
 * GET /api/gigs/:id/reviews
 * Paginated reviews for a gig, newest first.
 */
gigsRouter.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const parsed = parseQuery(paginationSchema, req);
    const pagination = { page: parsed.page ?? 1, limit: parsed.limit ?? 20 };
    const gig = await getGigBySlugOrId(id);
    const { rows, total } = await listReviewsForGig(gig.id, pagination);
    res.json(paginatedEnvelope(rows, pagination, total));
  }),
);

/**
 * GET /api/gigs/:id/similar
 * Up to `take` other gigs in the same category, ordered by trending.
 */
gigsRouter.get(
  "/:id/similar",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const takeQ = z
      .object({ take: z.coerce.number().int().min(1).max(12).default(3) })
      .parse(req.query);
    const gig = await getGigBySlugOrId(id);
    const rows = await listSimilarGigs(gig.id, takeQ.take);
    res.json({ data: rows });
  }),
);
