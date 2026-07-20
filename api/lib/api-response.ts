// ABOUTME: Unified response envelope for the external REST API (v1).
// ABOUTME: Every v1 endpoint returns { data, meta } on success or { error, meta } on failure.
import type { Context } from "hono";

export interface ApiMeta {
  requestId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
  meta?: ApiMeta;
}

function getRequestId(c: Context): string | undefined {
  return (c.get("requestId") as string) || undefined;
}

function buildMeta(c: Context, extra?: Partial<ApiMeta>): ApiMeta | undefined {
  const requestId = getRequestId(c);
  if (!requestId && !extra?.pagination) return undefined;
  return { ...(requestId ? { requestId } : {}), ...extra };
}

/** 200 success response with unified envelope. */
export function successResponse<T>(c: Context, data: T, status: 200 | 201 | 202 = 200) {
  return c.json({ data, meta: buildMeta(c) } satisfies ApiSuccessBody<T>, status);
}

/** Error response with unified envelope. */
export function errorResponse(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
  code: string,
  message: string
) {
  return c.json(
    { error: { code, message }, meta: buildMeta(c) } satisfies ApiErrorBody,
    status
  );
}

/** Paginated success response. */
export function paginatedResponse<T>(
  c: Context,
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  return c.json({
    data,
    meta: buildMeta(c, {
      pagination: {
        ...pagination,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    }),
  } satisfies ApiSuccessBody<T[]>);
}
