import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { emailSettings, employees, guardians, notifications, students, users } from "../../db/schema";
import type { DB } from "../../db/client";
import { deliverNotification } from "../../lib/notification-providers";
import { decryptEmailCredential } from "../../lib/email-credentials";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
};

export async function list(db: DB, orgId: string, userId: string) {
  return db.select().from(notifications)
    .where(and(eq(notifications.organisationId, orgId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt)).limit(50);
}

export async function unreadCount(db: DB, orgId: string, userId: string) {
  const rows = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.organisationId, orgId), eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function markRead(db: DB, orgId: string, userId: string, id: string) {
  const [row] = await db.update(notifications).set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.organisationId, orgId), eq(notifications.userId, userId)))
    .returning();
  return row ?? null;
}

export async function createForUsers(db: DB, orgId: string, userIds: string[], input: NotificationInput) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return [];
  const rows = await db.insert(notifications).values(uniqueUserIds.map((userId) => ({
    organisationId: orgId,
    userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: input.data ?? {},
  }))).returning();
  const recipients = await db.select({ id: users.id, email: users.email, phone: sql<string | null>`coalesce(${employees.phone}, ${students.phone}, ${guardians.phone})` }).from(users).leftJoin(employees, eq(users.employeeId, employees.id)).leftJoin(students, eq(users.studentId, students.id)).leftJoin(guardians, eq(users.guardianId, guardians.id)).where(and(eq(users.organisationId, orgId), inArray(users.id, uniqueUserIds)));
  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const [settings] = await db.select({ provider: emailSettings.provider, enabled: emailSettings.enabled, fromName: emailSettings.fromName, fromEmail: emailSettings.fromEmail, replyTo: emailSettings.replyTo, footer: emailSettings.footer, credentialsEncrypted: emailSettings.credentialsEncrypted }).from(emailSettings).where(eq(emailSettings.organisationId, orgId)).limit(1);
  const mailConfig = settings ? { ...settings, provider: settings.provider as "console" | "resend", apiKey: settings.credentialsEncrypted ? decryptEmailCredential(settings.credentialsEncrypted) : undefined } : undefined;
  await Promise.all(rows.map((row) => deliverNotification(recipientMap.get(row.userId) ?? { id: row.userId }, { title: input.title, body: input.body ?? "", data: input.data }, mailConfig)));
  return rows;
}

export async function organisationUserIds(db: DB, orgId: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.organisationId, orgId));
  return rows.map((row) => row.id);
}
