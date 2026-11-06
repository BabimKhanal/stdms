import "dotenv/config";
import { eq } from "drizzle-orm";
import { DEFAULT_ROLES } from "@edu/shared";
import { makeDb, ownerPool } from "../src/db/client";
import * as t from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const db = makeDb(ownerPool);

async function main() {
  const existing = await db.select({ id: t.organisations.id }).from(t.organisations).where(eq(t.organisations.slug, "integration-academy")).limit(1);
  if (existing[0]) await db.delete(t.organisations).where(eq(t.organisations.id, existing[0].id));

  const [organisation] = await db.insert(t.organisations).values({ name: "Integration Academy", slug: "integration-academy", status: "active" }).returning();
  const [year] = await db.insert(t.academicYears).values({ organisationId: organisation.id, name: "2026/27", startDate: "2026-04-14", endDate: "2027-04-13", isCurrent: true }).returning();
  await db.update(t.organisations).set({ currentAcademicYearId: year.id }).where(eq(t.organisations.id, organisation.id));
  const [studentClass] = await db.insert(t.classes).values({ organisationId: organisation.id, name: "Grade 5", numericLevel: 5 }).returning();
  const [section] = await db.insert(t.sections).values({ organisationId: organisation.id, classId: studentClass.id, name: "A" }).returning();
  const [student] = await db.insert(t.students).values({ organisationId: organisation.id, studentId: "INT-ST-001", admissionNumber: "INT-ADM-001", firstName: "Integration", lastName: "Student", gender: "other", status: "active" }).returning();
  await db.insert(t.enrolments).values({ organisationId: organisation.id, studentId: student.id, academicYearId: year.id, classId: studentClass.id, sectionId: section.id, rollNumber: 1 });

  const [ownerRole] = await db.insert(t.roles).values({ organisationId: organisation.id, key: "owner", name: DEFAULT_ROLES.owner.name, description: DEFAULT_ROLES.owner.description, isSystem: true }).returning();
  const allPermissions = await db.select().from(t.permissions);
  await db.insert(t.rolePermissions).values(allPermissions.map((permission) => ({ roleId: ownerRole.id, permissionId: permission.id })));
  const [owner] = await db.insert(t.users).values({ organisationId: organisation.id, name: "Integration Owner", email: "owner@integration.test", username: "integration-owner", passwordHash: await hashPassword("Integration@123") }).returning();
  await db.insert(t.userRoles).values({ userId: owner.id, roleId: ownerRole.id });
  console.log("✓ integration tenant seeded");
}

main().then(() => ownerPool.end()).catch(async (error) => { console.error(error); await ownerPool.end(); process.exit(1); });