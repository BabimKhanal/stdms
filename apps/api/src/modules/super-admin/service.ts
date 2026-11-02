import { count, desc, eq, isNotNull } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  featureFlags,
  organisations,
  platformAuditLogs,
  students,
  users,
} from "../../db/schema";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { ensureDefaultEmailTemplates } from "../organisation/service";
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
