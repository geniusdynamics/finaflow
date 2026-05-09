import { z } from "zod";
import { sql } from "drizzle-orm";

export const paginationInput = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationInput>;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

export async function paginatedQuery<T>(
  db: any,
  query: any,
  input: PaginationInput,
  from: any,
): Promise<PaginatedResult<T>> {
  const [data, countResult] = await Promise.all([
    query.limit(input.limit).offset(input.offset),
    db.select({ count: sql<number>`count(*)` }).from(from),
  ]);
  return {
    data: data as T[],
    total: Number(countResult[0]?.count || 0),
    offset: input.offset,
    limit: input.limit,
  };
}
