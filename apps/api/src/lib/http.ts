import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors";

/** Parse + validate request input with a zod schema (400 on failure). */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
      .join("; ");
    throw badRequest(details, "validation");
  }
  return result.data;
}

/** Standard success envelope: { ok: true, data } */
export function ok(c: Context, data: unknown, status: 200 | 201 = 200) {
  return c.json({ ok: true, data }, status);
}

/** Standard list envelope used by every DataTable. */
export function okList(
  c: Context,
  data: unknown[],
  total: number,
  page: number,
  pageSize: number,
) {
  return c.json({
    ok: true,
    data: {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
