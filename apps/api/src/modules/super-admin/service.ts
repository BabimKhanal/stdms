import { and, count, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { featureFlags, organisations, students, users } from "../../db/schema";
import { notFound } from "../../lib/errors";
export async function listOrganisations(db: DB) { return db.select().from(organisations).orderBy(organisations.createdAt); }
export async function saveOrganisation(db: DB, id: string | undefined, input: typeof organisations.$inferInsert) { const row = id ? (await db.update(organisations).set(input).where(eq(organisations.id, id)).returning())[0] : (await db.insert(organisations).values(input).returning())[0]; if (!row) throw notFound("Organisation not found"); return row; }
export async function listFlags(db: DB, orgId: string) { return db.select().from(featureFlags).where(eq(featureFlags.organisationId, orgId)); }
export async function saveFlag(db: DB, orgId: string, flag: string, enabled: boolean) { const [row] = await db.insert(featureFlags).values({ organisationId: orgId, flag, enabled }).onConflictDoUpdate({ target: [featureFlags.organisationId, featureFlags.flag], set: { enabled } }).returning(); return row; }
export async function stats(db: DB) { const [[orgs], [userCount], [studentCount]] = await Promise.all([db.select({ count: count() }).from(organisations), db.select({ count: count() }).from(users), db.select({ count: count() }).from(students)]); return { organisations: Number(orgs.count), users: Number(userCount.count), students: Number(studentCount.count) }; }
