import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { auditLogs, featureFlags, organisations } from "../../db/schema";
import { notFound } from "../../lib/errors";

export async function get(db: DB, orgId: string) {
  const [row] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  if (!row) throw notFound("Organisation not found");
  return row;
}
export async function getBranding(db: DB, orgId: string) {
  const [row] = await db
    .select({
      name: organisations.name,
      logoUrl: organisations.logoUrl,
      primaryColor: organisations.primaryColor,
    })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  if (!row) throw notFound("Organisation not found");
  return row;
}
export async function update(db: DB, orgId: string, input: Partial<typeof organisations.$inferInsert>) {
  const [row] = await db.update(organisations).set(input).where(eq(organisations.id, orgId)).returning();
  if (!row) throw notFound("Organisation not found");
  return row;
}
export async function updateBranding(
  db: DB,
  orgId: string,
  input: { name: string; logoUrl: string | null; primaryColor: string },
) {
  const [row] = await db
    .update(organisations)
    .set(input)
    .where(eq(organisations.id, orgId))
    .returning({
      name: organisations.name,
      logoUrl: organisations.logoUrl,
      primaryColor: organisations.primaryColor,
    });
  if (!row) throw notFound("Organisation not found");
  return row;
}
export async function listFeatures(db: DB, orgId: string) { return db.select().from(featureFlags).where(eq(featureFlags.organisationId, orgId)); }
export async function listAudit(db: DB, orgId: string) { return db.select().from(auditLogs).where(eq(auditLogs.organisationId, orgId)).orderBy(desc(auditLogs.createdAt)); }
