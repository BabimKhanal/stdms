import { and, count, desc, eq, inArray, isNotNull, sum } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  auditLogs,
  backupJobs,
  files,
  featureFlags,
  organisations,
  platformAuditLogs,
  platformEmailSettings,
  platformEmailDeliveries,
  platformEmailTemplates,
  students,
  users,
} from "../../db/schema";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../../lib/errors";
import { ensureDefaultEmailTemplates } from "../organisation/service";
import { env } from "../../env";
import { encryptEmailCredential } from "../../lib/email-credentials";
import { buildMailConfig, readEmailCredentials } from "../../lib/mail-config";
import { sendMail } from "../../lib/mailer";
import { DEFAULT_EMAIL_TEMPLATES, renderEmailHtml, renderEmailSubject, renderEmailText } from "../../lib/email-template";
import { hashPassword, verifyPassword } from "../../lib/password";
export async function listOrganisations(db: DB) {
  const [rows, userCounts, studentCounts] = await Promise.all([
    db.select().from(organisations).orderBy(organisations.createdAt),
    db
      .select({ organisationId: users.organisationId, count: count() })
      .from(users)
      .where(isNotNull(users.organisationId))
      .groupBy(users.organisationId),
    db
      .select({ organisationId: students.organisationId, count: count() })
      .from(students)
      .groupBy(students.organisationId),
  ]);
  const usersByOrganisation = new Map(
    userCounts.map((row) => [row.organisationId, Number(row.count)]),
  );
  const studentsByOrganisation = new Map(
    studentCounts.map((row) => [row.organisationId, Number(row.count)]),
  );
  return rows.map((row) => ({
    ...row,
    userCount: usersByOrganisation.get(row.id) ?? 0,
    studentCount: studentsByOrganisation.get(row.id) ?? 0,
  }));
}
export async function saveOrganisation(
  db: DB,
  id: string | undefined,
  input: Partial<typeof organisations.$inferInsert>,
) {
  if (!id && (!input.name || !input.slug))
    throw badRequest("Organisation name and slug are required");
  let row;
  try {
    row = id
      ? (
          await db
            .update(organisations)
            .set(input)
            .where(eq(organisations.id, id))
            .returning()
        )[0]
      : (
          await db
            .insert(organisations)
            .values({ name: input.name!, slug: input.slug!, ...input })
            .returning()
        )[0];
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw conflict("Tenant slug is already in use");
    throw error;
  }
  if (!row) throw notFound("Organisation not found");
  if (!id) await ensureDefaultEmailTemplates(db, row.id);
  return row;
}
export async function getOrganisation(db: DB, id: string) {
  const [row] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, id))
    .limit(1);
  if (!row) throw notFound("Organisation not found");
  return row;
}
export async function getOrganisationProfile(db: DB, id: string) {
  const organisation = await getOrganisation(db, id);
  const [
    [userTotal],
    [activeUserTotal],
    [studentTotal],
    [storageTotal],
    recentActivity,
    flags,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.organisationId, id)),
    db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.organisationId, id), eq(users.status, "active"))),
    db
      .select({ count: count() })
      .from(students)
      .where(eq(students.organisationId, id)),
    db
      .select({ bytes: sum(files.size) })
      .from(files)
      .where(eq(files.organisationId, id)),
    db
      .select({
        id: auditLogs.id,
        userName: auditLogs.userName,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        newValue: auditLogs.newValue,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.organisationId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(25),
    db.select().from(featureFlags).where(eq(featureFlags.organisationId, id)),
  ]);

  return {
    organisation,
    usage: {
      users: Number(userTotal.count),
      activeUsers: Number(activeUserTotal.count),
      students: Number(studentTotal.count),
      storageBytes: Number(storageTotal.bytes ?? 0),
    },
    features: flags,
    recentActivity,
  };
}
export async function listFlags(db: DB, orgId: string) {
  return db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.organisationId, orgId));
}
export async function saveFlag(
  db: DB,
  orgId: string,
  flag: string,
  enabled: boolean,
) {
  const [row] = await db
    .insert(featureFlags)
    .values({ organisationId: orgId, flag, enabled })
    .onConflictDoUpdate({
      target: [featureFlags.organisationId, featureFlags.flag],
      set: { enabled },
    })
    .returning();
  return row;
}
export async function stats(db: DB) {
  const [[orgs], [userCount], [studentCount]] = await Promise.all([
    db.select({ count: count() }).from(organisations),
    db
      .select({ count: count() })
      .from(users)
      .where(isNotNull(users.organisationId)),
    db.select({ count: count() }).from(students),
  ]);
  return {
    organisations: Number(orgs.count),
    users: Number(userCount.count),
    students: Number(studentCount.count),
  };
}

