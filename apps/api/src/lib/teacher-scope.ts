import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "./types";
import type { AuthUser } from "./context";
import { classes, sections, classSubjects, enrolments, studentGuardians, students, employees, users } from "../db/schema";
import { forbidden, notFound } from "./errors";

export function isUnrestrictedAdmin(user: AuthUser) {
  return user.isPlatformAdmin || user.roles.some((role) => ["owner", "principal", "administrator"].includes(role));
}

export function isScopedTeacher(user: AuthUser) {
  return !isUnrestrictedAdmin(user) && user.roles.includes("teacher");
}

/** Student records linked to a guardian login. */
export async function guardianStudentIds(db: DB, orgId: string, guardianIds?: string[] | null) {
  if (!guardianIds?.length) return [];
  const rows = await db.select({ id: studentGuardians.studentId }).from(studentGuardians).where(and(eq(studentGuardians.organisationId, orgId), inArray(studentGuardians.guardianId, guardianIds)));
  return rows.map((row) => row.id);
}

/**
 * Student ids a learner or guardian login is limited to.
 * Returns null for staff, who keep the existing role-based scoping.
 */
export async function learnerStudentIds(db: DB, orgId: string, user?: AuthUser | null): Promise<string[] | null> {
  if (!user) return null;
  if (user.studentId) return [user.studentId];
  if (user.roles.some((role) => role === "parent" || role === "guardian")) return guardianStudentIds(db, orgId, user.guardianIds);
  return null;
}

/** A safe `id in (?, ?, ...)` fragment for a known list of ids. */
export function idList(ids: string[]) {
  return sql.join(ids.map((id) => sql`${id}`), sql`, `);
}

/** Adds class/section assignment filtering while leaving students and parents unchanged. */
export function teacherScope(user: AuthUser, classColumn: SQL, sectionColumn: SQL, subjectColumn?: SQL): SQL | undefined {
  if (!isScopedTeacher(user)) return undefined;
  if (!user.employeeId) return sql`false`;
  const subjectAssignment = subjectColumn
    ? sql`exists (select 1 from class_subjects scope_subject where scope_subject.class_id = ${classColumn} and scope_subject.subject_id = ${subjectColumn} and scope_subject.teacher_id = ${user.employeeId})`
    : sql`exists (select 1 from class_subjects scope_subject where scope_subject.class_id = ${classColumn} and scope_subject.teacher_id = ${user.employeeId})`;
  if (subjectColumn) return subjectAssignment;
  return sql`(exists (select 1 from classes scope_class where scope_class.id = ${classColumn} and scope_class.class_teacher_id = ${user.employeeId}) or exists (select 1 from sections scope_section where scope_section.id = ${sectionColumn} and scope_section.class_teacher_id = ${user.employeeId}) or ${subjectAssignment})`;
}

export async function assertAssigned(db: DB, user: AuthUser, orgId: string, classId: string, sectionId?: string | null) {
  if (!isScopedTeacher(user)) return;
  if (!user.employeeId) throw forbidden("Teacher account is not linked to an employee");
  const rows = await db.select({ classTeacherId: classes.classTeacherId, sectionTeacherId: sections.classTeacherId })
    .from(classes)
    .leftJoin(sections, sectionId ? and(eq(sections.id, sectionId), eq(sections.classId, classes.id)) : sql`false`)
    .where(and(eq(classes.id, classId), eq(classes.organisationId, orgId)))
    .limit(1);
  const row = rows[0];
  const [subject] = await db.select({ id: classSubjects.id }).from(classSubjects).where(and(eq(classSubjects.organisationId, orgId), eq(classSubjects.classId, classId), eq(classSubjects.teacherId, user.employeeId))).limit(1);
  if (!row || (row.classTeacherId !== user.employeeId && row.sectionTeacherId !== user.employeeId && !subject)) throw forbidden("You are not assigned to this class or section");
}

export async function assertClassSubjectAssigned(db: DB, user: AuthUser, orgId: string, classId: string, subjectId: string) {
  if (!isScopedTeacher(user)) return;
  if (!user.employeeId) throw forbidden("Teacher account is not linked to an employee");
  const [row] = await db.select({ id: classSubjects.id }).from(classSubjects).where(and(eq(classSubjects.organisationId, orgId), eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId), eq(classSubjects.teacherId, user.employeeId))).limit(1);
  if (!row) throw forbidden("You are not assigned to this class and subject");
}

export async function assertStudentAssigned(db: DB, user: AuthUser, orgId: string, studentId: string) {
  if (!isScopedTeacher(user)) return;
  const rows = await db.select({ classId: enrolments.classId, sectionId: enrolments.sectionId })
    .from(enrolments).where(and(eq(enrolments.studentId, studentId), eq(enrolments.organisationId, orgId)));
  for (const row of rows) {
    try { await assertAssigned(db, user, orgId, row.classId, row.sectionId); return; } catch { /* check the student's other enrolments */ }
  }
  throw notFound("Student not found");
}

export async function assertTeacherAccount(db: DB, orgId: string, employeeId: string | null | undefined) {
  if (!employeeId) return;
  const [row] = await db.select({ id: users.id }).from(users)
    .innerJoin(employees, eq(users.employeeId, employees.id))
    .where(and(eq(users.organisationId, orgId), eq(users.employeeId, employeeId), eq(employees.organisationId, orgId), eq(employees.status, "active")))
    .limit(1);
  if (!row) throw forbidden("Assigned teacher must be an active employee-linked user");
}
