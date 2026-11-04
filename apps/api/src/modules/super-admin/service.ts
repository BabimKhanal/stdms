import { and, count, desc, eq, isNotNull, sum } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  auditLogs,
  backupJobs,
  files,
  featureFlags,
  organisations,
  platformAuditLogs,
  platformEmailSettings,
  students,
  users,
} from "../../db/schema";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { ensureDefaultEmailTemplates } from "../organisation/service";
import { env } from "../../env";
import { encryptEmailCredential } from "../../lib/email-credentials";
import { buildMailConfig, readEmailCredentials } from "../../lib/mail-config";
import { sendMail } from "../../lib/mailer";
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
