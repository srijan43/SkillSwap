import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import type { Pagination } from "../lib/pagination.js";
import { skipTake } from "../lib/pagination.js";

export type GigSort = "trending" | "rating" | "price_asc" | "price_desc" | "newest";

export interface GigListFilters {
  q?: string;
  categorySlug?: string;
  priceMin?: number; // paise
  priceMax?: number; // paise
  sort: GigSort;
  creatorHandle?: string;
}

/**
 * Shared select for gig list cards. Keeps enough tier + creator info for the
 * marketplace grid without over-fetching.
 */
const gigCardSelect = {
  id: true,
  slug: true,
  title: true,
  coverBadge: true,
  disciplineTags: true,
  turnaroundDays: true,
  viewCount: true,
  bookingCount: true,
  ratingAverage: true,
  reviewCount: true,
  trendingScore: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, slug: true, colorToken: true, iconName: true },
  },
  creator: {
    select: {
      id: true,
      handle: true,
      name: true,
      avatarUrl: true,
      city: true,
      ratingAverage: true,
    },
  },
  tiers: {
    orderBy: { price: "asc" as const },
    select: { id: true, name: true, slug: true, price: true, isFeatured: true, deliveryDays: true },
  },
  media: {
    orderBy: { position: "asc" as const },
    take: 1,
    select: { id: true, url: true, type: true, caption: true },
  },
} satisfies Prisma.GigSelect;

export async function listGigs(filters: GigListFilters, page: Pagination) {
  const { q, categorySlug, priceMin, priceMax, sort, creatorHandle } = filters;

  const where: Prisma.GigWhereInput = {
    status: "PUBLISHED",
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(creatorHandle ? { creator: { handle: creatorHandle } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { disciplineTags: { hasSome: [q] } },
          ],
        }
      : {}),
    ...(priceMin !== undefined || priceMax !== undefined
      ? {
          tiers: {
            some: {
              ...(priceMin !== undefined ? { price: { gte: priceMin } } : {}),
              ...(priceMax !== undefined ? { price: { lte: priceMax } } : {}),
            },
          },
        }
      : {}),
  };

  const orderBy = sortToOrderBy(sort);

  const [total, rows] = await Promise.all([
    prisma.gig.count({ where }),
    prisma.gig.findMany({
      where,
      orderBy,
      select: gigCardSelect,
      ...skipTake(page),
    }),
  ]);

  return { total, rows: rows.map(shapeGigCard) };
}

const gigDetailInclude = {
  category: true,
  creator: true,
  tiers: { orderBy: { price: "asc" as const } },
  media: { orderBy: { position: "asc" as const } },
} satisfies Prisma.GigInclude;

export async function getGigBySlugOrId(idOrSlug: string) {
  const gig = await prisma.gig.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      status: { not: "ARCHIVED" },
    },
    include: gigDetailInclude,
  });
  if (!gig) throw notFound("Gig not found");
  return shapeGigDetail(gig);
}

export interface CreateGigInput {
  creatorId: string;
  title: string;
  categorySlug: string;
  description: string;
  disciplineTags: string[];
  turnaroundDays: number;
  tiers: {
    name: string;
    slug: string;
    price: number;
    deliverables: string[];
    revisions: number;
    deliveryDays: number;
    isFeatured?: boolean;
  }[];
}

/**
 * Create a PUBLISHED gig with its tier ladder in one transaction. Slug is
 * derived from title + a short random suffix to keep it globally unique.
 */
