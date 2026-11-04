import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  emailDeliveries,
  emailSettings,
  emailTemplates,
  employees,
  guardians,
  notifications,
  organisations,
  pushTokens,
  students,
  users,
} from "../../db/schema";
import type { DB } from "../../db/client";
import { env } from "../../env";
import {
  deliverExpoPushNotifications,
  deliverNotification,
} from "../../lib/notification-providers";
import { buildMailConfig } from "../../lib/mail-config";
import {
  renderEmailHtml,
  renderEmailSubject,
  renderEmailText,
} from "../../lib/email-template";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  createdBy?: string | null;
  push?: boolean;
  email?: { subject: string; html: string; text?: string };
};

export async function list(db: DB, orgId: string, userId: string) {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organisationId, orgId),
        eq(notifications.userId, userId),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function unreadCount(db: DB, orgId: string, userId: string) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.organisationId, orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
  return rows.length;
}

export async function markRead(
  db: DB,
  orgId: string,
  userId: string,
  id: string,
) {
  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.organisationId, orgId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function registerPushToken(
  db: DB,
  orgId: string,
  userId: string,
  token: string,
  platform: string,
) {
  const [row] = await db
    .insert(pushTokens)
    .values({
      organisationId: orgId,
      userId,
      token,
      platform,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { organisationId: orgId, userId, platform, lastSeenAt: new Date() },
    })
    .returning();
  return row;
}

export async function revokePushToken(
  db: DB,
  orgId: string,
  userId: string,
  token: string,
) {
  const rows = await db
    .delete(pushTokens)
    .where(
      and(
        eq(pushTokens.organisationId, orgId),
        eq(pushTokens.userId, userId),
        eq(pushTokens.token, token),
      ),
    )
    .returning({ id: pushTokens.id });
  return { revoked: rows.length > 0 };
}

export async function createForUsers(
  db: DB,
  orgId: string,
  userIds: string[],
  input: NotificationInput,
) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return [];
  const rows = await db
    .insert(notifications)
    .values(
      uniqueUserIds.map((userId) => ({
        organisationId: orgId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? {},
      })),
    )
    .returning();

  if (input.push !== false && env.PUSH_PROVIDER === "expo") {
    const registeredTokens = await db
      .select({ userId: pushTokens.userId, token: pushTokens.token })
      .from(pushTokens)
      .where(
        and(
          eq(pushTokens.organisationId, orgId),
          inArray(pushTokens.userId, uniqueUserIds),
        ),
      );
    const notificationByUser = new Map(rows.map((row) => [row.userId, row]));
    const invalidTokens = await deliverExpoPushNotifications(
      registeredTokens.flatMap((registered) => {
        const notification = notificationByUser.get(registered.userId);
        return notification
          ? [
              {
                to: registered.token,
                title: notification.title,
                body: notification.body ?? "",
                data: {
                  type: notification.type,
                  notificationId: notification.id,
                  url: "nucleus-education://updates",
                },
              },
            ]
          : [];
      }),
    );
    if (invalidTokens.length)
      await db
        .delete(pushTokens)
        .where(
          and(
            eq(pushTokens.organisationId, orgId),
            inArray(pushTokens.token, invalidTokens),
          ),
        );
  }

  const recipients = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: sql<
        string | null
      >`coalesce(${employees.phone}, ${students.phone}, ${guardians.phone})`,
    })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(students, eq(users.studentId, students.id))
    .leftJoin(guardians, eq(users.guardianId, guardians.id))
    .where(
      and(eq(users.organisationId, orgId), inArray(users.id, uniqueUserIds)),
    );
  const recipientMap = new Map(
    recipients.map((recipient) => [recipient.id, recipient]),
  );

  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.organisationId, orgId))
    .limit(1);
  const mailConfig = settings ? buildMailConfig(settings) : undefined;
  const provider = mailConfig?.provider ?? env.MAILER_PROVIDER;

  const [organisation] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  const activeTemplates = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.organisationId, orgId),
        eq(emailTemplates.isActive, true),
      ),
    );
  const templateMap = new Map(
    activeTemplates.map((template) => [template.key, template]),
  );
  const fallback = templateMap.get("default");
  const schoolName = organisation?.name ?? "Your institution";
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(),
  );

  const deliveries: (typeof emailDeliveries.$inferInsert)[] = [];
  await Promise.all(
    rows.map(async (row) => {
      const recipient = recipientMap.get(row.userId) ?? {
        id: row.userId,
        name: null,
        email: null,
        phone: null,
      };
      const template = templateMap.get(input.type) ?? fallback;
      const vars = {
        title: input.title,
        body: input.body ?? "",
        schoolName,
        recipientName: recipient.name ?? "",
        appUrl: env.WEB_ORIGIN,
        date,
      };
      const content = input.email ?? (template
        ? {
            subject: renderEmailSubject(template.subject, vars),
            html: renderEmailHtml(template.htmlBody, vars),
            text: template.textBody
              ? renderEmailText(template.textBody, vars)
              : undefined,
          }
        : { subject: input.title, html: `<p>${input.body ?? ""}</p>` });

      const result = await deliverNotification(
        recipient,
        { title: input.title, body: input.body ?? "", data: input.data },
        mailConfig,
        content,
      );
      if (result.email && recipient.email) {
        deliveries.push({
          organisationId: orgId,
          templateKey: template?.key ?? null,
          toEmail: recipient.email,
          subject: result.email.subject,
          htmlBody: result.email.html,
          provider,
          status: result.email.status,
          error: result.email.error ?? null,
          createdBy: input.createdBy ?? null,
          sentAt: result.email.status === "sent" ? new Date() : null,
        });
      }
    }),
  );

  if (deliveries.length) await db.insert(emailDeliveries).values(deliveries);
  return rows;
}

export async function organisationUserIds(db: DB, orgId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organisationId, orgId));
  return rows.map((row) => row.id);
}
