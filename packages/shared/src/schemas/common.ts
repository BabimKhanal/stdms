import { z } from "zod";

/** Pagination + list-query conventions used by every DataTable in the web app. */

export const idSchema = z.uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.string().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}

export const apiResponse = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});
export type ApiResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");

/**
 * Query-string UUID: treats `?classId=` (empty) as "not provided" so HTML
 * selects that send empty values don't fail validation.
 */
export const uuidQuery = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.uuid().optional(),
);

/** Query-string enum: same empty-string forgiveness, value must be valid. */
export function enumQuery<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(values).optional(),
  );
}