export async function writePlatformAudit(
  db: DB,
  entry: typeof platformAuditLogs.$inferInsert,
) {
  try {
    await db.insert(platformAuditLogs).values(entry);
  } catch (error) {
    console.error("[platform-audit]", error);
  }
}

export async function listPlatformAudit(db: DB) {
  return db
    .select()
    .from(platformAuditLogs)
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(50);
}

export async function listBackupJobs(db: DB) {
  return db
    .select()
    .from(backupJobs)
    .orderBy(desc(backupJobs.startedAt))
    .limit(50);
}

function publicPlatformEmailSettings(row: typeof platformEmailSettings.$inferSelect | null) {
  const credentials = readEmailCredentials(row?.credentialsEncrypted);
  return {
    id: row?.id ?? null,
    provider: row?.provider ?? env.MAILER_PROVIDER,
    enabled: row?.enabled ?? true,
    fromName: row?.fromName ?? "Platform alerts",
    fromEmail: row?.fromEmail ?? env.MAIL_FROM_EMAIL,
    replyTo: row?.replyTo ?? null,
    footer: row?.footer ?? null,
    providerDomain: row?.providerDomain ?? null,
    smtpHost: row?.smtpHost ?? null,
    smtpPort: row?.smtpPort ?? 587,
    smtpSecure: row?.smtpSecure ?? false,
    smtpUsername: row?.smtpUsername ?? null,
    hasApiKey: Boolean(credentials.apiKey),
    hasSmtpPassword: Boolean(credentials.smtpPassword),
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getPlatformEmailSettings(db: DB) {
  const [row] = await db.select().from(platformEmailSettings).limit(1);
  return publicPlatformEmailSettings(row ?? null);
}

export async function savePlatformEmailSettings(
  db: DB,
  input: {
    provider: string;
    enabled: boolean;
    fromName: string;
    fromEmail: string;
    replyTo?: string | null;
    footer?: string | null;
    providerDomain?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpSecure?: boolean;
    smtpUsername?: string | null;
    apiKey?: string;
    smtpPassword?: string;
  },
) {
  const [existing] = await db.select().from(platformEmailSettings).limit(1);
  const credentials = readEmailCredentials(existing?.credentialsEncrypted);
  if (input.apiKey !== undefined) {
    if (input.apiKey) credentials.apiKey = input.apiKey;
    else delete credentials.apiKey;
  }
  if (input.smtpPassword !== undefined) {
    if (input.smtpPassword) credentials.smtpPassword = input.smtpPassword;
    else delete credentials.smtpPassword;
  }
  const credentialsEncrypted = Object.keys(credentials).length
    ? encryptEmailCredential(JSON.stringify(credentials))
    : null;
  const values = {
    singleton: "default",
    provider: input.provider,
    enabled: input.enabled,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo ?? null,
    footer: input.footer ?? null,
    providerDomain: input.providerDomain ?? null,
    smtpHost: input.smtpHost ?? null,
    smtpPort: input.smtpPort ?? null,
    smtpSecure: input.smtpSecure ?? false,
    smtpUsername: input.smtpUsername ?? null,
    credentialsEncrypted,
    updatedAt: new Date(),
  };
  const [row] = existing
    ? await db.update(platformEmailSettings).set(values).where(eq(platformEmailSettings.id, existing.id)).returning()
    : await db.insert(platformEmailSettings).values(values).returning();
  return publicPlatformEmailSettings(row);
}

export async function testPlatformEmail(db: DB, to: string) {
  const [row] = await db.select().from(platformEmailSettings).limit(1);
  const settings = row ?? {
    provider: env.MAILER_PROVIDER,
    enabled: true,
    fromName: "Platform alerts",
    fromEmail: env.MAIL_FROM_EMAIL,
    replyTo: null,
    footer: null,
    providerDomain: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: false,
    smtpUsername: null,
    credentialsEncrypted: null,
  };
  await sendMail(
    {
      to,
      subject: "Platform alert email test",
      html: "<h2>Platform alert email is configured</h2><p>This is a test message from the Super Admin console.</p>",
      text: "Platform alert email is configured. This is a test message from the Super Admin console.",
    },
    buildMailConfig(settings),
  );
  return { sent: true, to };
}

export async function ensurePlatformEmailTemplates(db: DB) {
  await db.insert(platformEmailTemplates).values([
    {
      key: "maintenance_notification",
      name: "Maintenance notification",
      subject: "Scheduled maintenance: {{title}}",
      htmlBody: "<h2>{{title}}</h2><p>Hello {{schoolName}},</p><p>{{body}}</p><p>We will share another update when service is restored.</p>",
      textBody: "{{title}}\n\nHello {{schoolName}},\n\n{{body}}\n\nWe will share another update when service is restored.",
      isActive: true,
    },
    ...DEFAULT_EMAIL_TEMPLATES.filter((template) => template.key === "bulk_message" || template.key === "default").map((template) => ({
      key: template.key,
      name: `Platform ${template.name}`,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      isActive: true,
    })),
  ]).onConflictDoNothing();
}

export async function listPlatformEmailTemplates(db: DB) {
  await ensurePlatformEmailTemplates(db);
  return db.select().from(platformEmailTemplates).orderBy(platformEmailTemplates.name);
}

export async function savePlatformEmailTemplate(
  db: DB,
  userId: string,
  id: string | undefined,
  input: { key: string; name: string; subject: string; htmlBody: string; textBody: string | null; isActive: boolean },
) {
  if (id) {
    const [row] = await db.update(platformEmailTemplates).set({ name: input.name, subject: input.subject, htmlBody: input.htmlBody, textBody: input.textBody, isActive: input.isActive }).where(eq(platformEmailTemplates.id, id)).returning();
    if (!row) throw notFound("Platform email template not found");
    return row;
  }
  const [row] = await db.insert(platformEmailTemplates).values({ ...input, createdBy: userId }).returning();
  return row;
}

export async function deletePlatformEmailTemplate(db: DB, id: string) {
  const rows = await db.delete(platformEmailTemplates).where(eq(platformEmailTemplates.id, id)).returning({ id: platformEmailTemplates.id });
  if (!rows.length) throw notFound("Platform email template not found");
}

async function platformMailConfig(db: DB) {
  const [row] = await db.select().from(platformEmailSettings).limit(1);
  return row ? buildMailConfig(row) : undefined;
}

export async function previewPlatformEmail(db: DB, input: { subject: string; htmlBody: string; textBody?: string | null }) {
  const [organisation] = await db.select({ name: organisations.name }).from(organisations).where(eq(organisations.status, "active")).limit(1);
  const vars = { title: "Maintenance update", body: "This is a preview of your platform message.", schoolName: organisation?.name ?? "Tenant organisation", recipientName: "Tenant administrator", appUrl: env.WEB_ORIGIN, date: new Date().toISOString().slice(0, 10) };
  return { subject: renderEmailSubject(input.subject, vars), html: renderEmailHtml(input.htmlBody, vars), text: input.textBody ? renderEmailText(input.textBody, vars) : undefined };
}

export async function listPlatformEmailDeliveries(db: DB) {
  return db.select({
    id: platformEmailDeliveries.id,
    organisationId: platformEmailDeliveries.organisationId,
    organisationName: organisations.name,
    templateKey: platformEmailDeliveries.templateKey,
    toEmail: platformEmailDeliveries.toEmail,
    subject: platformEmailDeliveries.subject,
    provider: platformEmailDeliveries.provider,
    status: platformEmailDeliveries.status,
    error: platformEmailDeliveries.error,
    sentAt: platformEmailDeliveries.sentAt,
    createdAt: platformEmailDeliveries.createdAt,
  }).from(platformEmailDeliveries).leftJoin(organisations, eq(platformEmailDeliveries.organisationId, organisations.id)).orderBy(desc(platformEmailDeliveries.createdAt)).limit(200);
}

export async function sendPlatformBroadcast(
  db: DB,
  userId: string,
  input: { templateKey: string; title: string; body: string; organisationIds?: string[] },
) {
  const [template] = await db.select().from(platformEmailTemplates).where(and(eq(platformEmailTemplates.key, input.templateKey), eq(platformEmailTemplates.isActive, true))).limit(1);
  if (!template) throw notFound("Active platform email template not found");
  const conditions = [inArray(organisations.status, ["active", "trial"]), isNotNull(organisations.email)];
  if (input.organisationIds?.length) conditions.push(inArray(organisations.id, input.organisationIds));
  const recipients = await db.select({ id: organisations.id, name: organisations.name, email: organisations.email }).from(organisations).where(and(...conditions));
  const config = await platformMailConfig(db);
  if (config?.enabled === false) throw badRequest("Platform email is disabled", "email_disabled");
  const provider = config?.provider ?? env.MAILER_PROVIDER;
  const deliveries = await Promise.all(recipients.map(async (recipient) => {
    const vars = { title: input.title, body: input.body, schoolName: recipient.name, recipientName: "Tenant administrator", appUrl: env.WEB_ORIGIN, date: new Date().toISOString().slice(0, 10) };
    const content = { subject: renderEmailSubject(template.subject, vars), html: renderEmailHtml(template.htmlBody, vars), text: template.textBody ? renderEmailText(template.textBody, vars) : undefined };
    try {
      await sendMail({ to: recipient.email!, subject: content.subject, html: content.html, text: content.text }, config);
      return { organisationId: recipient.id, templateKey: template.key, toEmail: recipient.email!, subject: content.subject, htmlBody: content.html, textBody: content.text ?? null, provider, status: "sent" as const, error: null, createdBy: userId, sentAt: new Date() };
    } catch (error) {
      return { organisationId: recipient.id, templateKey: template.key, toEmail: recipient.email!, subject: content.subject, htmlBody: content.html, textBody: content.text ?? null, provider, status: "failed" as const, error: error instanceof Error ? error.message : "Email delivery failed", createdBy: userId, sentAt: null };
    }
  }));
  if (deliveries.length) await db.insert(platformEmailDeliveries).values(deliveries);
  return { total: deliveries.length, sent: deliveries.filter((delivery) => delivery.status === "sent").length, failed: deliveries.filter((delivery) => delivery.status === "failed").length };
}

export async function retryPlatformEmailDelivery(db: DB, id: string, userId: string) {
  const [delivery] = await db.select().from(platformEmailDeliveries).where(eq(platformEmailDeliveries.id, id)).limit(1);
  if (!delivery) throw notFound("Platform email delivery not found");
  try {
    await sendMail({ to: delivery.toEmail, subject: delivery.subject, html: delivery.htmlBody ?? "", text: delivery.textBody ?? undefined }, await platformMailConfig(db));
    const [row] = await db.update(platformEmailDeliveries).set({ status: "sent", error: null, sentAt: new Date(), createdBy: userId }).where(eq(platformEmailDeliveries.id, id)).returning();
    return row;
  } catch (error) {
    const [row] = await db.update(platformEmailDeliveries).set({ status: "failed", error: error instanceof Error ? error.message : "Email delivery failed", createdBy: userId }).where(eq(platformEmailDeliveries.id, id)).returning();
    return row;
  }
}

export async function changePlatformEmail(
  db: DB,
  userId: string,
  currentEmail: string,
  newEmail: string,
) {
  const [row] = await db
    .select({ id: users.id, email: users.email, isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw unauthorized("Account not found");
  if (!row.isPlatformAdmin) throw forbidden("Platform admin access required");
  if ((row.email ?? "").toLowerCase() !== currentEmail.toLowerCase()) {
    throw badRequest("Current email does not match your account");
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);
  if (existing && existing.id !== userId) {
    throw conflict("Email is already in use by another account");
  }
  const [updated] = await db
    .update(users)
    .set({ email: newEmail, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email });
  if (!updated) throw notFound("Account not found");
  return updated;
}

export async function changePlatformPassword(
  db: DB,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const [row] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw unauthorized("Account not found");
  if (!row.isPlatformAdmin) throw forbidden("Platform admin access required");
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw badRequest("Current password is incorrect");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
