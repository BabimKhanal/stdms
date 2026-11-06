import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { auditLogs, documentTemplates, emailDeliveries, emailSettings, emailTemplates, featureFlags, organisations } from "../../db/schema";
import { conflict, notFound } from "../../lib/errors";
import { encryptEmailCredential } from "../../lib/email-credentials";
import { buildMailConfig, readEmailCredentials } from "../../lib/mail-config";
import { DEFAULT_EMAIL_TEMPLATES, EmailVariables, renderEmailHtml, renderEmailSubject, renderEmailText } from "../../lib/email-template";

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
export type EmailSettingsInput = {
  provider: string;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footer: string | null;
  dailyLimit: number;
  providerDomain?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  apiKey?: string;
  smtpPassword?: string;
};

function publicEmailSettings(row: typeof emailSettings.$inferSelect) {
  const credentials = readEmailCredentials(row.credentialsEncrypted);
  const { credentialsEncrypted: _ignored, ...rest } = row;
  const smtpSecure = row.smtpPort === 465 ? true : row.smtpPort === 587 ? false : row.smtpSecure;
  return { ...rest, smtpSecure, hasCredentials: Boolean(row.credentialsEncrypted), hasApiKey: Boolean(credentials.apiKey), hasSmtpPassword: Boolean(credentials.smtpPassword) };
}

export async function getEmailSettings(db: DB, orgId: string) {
  const [row] = await db.select().from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  if (row) return publicEmailSettings(row);
  const organisation = await get(db, orgId);
  return {
    id: null,
    organisationId: orgId,
    provider: "resend",
    enabled: true,
    fromName: organisation.name,
    fromEmail: organisation.email ?? "no-reply@example.com",
    replyTo: organisation.email,
    footer: null,
    dailyLimit: 1000,
    providerDomain: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: false,
    smtpUsername: null,
    lastTestedAt: null,
    lastTestError: null,
    hasCredentials: false,
    hasApiKey: false,
    hasSmtpPassword: false,
  };
}

export async function saveEmailSettings(db: DB, orgId: string, input: EmailSettingsInput) {
  const [existing] = await db.select({ credentialsEncrypted: emailSettings.credentialsEncrypted }).from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  const credentials = readEmailCredentials(existing?.credentialsEncrypted);
  if (input.apiKey !== undefined) {
    if (input.apiKey) credentials.apiKey = input.apiKey;
    else delete credentials.apiKey;
  }
  if (input.smtpPassword !== undefined) {
    if (input.smtpPassword) credentials.smtpPassword = input.smtpPassword;
    else delete credentials.smtpPassword;
  }
  const credentialsEncrypted = Object.keys(credentials).length ? encryptEmailCredential(JSON.stringify(credentials)) : null;
  const values = {
    provider: input.provider,
    enabled: input.enabled,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo,
    footer: input.footer,
    dailyLimit: input.dailyLimit,
    providerDomain: input.providerDomain ?? null,
    smtpHost: input.smtpHost ?? null,
    smtpPort: input.smtpPort ?? null,
    smtpSecure: input.smtpSecure ?? input.smtpPort === 465,
    smtpUsername: input.smtpUsername ?? null,
    credentialsEncrypted,
  };
  await db.insert(emailSettings).values({ ...values, organisationId: orgId }).onConflictDoUpdate({ target: emailSettings.organisationId, set: { ...values, updatedAt: new Date() } });
  return getEmailSettings(db, orgId);
}

export async function recordEmailTest(db: DB, orgId: string, error?: string | null) {
  const [row] = await db
    .update(emailSettings)
    .set({ lastTestedAt: new Date(), lastTestError: error ?? null })
    .where(eq(emailSettings.organisationId, orgId))
    .returning();
  return row ?? null;
}

export async function getEmailDeliverySettings(db: DB, orgId: string) {
  const [row] = await db.select().from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  return row ? buildMailConfig(row) : undefined;
}

export async function ensureDefaultEmailTemplates(db: DB, orgId: string) {
  await db.insert(emailTemplates).values(DEFAULT_EMAIL_TEMPLATES.map((template) => ({
    organisationId: orgId,
    key: template.key,
    name: template.name,
    subject: template.subject,
    htmlBody: template.htmlBody,
    textBody: template.textBody,
    isActive: true,
  }))).onConflictDoNothing();
}

