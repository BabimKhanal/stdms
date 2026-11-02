import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { auditLogs, documentTemplates, emailSettings, featureFlags, organisations } from "../../db/schema";
import { notFound } from "../../lib/errors";
import { decryptEmailCredential, encryptEmailCredential } from "../../lib/email-credentials";

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
export async function getEmailSettings(db: DB, orgId: string) {
  const [row] = await db.select().from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  if (row) {
    const { credentialsEncrypted, ...publicSettings } = row;
    return { ...publicSettings, hasCredentials: Boolean(credentialsEncrypted) };
  }
  const organisation = await get(db, orgId);
  return { id: null, organisationId: orgId, provider: "resend", enabled: true, fromName: organisation.name, fromEmail: organisation.email ?? "no-reply@example.com", replyTo: organisation.email, footer: null, dailyLimit: 1000, hasCredentials: false };
}
export async function saveEmailSettings(db: DB, orgId: string, input: { provider: string; enabled: boolean; fromName: string; fromEmail: string; replyTo: string | null; footer: string | null; dailyLimit: number; apiKey?: string }) {
  const [existing] = await db.select({ credentialsEncrypted: emailSettings.credentialsEncrypted }).from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  const credentialsEncrypted = input.apiKey ? encryptEmailCredential(input.apiKey) : existing?.credentialsEncrypted ?? null;
  const values = { provider: input.provider, enabled: input.enabled, fromName: input.fromName, fromEmail: input.fromEmail, replyTo: input.replyTo, footer: input.footer, dailyLimit: input.dailyLimit, credentialsEncrypted };
  await db.insert(emailSettings).values({ ...values, organisationId: orgId }).onConflictDoUpdate({ target: emailSettings.organisationId, set: { ...values, updatedAt: new Date() } });
  return getEmailSettings(db, orgId);
}
export async function getEmailDeliverySettings(db: DB, orgId: string) {
  const [row] = await db.select().from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  if (!row) return undefined;
  return { provider: row.provider as "console" | "resend", enabled: row.enabled, fromName: row.fromName, fromEmail: row.fromEmail, replyTo: row.replyTo, footer: row.footer, apiKey: row.credentialsEncrypted ? decryptEmailCredential(row.credentialsEncrypted) : undefined };
}
export async function listFeatures(db: DB, orgId: string) { return db.select().from(featureFlags).where(eq(featureFlags.organisationId, orgId)); }
export async function listAudit(db: DB, orgId: string) { return db.select().from(auditLogs).where(eq(auditLogs.organisationId, orgId)).orderBy(desc(auditLogs.createdAt)); }
export async function listDocumentTemplates(db: DB, orgId: string) { return db.select().from(documentTemplates).where(eq(documentTemplates.organisationId, orgId)).orderBy(desc(documentTemplates.updatedAt)); }
export async function getDocumentTemplate(db: DB, orgId: string, id: string) {
  const [row] = await db.select().from(documentTemplates).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).limit(1);
  if (!row) throw notFound("Document template not found");
  return row;
}
export async function saveDocumentTemplate(db: DB, orgId: string, userId: string, id: string | undefined, input: { name: string; documentType: string; design: Record<string, unknown>; isDefault: boolean }) {
  return db.transaction(async (tx) => {
    if (id) {
      const [existing] = await tx.select({ documentType: documentTemplates.documentType }).from(documentTemplates).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).limit(1);
      if (!existing) throw notFound("Document template not found");
      if (existing.documentType !== input.documentType) {
        await tx.update(documentTemplates).set({ isDefault: 0 }).where(and(eq(documentTemplates.organisationId, orgId), eq(documentTemplates.documentType, existing.documentType)));
      }
    }
    if (input.isDefault) {
      await tx
        .update(documentTemplates)
        .set({ isDefault: 0 })
        .where(and(eq(documentTemplates.organisationId, orgId), eq(documentTemplates.documentType, input.documentType)));
    }
    if (id) { const [row] = await tx.update(documentTemplates).set({ name: input.name, documentType: input.documentType, design: input.design, isDefault: input.isDefault ? 1 : 0, updatedAt: new Date() }).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).returning(); if (!row) throw notFound("Document template not found"); return row; }
    const [row] = await tx.insert(documentTemplates).values({ organisationId: orgId, createdBy: userId, name: input.name, documentType: input.documentType, design: input.design, isDefault: input.isDefault ? 1 : 0 }).returning(); return row;
  });
}
export async function importDocumentTemplates(
  db: DB,
  orgId: string,
  userId: string,
  templates: { name: string; documentType: string; design: Record<string, unknown>; isDefault?: boolean }[],
) {
  const imported: unknown[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const template of templates) {
    try {
      imported.push(
        await saveDocumentTemplate(db, orgId, userId, undefined, {
          name: template.name,
          documentType: template.documentType,
          design: template.design,
          isDefault: template.isDefault ?? false,
        }),
      );
    } catch (error) {
      failed.push({ name: template.name, reason: error instanceof Error ? error.message : "Import failed" });
    }
  }
  return { imported, failed };
}
export async function deleteDocumentTemplate(db: DB, orgId: string, id: string) { const rows = await db.delete(documentTemplates).where(and(eq(documentTemplates.id, id), eq(documentTemplates.organisationId, orgId))).returning({ id: documentTemplates.id }); if (!rows.length) throw notFound("Document template not found"); }
