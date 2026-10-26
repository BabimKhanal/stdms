import type { Context } from "hono";
import { auditLogs } from "../db/schema";

type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

/**
 * Writes an immutable audit row (SRS §50).
 * Failures never break the main request — auditing is best-effort logging.
 */
export async function writeAudit(c: Context, entry: AuditEntry): Promise<void> {
  try {
    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!orgId) return;
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || null;
    await c.get("db").insert(auditLogs).values({
      organisationId: orgId,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue === undefined ? null : JSON.parse(JSON.stringify(entry.oldValue)),
      newValue: entry.newValue === undefined ? null : JSON.parse(JSON.stringify(entry.newValue)),
      ip,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