export async function listEmailTemplates(db: DB, orgId: string) {
  await ensureDefaultEmailTemplates(db, orgId);
  return db.select().from(emailTemplates).where(eq(emailTemplates.organisationId, orgId)).orderBy(emailTemplates.name);
}

export async function getEmailTemplate(db: DB, orgId: string, keyOrId: string) {
  const [row] = await db.select().from(emailTemplates).where(and(eq(emailTemplates.organisationId, orgId), eq(emailTemplates.key, keyOrId))).limit(1);
  if (row) return row;
  const [byId] = await db.select().from(emailTemplates).where(and(eq(emailTemplates.organisationId, orgId), eq(emailTemplates.id, keyOrId))).limit(1);
  return byId ?? null;
}

export async function saveEmailTemplate(
  db: DB,
  orgId: string,
  userId: string,
  id: string | undefined,
  input: { key: string; name: string; subject: string; htmlBody: string; textBody: string | null; isActive: boolean },
) {
  if (id) {
    const [row] = await db.update(emailTemplates).set({ name: input.name, subject: input.subject, htmlBody: input.htmlBody, textBody: input.textBody, isActive: input.isActive }).where(and(eq(emailTemplates.id, id), eq(emailTemplates.organisationId, orgId))).returning();
    if (!row) throw notFound("Email template not found");
    return row;
  }
  const [existing] = await db.select({ id: emailTemplates.id }).from(emailTemplates).where(and(eq(emailTemplates.organisationId, orgId), eq(emailTemplates.key, input.key))).limit(1);
  if (existing) throw conflict("An email template with this key already exists");
  const [row] = await db.insert(emailTemplates).values({ organisationId: orgId, createdBy: userId, key: input.key, name: input.name, subject: input.subject, htmlBody: input.htmlBody, textBody: input.textBody, isActive: input.isActive }).returning();
  return row;
}

export async function deleteEmailTemplate(db: DB, orgId: string, id: string) {
  const rows = await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.organisationId, orgId))).returning({ id: emailTemplates.id });
  if (!rows.length) throw notFound("Email template not found");
}

export function renderTemplate(row: { subject: string; htmlBody: string; textBody: string | null }, vars: EmailVariables) {
  return {
    subject: renderEmailSubject(row.subject, vars),
    html: renderEmailHtml(row.htmlBody, vars),
    text: row.textBody ? renderEmailText(row.textBody, vars) : undefined,
  };
}

export async function listEmailDeliveries(db: DB, orgId: string) {
  return db.select().from(emailDeliveries).where(eq(emailDeliveries.organisationId, orgId)).orderBy(desc(emailDeliveries.createdAt)).limit(100);
}

export async function recordEmailDelivery(
  db: DB,
  orgId: string,
  input: { templateKey?: string | null; toEmail: string; subject: string; htmlBody: string; provider: string; status: "sent" | "failed"; error?: string | null; createdBy?: string | null },
) {
  await db.insert(emailDeliveries).values({
    organisationId: orgId,
    templateKey: input.templateKey ?? null,
    toEmail: input.toEmail,
    subject: input.subject,
    htmlBody: input.htmlBody,
    provider: input.provider,
    status: input.status,
    error: input.error ?? null,
    createdBy: input.createdBy ?? null,
    sentAt: input.status === "sent" ? new Date() : null,
  });
}

export async function getEmailDelivery(db: DB, orgId: string, id: string) {
  const [row] = await db.select().from(emailDeliveries).where(and(eq(emailDeliveries.id, id), eq(emailDeliveries.organisationId, orgId))).limit(1);
  if (!row) throw notFound("Email delivery not found");
  return row;
}

export async function markEmailDelivery(db: DB, orgId: string, id: string, status: "sent" | "failed", error?: string | null) {
  const [row] = await db
    .update(emailDeliveries)
    .set({ status, error: error ?? null, sentAt: status === "sent" ? new Date() : null })
    .where(and(eq(emailDeliveries.id, id), eq(emailDeliveries.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Email delivery not found");
  return row;
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