export async function createGig(input: CreateGigInput) {
  const creator = await prisma.user.findUnique({
    where: { id: input.creatorId },
    select: { id: true },
  });
  if (!creator) throw notFound("Creator not found");
  const category = await prisma.category.findUnique({
    where: { slug: input.categorySlug },
    select: { id: true },
  });
  if (!category) throw notFound("Category not found");
  if (input.tiers.length === 0) {
    throw new Error("At least one tier is required");
  }

  const baseSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${baseSlug || "gig"}-${suffix}`;

  return prisma.$transaction(async (tx) => {
    const gig = await tx.gig.create({
      data: {
        creatorId: input.creatorId,
        title: input.title,
        slug,
        categoryId: category.id,
        description: input.description,
        disciplineTags: input.disciplineTags,
        turnaroundDays: input.turnaroundDays,
        status: "PUBLISHED",
        tiers: {
          create: input.tiers.map((t) => ({
            name: t.name,
            slug: t.slug,
            price: t.price,
            deliverables: t.deliverables,
            revisions: t.revisions,
            deliveryDays: t.deliveryDays,
            isFeatured: t.isFeatured ?? false,
          })),
        },
      },
      include: gigDetailInclude,
    });
    await tx.activityEvent.create({
      data: { userId: input.creatorId, type: "GIG_PUBLISHED", gigId: gig.id },
    });
    return shapeGigDetail(gig);
  });
}

export async function incrementGigView(gigId: string) {
  // Fire-and-forget; failures should not break the response.
  await prisma.gig.update({
    where: { id: gigId },
    data: { viewCount: { increment: 1 } },
  }).catch(() => undefined);
}

export async function listReviewsForGig(gigId: string, page: Pagination) {
  const [total, rows] = await Promise.all([
    prisma.review.count({ where: { gigId } }),
    prisma.review.findMany({
      where: { gigId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, handle: true, name: true, avatarUrl: true, city: true } },
      },
      ...skipTake(page),
    }),
  ]);
  return { total, rows };
}

export async function listSimilarGigs(gigId: string, take = 3) {
  const anchor = await prisma.gig.findUnique({
    where: { id: gigId },
    select: { categoryId: true },
  });
  if (!anchor) throw notFound("Gig not found");
  const rows = await prisma.gig.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: anchor.categoryId,
      NOT: { id: gigId },
    },
    orderBy: [{ trendingScore: "desc" }, { ratingAverage: "desc" }],
    take,
    select: gigCardSelect,
  });
  return rows.map(shapeGigCard);
}

function sortToOrderBy(sort: GigSort): Prisma.GigOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ ratingAverage: "desc" }, { reviewCount: "desc" }];
    case "price_asc":
    case "price_desc":
      // Price sort orders by the min tier price via the tiers relation aggregate.
      // Prisma cannot orderBy on an aggregate of a relation in one query without
      // a nested trick, so we sort by trendingScore as a stable fallback here
      // and re-sort in-memory in the route (see listGigs consumer).
      return [{ trendingScore: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "trending":
    default:
      return [{ trendingScore: "desc" }, { bookingCount: "desc" }];
  }
}

type GigCardRow = Prisma.GigGetPayload<{ select: typeof gigCardSelect }>;

function shapeGigCard(g: GigCardRow) {
  const minPrice = g.tiers.length ? Math.min(...g.tiers.map((t) => t.price)) : 0;
  return {
    ...g,
    priceFromPaise: minPrice,
    cover: g.media[0] ?? null,
  };
}

function shapeGigDetail(g: Prisma.GigGetPayload<{ include: typeof gigDetailInclude }>) {
  const minPrice = g.tiers.length ? Math.min(...g.tiers.map((t) => t.price)) : 0;
  // Strip fields on the creator that never belong on a public gig detail.
  const { createdAt: _createdAt, ...creator } = g.creator;
  return {
    ...g,
    creator,
    priceFromPaise: minPrice,
  };
}

/**
 * Apply the price-sort direction in memory after the DB query. Necessary
 * because Prisma cannot orderBy on an aggregate of a to-many relation
 * (see sortToOrderBy above for context).
 */
export function applyPriceSort<T extends { priceFromPaise: number }>(
  rows: T[],
  sort: GigSort,
): T[] {
  if (sort === "price_asc") return [...rows].sort((a, b) => a.priceFromPaise - b.priceFromPaise);
  if (sort === "price_desc") return [...rows].sort((a, b) => b.priceFromPaise - a.priceFromPaise);
  return rows;
}
