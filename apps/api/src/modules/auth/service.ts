import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { DB, AppEnv } from "../../lib/types";
import { organisations, permissions, rolePermissions, roles, users, userRoles } from "../../db/schema";
import { students } from "../../db/schema";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signAccessToken } from "../../lib/jwt";
import { badRequest, unauthorized } from "../../lib/errors";
import type { AuthUser } from "../../lib/context";
import { randomToken, readSession, revokeAllSessions, revokeSession, saveSession, type SessionData } from "./session";
import { deletePasswordResetToken, getPasswordResetUser, setPasswordResetToken } from "../../lib/redis";
import { sendMail } from "../../lib/mailer";
import { env } from "../../env";

/**
 * Loads roles + permissions for a user. Must run AFTER the tenant GUC has
 * been set — Row Level Security then confines the result to that tenant.
 */
export async function loadRolesAndPermissions(db: DB, userId: string) {
  const rows = await db
    .select({
      key: roles.key,
      permission: sql<string>`${permissions.resource} || '.' || ${permissions.action}`,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  return {
    roles: [...new Set(rows.map((r) => r.key))],
    permissions: [...new Set(rows.map((r) => r.permission))],
  };
}

/** Builds the request principal from a user id (tenant-scoped by RLS). */
export async function loadAuthUser(db: DB, userId: string): Promise<AuthUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row || row.status !== "active") return null;
  const { roles: roleKeys, permissions: perms } = await loadRolesAndPermissions(db, userId);
  return {
    id: row.id,
    name: row.name,
    orgId: row.organisationId,
    isPlatformAdmin: row.isPlatformAdmin,
    roles: roleKeys,
    permissions: perms,
    mustChangePassword: row.mustChangePassword,
    studentId: row.studentId,
    employeeId: row.employeeId,
    guardianIds: row.guardianId ? [row.guardianId] : [],
  };
}

/**
 * Finds a user by email OR username OR student code.
 * The caller (login route) has set `app.allow_unscoped` first, because at
 * this point we do not yet know which tenant the account belongs to.
 */
export async function findUserByIdentifier(db: DB, identifier: string) {
  const lower = identifier.toLowerCase();
  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
      orgId: users.organisationId,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(users)
    .leftJoin(students, eq(users.studentId, students.id))
    .where(
      sql`lower(${users.email}) = ${lower}
          OR lower(${users.username}) = ${lower}
          OR (${students.studentId} = ${identifier}
              AND ${users.organisationId} = ${students.organisationId})`,
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function login(c: Context<AppEnv>, identifier: string, password: string) {
  const db = c.var.db;
  const client = c.var.client;

  const setGuc = (name: string, value: string) =>
    client.query("SELECT set_config($1, $2, false)", [name, value]);

  // Step 1: the tenant is unknown until we find the account → unscoped READ.
  await setGuc("app.allow_unscoped", "true");
  const userRow = await findUserByIdentifier(db, identifier);
  if (!userRow) throw unauthorized("Invalid credentials");
  if (!(await verifyPassword(password, userRow.passwordHash))) {
    throw unauthorized("Invalid credentials");
  }

  // Step 2: switch to the account's tenant so everything below runs under
  // that tenant's Row Level Security policy.
  if (userRow.orgId) await setGuc("app.current_org_id", userRow.orgId);
  if (userRow.isPlatformAdmin) await setGuc("app.is_platform_admin", "true");

  const user = await loadAuthUser(db, userRow.id);
  if (!user) throw unauthorized("Account is disabled");

  const tokens = await issueTokens({ org: userRow.orgId, pa: userRow.isPlatformAdmin }, userRow.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userRow.id));

  return { user, ...tokens };
}

export async function issueTokens(data: SessionData, userId: string) {
  const { token: accessToken, expiresIn } = signAccessToken({
    sub: userId,
    org: data.org,
    pa: data.pa,
  });
  // Format "<userId>.<secret>" so refresh can find the Redis key directly.
  const refreshToken = `${userId}.${randomToken()}`;
  await saveSession(userId, refreshToken, data);
  return { accessToken, refreshToken, expiresIn };
}

export async function refreshSession(userId: string, oldToken: string, stored: SessionData) {
  await revokeSession(userId, oldToken);
  return issueTokens(stored, userId);
}

export async function logout(userId: string, token: string) {
  await revokeSession(userId, token);
}

export async function logoutEverywhere(userId: string) {
  await revokeAllSessions(userId);
}

export async function changePassword(db: DB, userId: string, currentPassword: string, newPassword: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw unauthorized();
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw badRequest("Current password is incorrect");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, userId));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function requestPasswordReset(c: Context<AppEnv>, identifier: string) {
  await c.var.client.query("SELECT set_config('app.allow_unscoped', 'true', false)");
  const result = await c.var.client.query<{ id: string; email: string | null; name: string }>(
    `SELECT id, email, name FROM users WHERE status = 'active' AND (lower(email) = lower($1) OR lower(username) = lower($1)) LIMIT 1`,
    [identifier],
  );
  const user = result.rows[0];
  if (user?.email) {
    const token = randomToken();
    await setPasswordResetToken(token, user.id);
    const link = `${env.PASSWORD_RESET_URL}?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: "Reset your Nucleus password",
      html: `<p>Hello ${escapeHtml(user.name)},</p><p>Use the link below to choose a new password. It expires in 15 minutes and can only be used once.</p><p><a href="${escapeHtml(link)}">Reset password</a></p>`,
    });
  }
  // Do not reveal whether an account exists.
  return { requested: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await getPasswordResetUser(token);
  if (!userId) throw unauthorized("Reset link is invalid or expired");
  const { hashPassword } = await import("../../lib/password");
  const { appPool } = await import("../../db/client");
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2 AND status = 'active' RETURNING id", [await hashPassword(newPassword), userId]);
    if (!result.rowCount) throw unauthorized("Account is disabled");
    await client.query("COMMIT");
    await deletePasswordResetToken(token);
    await revokeAllSessions(userId);
    return { reset: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrganisation(db: DB, orgId: string) {
  const [row] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  return row ?? null;
}
