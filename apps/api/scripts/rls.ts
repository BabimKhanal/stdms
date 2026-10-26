/**
 * Applies Row Level Security to every tenant table.
 *
 * Design (read this before changing it):
 * - The API connects as `edu_app`, a NON-OWNER role, so PostgreSQL enforces
 *   these policies on every query (FORCE ROW LEVEL SECURITY is belt-and-braces
 *   so even a mistaken owner connection is still confined).
 * - The tenant is selected per session via the GUC `app.current_org_id`,
 *   set by the tenant middleware on the pooled connection used by the request.
 * - `app.is_platform_admin` is set ONLY by super-admin routes after the JWT
 *   has been verified as a platform admin.
 * - `app.allow_unscoped` is set ONLY by the login endpoint, which must find a
 *   user before it knows which tenant they belong to.
 * - Fail-closed: if no GUC is set, `current_setting(..., true)` is NULL, every
 *   comparison is NULL, and no rows are visible or writable.
 * - On top of this, every service still filters by organisation_id explicitly
 *   (defence in depth — application bug cannot leak a tenant either).
 */
import type { Pool } from "pg";

const BYPASS = `current_setting('app.is_platform_admin', true) = 'true'`;
const UNSCOPED = `current_setting('app.allow_unscoped', true) = 'true'`;
const ORG = `NULLIF(current_setting('app.current_org_id', true), '')::uuid`;

/** Tables that are deliberately NOT tenant-RLS'd. */
const EXCLUDED = new Set(["organisations", "permissions"]);

/** Tables without an organisation_id column — policy goes through a lookup. */
const SUBQUERY_POLICIES: Record<string, { using: string; check: string }> = {
  role_permissions: {
    using: `role_id IN (SELECT r.id FROM roles r WHERE r.organisation_id = ${ORG})`,
    check: `role_id IN (SELECT r.id FROM roles r WHERE r.organisation_id = ${ORG})`,
  },
  user_roles: {
    using: `user_id IN (SELECT u.id FROM users u WHERE u.organisation_id = ${ORG})`,
    check: `user_id IN (SELECT u.id FROM users u WHERE u.organisation_id = ${ORG})`,
  },
};

function q(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

export async function enableRowLevelSecurity(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ table_name: string }>(`
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> 'sqlx_migrations'
    ORDER BY table_name;
  `);

  for (const { table_name: table } of rows) {
    if (EXCLUDED.has(table)) continue;

    const special = SUBQUERY_POLICIES[table];
    const using = special
      ? `(${special.using} OR ${BYPASS} OR ${UNSCOPED})`
      : `(organisation_id = ${ORG} OR ${BYPASS} OR ${UNSCOPED})`;
    const check = special
      ? `(${special.check} OR ${BYPASS})`
      : `(organisation_id = ${ORG} OR ${BYPASS})`;

    await pool.query(`ALTER TABLE ${q(table)} ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`ALTER TABLE ${q(table)} FORCE ROW LEVEL SECURITY;`);
    await pool.query(`
      DROP POLICY IF EXISTS org_isolation ON ${q(table)};
      DO $do$
      BEGIN
        EXECUTE 'CREATE POLICY org_isolation ON ${q(table)} USING ('
                || '${using.replace(/'/g, "''")}' || ') WITH CHECK ('
                || '${check.replace(/'/g, "''")}' || ')';
      END
      $do$;
    `);
  }

  // The app role needs DML on everything (RLS still confines the rows).
  await pool.query(`
    GRANT USAGE ON SCHEMA public TO edu_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edu_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edu_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edu_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO edu_app;
  `);
}
