import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { asyncHandler } from "../middleware/asyncHandler.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { parseBody, parseParams, parseQuery } from "../lib/validate.js";
import { paginationSchema, paginatedEnvelope } from "../lib/pagination.js";
import { config } from "../lib/config.js";
import { badRequest } from "../lib/errors.js";
import {
  addAttachments,
  createBooking,
  getBookingById,
  getEscrowSummary,
  listBookings,
} from "../services/bookings.js";
import {
  acceptBooking,
  approveBooking,
  cancelBooking,
  declineBooking,
  deliverBooking,
  disputeBooking,
  startBooking,
} from "../services/bookingTransitions.js";
import { addMilestone } from "../services/milestones.js";
import { resolveStorage } from "../services/storage.js";

export const bookingsRouter = Router();

const idParamSchema = z.object({
  id: z.string().trim().regex(/^ORD-[A-Z0-9]{4,10}$/i, "Invalid booking id"),
});

const createBookingSchema = z.object({
  gigId: z.string().trim().min(1),
  tierSlug: z.string().trim().min(1),
  clientId: z.string().trim().min(1),
  briefText: z.string().trim().min(20, "Brief must be at least 20 characters").max(4000),
  deliveryPace: z.enum(["STANDARD", "RUSH"]).default("STANDARD"),
  attachments: z.array(z.string().url().or(z.string().startsWith("/uploads/"))).max(10).optional(),
});

const listQuerySchema = paginationSchema.extend({
  role: z.enum(["client", "creator"]),
  actorId: z.string().trim().min(1),
  status: z
    .enum([
      "PENDING",
      "ACCEPTED",
      "DECLINED",
      "IN_PROGRESS",
      "DELIVERED",
      "APPROVED",
      "DISPUTED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
});

const actorSchema = z.object({ actorId: z.string().trim().min(1) });
const reasonSchema = actorSchema.extend({ reason: z.string().trim().max(1000).optional() });
const deliverSchema = actorSchema.extend({
  deliverableUrl: z.string().url().or(z.string().startsWith("/uploads/")).optional(),
  note: z.string().trim().max(2000).optional(),
});
const disputeSchema = actorSchema.extend({ reason: z.string().trim().min(5).max(2000) });
const addMilestoneSchema = actorSchema.extend({
  title: z.string().trim().min(3).max(120),
  dueDate: z.coerce.date().optional(),
});

/**
 * POST /api/bookings
 * Creates a booking, snapshots price, and writes the HOLD ledger entry in a
 * single Prisma transaction. If any step fails the whole thing rolls back.
 */
bookingsRouter.post(
  "/",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(createBookingSchema, req);
    const booking = await createBooking({
      ...body,
      deliveryPace: body.deliveryPace ?? "STANDARD",
    });
    res.status(201).json({ data: booking });
  }),
);

/**
 * GET /api/bookings?role=client|creator&actorId=<id>&status=<enum>
 * Bookings scoped to one actor. `role` picks which side of the join to filter.
 * Without auth, `actorId` is required so we do not leak a full listing.
 */
bookingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parseQuery(listQuerySchema, req);
    const pagination = { page: q.page ?? 1, limit: q.limit ?? 20 };
    const { rows, total } = await listBookings({
      actorId: q.actorId,
      role: q.role,
      status: q.status,
      ...pagination,
    });
    res.json(paginatedEnvelope(rows, pagination, total));
  }),
);

/**
 * GET /api/bookings/:id
 * Full booking detail (gig, tier, milestones, ledger).
 */
bookingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const booking = await getBookingById(id);
    res.json({ data: booking });
  }),
);

/**
 * GET /api/bookings/:id/escrow-summary
 * Derived money view: current held balance + every ledger entry so far.
 */
bookingsRouter.get(
  "/:id/escrow-summary",
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const summary = await getEscrowSummary(id);
    res.json({ data: summary });
  }),
);

/**
 * POST /api/bookings/:id/attachments
 * Multipart upload — up to MAX_UPLOAD_MB per file, 10 files per call.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
    files: 10,
  },
});

bookingsRouter.post(
  "/:id/attachments",
  writeLimiter,
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("No files provided", { field: "files" });

    // Ensure the booking exists (and give a clean 404) before writing to disk.
    await getBookingById(id);

    const storage = resolveStorage();
    const stored = await Promise.all(
      files.map((f) =>
        storage.save({
          buffer: f.buffer,
          originalName: f.originalname,
          mimeType: f.mimetype,
          scope: `bookings/${id}`,
        }),
      ),
    );

    const booking = await addAttachments(
      id,
      stored.map((s) => s.url),
    );

    res.status(201).json({
      data: {
        booking,
        uploaded: stored,
      },
    });
  }),
);

// ─── State transitions ─────────────────────────────────────────────────
// Each transition takes { actorId } (and reason/note where relevant) and
// enforces role membership before touching ledger + status in one tx.

bookingsRouter.post(
  "/:id/accept",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId } = parseBody(actorSchema, req);
    const booking = await acceptBooking(id, actorId);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/decline",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId, reason } = parseBody(reasonSchema, req);
    const booking = await declineBooking(id, actorId, reason);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/start",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId } = parseBody(actorSchema, req);
    const booking = await startBooking(id, actorId);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/deliver",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId, deliverableUrl, note } = parseBody(deliverSchema, req);
    const booking = await deliverBooking(id, actorId, deliverableUrl, note);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/approve",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId } = parseBody(actorSchema, req);
    const booking = await approveBooking(id, actorId);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/dispute",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId, reason } = parseBody(disputeSchema, req);
    const booking = await disputeBooking(id, actorId, reason);
    res.json({ data: booking });
  }),
);

bookingsRouter.post(
  "/:id/cancel",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const { actorId, reason } = parseBody(reasonSchema, req);
    const booking = await cancelBooking(id, actorId, reason);
    res.json({ data: booking });
  }),
);

// ─── Milestone create ──────────────────────────────────────────────────
// (Milestone update lives on its own router at /api/milestones/:id.)

bookingsRouter.post(
  "/:id/milestones",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const body = parseBody(addMilestoneSchema, req);
    const milestone = await addMilestone({
      bookingId: id,
      actorId: body.actorId,
      title: body.title,
      dueDate: body.dueDate,
    });
    res.status(201).json({ data: milestone });
  }),
);
