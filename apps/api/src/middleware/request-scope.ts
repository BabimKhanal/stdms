import type { MiddlewareHandler } from "hono";
import type { PoolClient } from "pg";
import { appPool, makeDb } from "../db/client";
import { verifyAccessToken } from "../lib/jwt";
import type { AppVariables, AuthUser } from "../lib/context";

/**
 * THE request-scoped database middleware.
 *
 * For every request it:
 *   1. checks the Authorization header and verifies the access JWT
 *   2. checks out ONE pooled connection
 *   3. sets the PostgreSQL session GUCs that Row Level Security reads
 *      (`app.current_org_id`, `app.is_platform_admin`)
 *   4. exposes `db` (Drizzle bound to that connection) on the context
 *   5. DISCARDs session state and returns the connection afterwards
 *
 * Result: it is *impossible* to run a query in a request that is not
 * confined to the caller's tenant at the database level.
 */

async function loadAuthUser(client: PoolClient, header?: string): Promise<AuthUser | null> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  let claims: { sub: string; org: string | null; pa?: boolean };
  try {
    claims = verifyAccessToken(token) as unknown as typeof claims;
  } catch {
    return null;
  }

  // Tenant GUCs come from *verified* JWT claims — the DB row is then read
  // under that tenant's RLS policy, so a forged org id cannot leak data.
  if (claims.org) {
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [claims.org]);
  }
  if (claims.pa) {
    await client.query("SELECT set_config('app.is_platform_admin', 'true', false)");
  }

  const userRes = await client.query<{
    id: string;
    name: string;
    organisation_id: string | null;
    is_platform_admin: boolean;
    status: string;
    must_change_password: boolean;
    employee_id: string | null;
    student_id: string | null;
    guardian_id: string | null;
  }>(
    `SELECT id, name, organisation_id, is_platform_admin, status, must_change_password, employee_id, student_id, guardian_id
       FROM users WHERE id = $1`,
    [claims.sub],
  );
  const row = userRes.rows[0];
  if (!row || row.status !== "active") return null;

  const permRes = await client.query<{ key: string; permission: string }>(
    `SELECT r.key, p.resource || '.' || p.action AS permission
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = $1`,
    [row.id],
  );

  const roles = [...new Set(permRes.rows.map((r) => r.key))];
  const permissions = [...new Set(permRes.rows.map((r) => r.permission))];

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    orgId: row.organisation_id,
    isPlatformAdmin: row.is_platform_admin,
    roles,
    permissions,
    mustChangePassword: row.must_change_password,
    studentId: row.student_id,
    employeeId: row.employee_id,
    guardianIds: [],
  };

  // Parent logins: which guardians does this user represent?
  if (row.guardian_id) {
    user.guardianIds = [row.guardian_id];
  }

  return user;
}

export const requestScope: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const client = await appPool.connect();
  try {
    const user = await loadAuthUser(client, c.req.header("authorization"));
    c.set("client", client);
    c.set("db", makeDb(client));
    c.set("user", user);
    c.set("orgId", user?.orgId ?? null);
    await next();
  } finally {
    try {
      // Clears app.* GUCs so the connection is safe to reuse.
      await client.query("RESET app.current_org_id; RESET app.is_platform_admin; RESET app.allow_unscoped;");
      await client.query("DISCARD ALL");
    } catch {
      /* connection may already be broken — pool handles it */
    }
    client.release();
  }
};
