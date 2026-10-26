import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../lib/context";
import { forbidden, notFound, unauthorized } from "../lib/errors";
import { rateLimit } from "../lib/redis";

/** Reject anonymous requests. */
export const requireAuth: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  if (!c.get("user")) throw unauthorized();
  await next();
};

/** Reject requests from platform admins acting inside a tenant context. */
export const requireOrg: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (!user.orgId) throw forbidden("This action requires an institution context");
  await next();
};

/**
 * The RBAC gate: `requirePermission("attendance.create")`.
 * Platform admins bypass; everyone else must hold the exact permission.
 */
export function requirePermission(permission: string): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw unauthorized();
    if (user.isPlatformAdmin) {
      await next();
      return;
    }
    if (!user.permissions.includes(permission)) {
      throw forbidden(`Missing permission: ${permission}`);
    }
    await next();
  };
}

export const requireAdmin: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (!user.isPlatformAdmin && !user.roles.some((role) => ["owner", "principal", "administrator"].includes(role))) throw forbidden("Administrator access required");
  await next();
};

/** Simple Redis fixed-window rate limiter, keyed by IP + bucket name. */
export function rateLimitMiddleware(bucket: string, limit: number, windowSeconds: number) {
  return async (c: { req: { header: (n: string) => string | undefined }; json: (o: unknown, s: number) => Response }, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const { allowed, remaining } = await rateLimit(`${bucket}:${ip}`, limit, windowSeconds);
    if (!allowed) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }
    await next();
    return undefined;
  };
}
