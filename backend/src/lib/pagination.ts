import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const skipTake = ({ page, limit }: Pagination) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const paginatedEnvelope = <T>(
  data: T[],
  { page, limit }: Pagination,
  total: number,
) => ({
  data,
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasMore: page * limit < total,
});
