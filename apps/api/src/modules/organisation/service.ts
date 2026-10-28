import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { auditLogs, documentTemplates, featureFlags, organisations } from "../../db/schema";
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
export async function listDocumentTemplates(db: DB, orgId: string) { return db.select().from(documentTemplates).where(eq(documentTemplates.organisationId, orgId)).orderBy(desc(documentTemplates.updatedAt)); }
export async function saveDocumentTemplate(db: DB, orgId: string, userId: string, id: string | undefined, input: { name: string; documentType: string; design: Record<string, unknown>; isDefault: boolean }) {
  return db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(documentTemplates).set({ isDefault: 0 }).where(eq(documentTemplates.organisationId, orgId));
    if (id) { const [row] = await tx.update(documentTemplates).set({ name: input.name, documentType: input.documentType, design: input.design, isDefault: input.isDefault ? 1 : 0 }).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).returning(); if (!row) throw notFound("Document template not found"); return row; }
    const [row] = await tx.insert(documentTemplates).values({ organisationId: orgId, createdBy: userId, name: input.name, documentType: input.documentType, design: input.design, isDefault: input.isDefault ? 1 : 0 }).returning(); return row;
  });
}
export async function deleteDocumentTemplate(db: DB, orgId: string, id: string) { const rows = await db.delete(documentTemplates).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).returning({ id: documentTemplates.id }); if (!rows.length) throw notFound("Document template not found"); }
