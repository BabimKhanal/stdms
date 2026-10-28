import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { loginSchema, changePasswordSchema, passwordResetRequestSchema, passwordResetSchema, type SessionUser } from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, parse } from "../../lib/http";
import { rateLimit } from "../../lib/redis";
import { unauthorized } from "../../lib/errors";
import { requireAuth } from "../../middleware/guards";
import { writeAudit } from "../../lib/audit";
import * as authService from "./service";
import { readSession } from "./session";
import { eq } from "drizzle-orm";
import { organisations, students, users } from "../../db/schema";
import * as studentService from "../students/service";

export const authRoutes = new Hono<AppEnv>();

/** Builds the identity blob the web/mobile apps persist after login. */
async function sessionUser(c: Context<AppEnv>, user: Awaited<ReturnType<typeof authService.loadAuthUser>>): Promise<SessionUser> {
  if (!user) throw unauthorized();
  const db = c.get("db");
  const [row] = await db
    .select({
      email: users.email,
      username: users.username,
      avatarUrl: users.avatarUrl,
      locale: users.locale,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      studentPhotoUrl: students.photoUrl,
    })
    .from(users)
    .leftJoin(organisations, eq(users.organisationId, organisations.id))
    .leftJoin(students, eq(users.studentId, students.id))
    .where(eq(users.id, user.id))
    .limit(1);

  return {
    id: user.id,
    name: user.name,
    email: row?.email ?? null,
    username: row?.username ?? null,
    orgId: user.orgId,
    orgName: row?.orgName ?? null,
    isPlatformAdmin: user.isPlatformAdmin,
    roles: user.roles,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
    studentId: user.studentId ?? null,
    employeeId: user.employeeId ?? null,
    guardianIds: user.guardianIds ?? [],
    avatarUrl: row?.avatarUrl ?? row?.studentPhotoUrl ?? null,
    locale: row?.locale ?? "en",
  };
}

/** POST /api/v1/auth/login */
authRoutes.post("/login", async (c) => {
  const body = parse(loginSchema, await c.req.json());

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const { allowed } = await rateLimit(`login:${ip}`, 10, 60);
  if (!allowed) throw unauthorized("Too many login attempts, try again in a minute");

  const result = await authService.login(c, body.identifier, body.password);
  return ok(c, {
    user: await sessionUser(c, result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });
});

authRoutes.post("/password-reset/request", async (c) => {
  await authService.requestPasswordReset(c, parse(passwordResetRequestSchema, await c.req.json()).identifier);
  return ok(c, { requested: true });
});

authRoutes.post("/password-reset/reset", async (c) => {
  const body = parse(passwordResetSchema, await c.req.json());
  return ok(c, await authService.resetPassword(body.token, body.newPassword));
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

/** POST /api/v1/auth/refresh — rotates the refresh token on every use. */
authRoutes.post("/refresh", async (c) => {
  const { refreshToken } = parse(refreshSchema, await c.req.json());
  const [userId, token] = refreshToken.split(".");
  if (!userId || !token) throw unauthorized("Invalid refresh token");

  const session = await readSession(userId, refreshToken);
  if (!session) throw unauthorized("Session expired, please log in again");

  const client = c.var.client;
  if (session.org) await client.query("SELECT set_config('app.current_org_id', $1, false)", [session.org]);
  if (session.pa) await client.query("SELECT set_config('app.is_platform_admin', 'true', false)");

  const user = await authService.loadAuthUser(c.get("db"), userId);
  if (!user) throw unauthorized("Account is disabled");

  const tokens = await authService.refreshSession(userId, refreshToken, session);
  return ok(c, { user: await sessionUser(c, user), ...tokens });
});

/** POST /api/v1/auth/logout */
authRoutes.post("/logout", async (c) => {
  const { refreshToken } = parse(refreshSchema, await c.req.json());
  const [userId, token] = refreshToken.split(".");
  if (userId && token) await authService.logout(userId, refreshToken);
  return ok(c, { loggedOut: true });
});

/** GET /api/v1/auth/me */
authRoutes.get("/me", requireAuth, async (c) => {
  return ok(c, await sessionUser(c, c.get("user")));
});

const studentProfileSchema = z.object({
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  nationality: z.string().trim().max(60).nullable().optional(),
  photoUrl: z.string().max(500).nullable().optional(),
});

authRoutes.get("/profile", requireAuth, async (c) => {
  const user = c.get("user")!;
  return ok(c, user.studentId ? await studentService.getStudent(c.get("db"), user.orgId!, user.studentId) : null);
});

authRoutes.put("/profile", requireAuth, async (c) => {
  const user = c.get("user")!;
  if (!user.studentId || !user.orgId) throw unauthorized("Only student accounts can edit a student profile");
  const input = parse(studentProfileSchema, await c.req.json());
  return ok(c, await studentService.updateStudentProfile(c.get("db"), user.orgId, user.studentId, input));
});

/** POST /api/v1/auth/change-password */
authRoutes.post("/change-password", requireAuth, async (c) => {
  const body = parse(changePasswordSchema, await c.req.json());
  const user = c.get("user")!;
  await authService.changePassword(c.get("db"), user.id, body.currentPassword, body.newPassword);
  await authService.logoutEverywhere(user.id);
  await writeAudit(c, { action: "change_password", entity: "user", entityId: user.id });
  return ok(c, { changed: true, sessionsRevoked: true });
});
