import { and, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import type { AuthUser } from "../../lib/context";
import { classSubjects, sections } from "../../db/schema";
import { assertAssigned, assertStudentAssigned, isScopedTeacher, learnerStudentIds } from "../../lib/teacher-scope";
import { resultRows } from "./service";

export async function scopedResultRows(db: DB, orgId: string, examId: string, classId: string | undefined, sectionId: string | undefined, studentId: string | null | undefined, canViewDraft: boolean, principal: AuthUser) {
  // Learners and guardians only ever see their own children's rows.
  const learnerIds = await learnerStudentIds(db, orgId, principal);
  if (learnerIds) {
    if (studentId && !learnerIds.includes(studentId)) return [];
    const targets = studentId ? [studentId] : learnerIds;
    if (!targets.length) return [];
    const rows = await Promise.all(targets.map((target) => resultRows(db, orgId, examId, classId, sectionId, target, canViewDraft)));
    return [...new Map(rows.flat().map((row) => [row.studentId, row])).values()];
  }
  if (!isScopedTeacher(principal)) return resultRows(db, orgId, examId, classId, sectionId, studentId, canViewDraft);
  if (studentId) await assertStudentAssigned(db, principal, orgId, studentId);
  if (classId) await assertAssigned(db, principal, orgId, classId, sectionId);
  if (classId || sectionId || studentId) return resultRows(db, orgId, examId, classId, sectionId, studentId, canViewDraft);
  const assignedClasses = await db.select({ classId: classSubjects.classId }).from(classSubjects).where(and(eq(classSubjects.organisationId, orgId), eq(classSubjects.teacherId, principal.employeeId!)));
  const assignedSections = await db.select({ classId: sections.classId, sectionId: sections.id }).from(sections).where(and(eq(sections.organisationId, orgId), eq(sections.classTeacherId, principal.employeeId!)));
  const rows = await Promise.all([
    ...assignedClasses.map((row) => resultRows(db, orgId, examId, row.classId, undefined, undefined, canViewDraft)),
    ...assignedSections.map((row) => resultRows(db, orgId, examId, row.classId, row.sectionId, undefined, canViewDraft)),
  ]);
  return [...new Map(rows.flat().map((row) => [row.studentId, row])).values()];
}
