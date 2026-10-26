import { and, desc, eq, isNull } from "drizzle-orm";
import { notifications, users } from "../../db/schema";
import type { DB } from "../../db/client";

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
  return rows;
}

export async function organisationUserIds(db: DB, orgId: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.organisationId, orgId));
  return rows.map((row) => row.id);
}
