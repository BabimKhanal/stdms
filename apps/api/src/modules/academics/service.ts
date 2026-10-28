import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  academicYears,
  classes,
  classSubjects,
  employees,
  enrolments,
  sections,
  subjects,
  terms,
  timetablePeriods,
  timetableSlots,
} from "../../db/schema";
import type {
  AcademicYearInput,
  ClassInput,
  ClassSubjectInput,
  SectionInput,
  SubjectInput,
  TermInput,
  TimetablePeriodInput,
  TimetableSlotInput,
} from "@edu/shared";
import { conflict, notFound } from "../../lib/errors";
import { assertAssigned, assertClassSubjectAssigned, assertTeacherAccount, learnerStudentIds } from "../../lib/teacher-scope";
import type { AuthUser } from "../../lib/context";
import { teacherScope } from "../../lib/teacher-scope";

/** Every service takes (db, orgId, ...) and filters by orgId explicitly —
 * the database RLS policy is the second layer, not the first. */

export async function listYears(db: DB, orgId: string) {
  return db
    .select()
    .from(academicYears)
    .where(eq(academicYears.organisationId, orgId))
    .orderBy(desc(academicYears.startDate));
}

export async function createYear(db: DB, orgId: string, input: AcademicYearInput) {
  if (input.isCurrent) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.organisationId, orgId));
  }
  const [row] = await db
    .insert(academicYears)
    .values({ organisationId: orgId, ...input })
    .returning();
  return row;
}

export async function updateYear(db: DB, orgId: string, id: string, input: Partial<AcademicYearInput>) {
  if (input.isCurrent) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.organisationId, orgId));
  }
  const [row] = await db
    .update(academicYears)
    .set(input)
    .where(and(eq(academicYears.id, id), eq(academicYears.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Academic year not found");
  return row;
}

export async function deleteYear(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(academicYears)
    .where(and(eq(academicYears.id, id), eq(academicYears.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Academic year not found");
}

/* ------------------------------ Terms ------------------------------ */

export async function listTerms(db: DB, orgId: string, academicYearId?: string) {
  const where = academicYearId
    ? and(eq(terms.organisationId, orgId), eq(terms.academicYearId, academicYearId))
    : eq(terms.organisationId, orgId);
  return db.select().from(terms).where(where).orderBy(asc(terms.startDate));
}

export async function createTerm(db: DB, orgId: string, input: TermInput) {
  const [row] = await db.insert(terms).values({ organisationId: orgId, ...input }).returning();
  return row;
}

export async function deleteTerm(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(terms)
    .where(and(eq(terms.id, id), eq(terms.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Term not found");
}

/* ------------------------------ Classes ------------------------------ */

export async function listClasses(db: DB, orgId: string, academicYearId: string, principal?: AuthUser) {
  return db
    .select({
      id: classes.id,
      name: classes.name,
      numericLevel: classes.numericLevel,
      classTeacherId: classes.classTeacherId,
      classTeacherName: employees.fullName,
      studentCount: sql<number>`(
        SELECT count(*) FROM enrolments e
         WHERE e.class_id = ${classes.id} AND e.academic_year_id = ${academicYearId}
      )`,
      sectionCount: sql<number>`(SELECT count(*) FROM sections s WHERE s.class_id = ${classes.id})`,
    })
    .from(classes)
    .leftJoin(employees, eq(classes.classTeacherId, employees.id))
    .where(and(eq(classes.organisationId, orgId), principal ? teacherScope(principal, sql`${classes.id}`, sql`null`) : undefined))
    .orderBy(asc(classes.numericLevel), asc(classes.name));
}

export async function createClass(db: DB, orgId: string, input: ClassInput) {
  try {
    const [row] = await db
      .insert(classes)
      .values({ organisationId: orgId, ...input })
      .returning();
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw conflict("Class name already exists");
    throw err;
  }
}

export async function updateClass(db: DB, orgId: string, id: string, input: Partial<ClassInput>) {
  await assertTeacherAccount(db, orgId, input.classTeacherId);
  const [row] = await db
    .update(classes)
    .set(input)
    .where(and(eq(classes.id, id), eq(classes.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Class not found");
  return row;
}

export async function deleteClass(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(classes)
    .where(and(eq(classes.id, id), eq(classes.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Class not found");
}

/* ------------------------------ Sections ------------------------------ */

export async function listSections(db: DB, orgId: string, classId?: string, academicYearId?: string, principal?: AuthUser) {
  const conds = [eq(sections.organisationId, orgId)];
  if (classId) conds.push(eq(sections.classId, classId));
  if (principal) { const scope = teacherScope(principal, sql`${sections.classId}`, sql`${sections.id}`); if (scope) conds.push(scope as never); }
  return db
    .select({
      id: sections.id,
      classId: sections.classId,
      name: sections.name,
      classTeacherId: sections.classTeacherId,
      classTeacherName: employees.fullName,
      className: classes.name,
      studentCount: academicYearId
        ? sql<number>`(
            SELECT count(*) FROM enrolments e
             WHERE e.section_id = ${sections.id} AND e.academic_year_id = ${academicYearId}
          )`
        : sql<number>`0`,
    })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .leftJoin(employees, eq(sections.classTeacherId, employees.id))
    .where(and(...conds))
    .orderBy(asc(classes.name), asc(sections.name));
}

export async function createSection(db: DB, orgId: string, input: SectionInput) {
  try {
    const [row] = await db
      .insert(sections)
      .values({ organisationId: orgId, ...input })
      .returning();
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw conflict("Section already exists in this class");
    throw err;
  }
}

export async function updateSection(db: DB, orgId: string, id: string, input: Partial<SectionInput>) {
  await assertTeacherAccount(db, orgId, input.classTeacherId);
  const [row] = await db
    .update(sections)
    .set(input)
    .where(and(eq(sections.id, id), eq(sections.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Section not found");
  return row;
}

export async function deleteSection(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(sections)
    .where(and(eq(sections.id, id), eq(sections.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Section not found");
}

/* ------------------------------ Subjects ------------------------------ */

export async function listSubjects(db: DB, orgId: string) {
  return db
    .select()
    .from(subjects)
    .where(eq(subjects.organisationId, orgId))
    .orderBy(asc(subjects.name));
}

export async function createSubject(db: DB, orgId: string, input: SubjectInput) {
  try {
    const [row] = await db
      .insert(subjects)
      .values({ organisationId: orgId, ...input })
      .returning();
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw conflict("Subject already exists");
    throw err;
  }
}

export async function updateSubject(db: DB, orgId: string, id: string, input: Partial<SubjectInput>) {
  const [row] = await db
    .update(subjects)
    .set(input)
    .where(and(eq(subjects.id, id), eq(subjects.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Subject not found");
  return row;
}

export async function deleteSubject(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Subject not found");
}

/* ------------------------------ Class ↔ Subject ------------------------------ */

export async function listClassSubjects(db: DB, orgId: string, classId?: string) {
  const conds = [eq(classSubjects.organisationId, orgId)];
  if (classId) conds.push(eq(classSubjects.classId, classId));
  return db
    .select({
      id: classSubjects.id,
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      teacherId: classSubjects.teacherId,
      className: classes.name,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      teacherName: employees.fullName,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classSubjects.classId, classes.id))
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .leftJoin(employees, eq(classSubjects.teacherId, employees.id))
    .where(and(...conds))
    .orderBy(asc(classes.name), asc(subjects.name));
}

export async function createClassSubject(db: DB, orgId: string, input: ClassSubjectInput) {
  await assertTeacherAccount(db, orgId, input.teacherId);
  try {
    const [row] = await db
      .insert(classSubjects)
      .values({ organisationId: orgId, ...input })
      .returning();
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw conflict("Subject already assigned to this class");
    throw err;
  }
}

export async function updateClassSubject(db: DB, orgId: string, id: string, input: Partial<ClassSubjectInput>) {
  if (input.teacherId !== undefined) await assertTeacherAccount(db, orgId, input.teacherId);
  const [row] = await db.update(classSubjects).set(input).where(and(eq(classSubjects.id, id), eq(classSubjects.organisationId, orgId))).returning();
  if (!row) throw notFound("Allocation not found");
  return row;
}

export async function deleteClassSubject(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(classSubjects)
    .where(and(eq(classSubjects.id, id), eq(classSubjects.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Allocation not found");
}

/* ------------------------------ Timetable periods ------------------------------ */

export async function listPeriods(db: DB, orgId: string) {
  return db
    .select()
    .from(timetablePeriods)
    .where(eq(timetablePeriods.organisationId, orgId))
    .orderBy(asc(timetablePeriods.orderIndex));
}

export async function createPeriod(db: DB, orgId: string, input: TimetablePeriodInput) {
  const [row] = await db
    .insert(timetablePeriods)
    .values({ organisationId: orgId, ...input })
    .returning();
  return row;
}

export async function updatePeriod(db: DB, orgId: string, id: string, input: Partial<TimetablePeriodInput>) {
  const [row] = await db
    .update(timetablePeriods)
    .set(input)
    .where(and(eq(timetablePeriods.id, id), eq(timetablePeriods.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Period not found");
  return row;
}

export async function deletePeriod(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(timetablePeriods)
    .where(and(eq(timetablePeriods.id, id), eq(timetablePeriods.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Period not found");
}

/* ------------------------------ Timetable slots ------------------------------ */

export async function listSlots(db: DB, orgId: string, principal: AuthUser, sectionId?: string, day?: TimetableSlotInput["day"]) {
  const conditions = [eq(timetableSlots.organisationId, orgId)];
  if (sectionId) conditions.push(eq(timetableSlots.sectionId, sectionId));
  if (day) conditions.push(eq(timetableSlots.day, day));
  const scope = teacherScope(principal, sql`${sections.classId}`, sql`${timetableSlots.sectionId}`, sql`${timetableSlots.subjectId}`);
  if (scope) conditions.push(scope as never);
  const learnerIds = await learnerStudentIds(db, orgId, principal);
  if (learnerIds) {
    if (!learnerIds.length) return [];
    conditions.push(sql`${timetableSlots.sectionId} in (select e.section_id from enrolments e where e.organisation_id = ${orgId} and e.student_id in (${sql.join(learnerIds.map((id) => sql`${id}`), sql`, `)}))`);
  }
  return db
    .select({
      id: timetableSlots.id,
      sectionId: timetableSlots.sectionId,
      day: timetableSlots.day,
      periodId: timetableSlots.periodId,
      subjectId: timetableSlots.subjectId,
      teacherId: timetableSlots.teacherId,
      room: timetableSlots.room,
      subjectName: subjects.name,
      teacherName: employees.fullName,
      periodName: timetablePeriods.name,
      startTime: timetablePeriods.startTime,
      endTime: timetablePeriods.endTime,
      sectionName: sections.name,
      className: classes.name,
    })
    .from(timetableSlots)
    .innerJoin(sections, eq(timetableSlots.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
    .innerJoin(timetablePeriods, eq(timetableSlots.periodId, timetablePeriods.id))
    .leftJoin(employees, eq(timetableSlots.teacherId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(timetableSlots.day), asc(timetablePeriods.orderIndex), asc(classes.name), asc(sections.name));
}

async function assertSlotReferences(db: DB, orgId: string, input: TimetableSlotInput) {
  const [section] = await db.select({ classId: sections.classId }).from(sections).where(and(eq(sections.id, input.sectionId), eq(sections.organisationId, orgId))).limit(1);
  if (!section) throw notFound("Section not found");
  const [period] = await db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(eq(timetablePeriods.id, input.periodId), eq(timetablePeriods.organisationId, orgId))).limit(1);
  if (!period) throw notFound("Timetable period not found");
  const [allocation] = await db.select({ id: classSubjects.id }).from(classSubjects).where(and(eq(classSubjects.organisationId, orgId), eq(classSubjects.classId, section.classId), eq(classSubjects.subjectId, input.subjectId))).limit(1);
  if (!allocation) throw conflict("Subject is not assigned to this class");
  await assertTeacherAccount(db, orgId, input.teacherId);
  return section.classId;
}

async function assertSlotConflicts(db: DB, orgId: string, input: TimetableSlotInput, id?: string) {
  const sameSlot = [
    eq(timetableSlots.organisationId, orgId),
    eq(timetableSlots.sectionId, input.sectionId),
    eq(timetableSlots.day, input.day),
    eq(timetableSlots.periodId, input.periodId),
  ];
  const conflictRows = await db.select({ id: timetableSlots.id, sectionId: timetableSlots.sectionId, teacherId: timetableSlots.teacherId, room: timetableSlots.room }).from(timetableSlots).where(and(...sameSlot, id ? sql`${timetableSlots.id} <> ${id}` : undefined)).limit(1);
  if (conflictRows.length) throw conflict("This section already has a timetable entry in that period");

  const resources = [];
  if (input.teacherId) resources.push(eq(timetableSlots.teacherId, input.teacherId));
  if (input.room) resources.push(eq(timetableSlots.room, input.room));
  if (!resources.length) return;
  const resourceConflict = await db.select({ id: timetableSlots.id }).from(timetableSlots).where(and(
    eq(timetableSlots.organisationId, orgId),
    eq(timetableSlots.day, input.day),
    eq(timetableSlots.periodId, input.periodId),
    or(...resources),
    id ? sql`${timetableSlots.id} <> ${id}` : undefined,
  )).limit(1);
  if (resourceConflict.length) throw conflict(input.teacherId ? "Teacher or room is already booked in that period" : "Room is already booked in that period");
}

export async function createSlot(db: DB, orgId: string, principal: AuthUser, input: TimetableSlotInput) {
  const classId = await assertSlotReferences(db, orgId, input);
  await assertAssigned(db, principal, orgId, classId, input.sectionId);
  await assertClassSubjectAssigned(db, principal, orgId, classId, input.subjectId);
  await assertSlotConflicts(db, orgId, input);
  const [row] = await db.insert(timetableSlots).values({ organisationId: orgId, ...input }).returning();
  return row;
}

export async function updateSlot(db: DB, orgId: string, principal: AuthUser, id: string, input: Partial<TimetableSlotInput>) {
  const [existing] = await db.select().from(timetableSlots).where(and(eq(timetableSlots.id, id), eq(timetableSlots.organisationId, orgId))).limit(1);
  if (!existing) throw notFound("Timetable slot not found");
  const next = { ...existing, ...input } as TimetableSlotInput;
  const classId = await assertSlotReferences(db, orgId, next);
  await assertAssigned(db, principal, orgId, classId, next.sectionId);
  await assertClassSubjectAssigned(db, principal, orgId, classId, next.subjectId);
  await assertSlotConflicts(db, orgId, next, id);
  const [row] = await db.update(timetableSlots).set(input).where(and(eq(timetableSlots.id, id), eq(timetableSlots.organisationId, orgId))).returning();
  return row;
}

export async function deleteSlot(db: DB, orgId: string, principal: AuthUser, id: string) {
  const [existing] = await db.select().from(timetableSlots).where(and(eq(timetableSlots.id, id), eq(timetableSlots.organisationId, orgId))).limit(1);
  if (!existing) throw notFound("Timetable slot not found");
  await assertAssigned(db, principal, orgId, existing.sectionId);
  await db.delete(timetableSlots).where(and(eq(timetableSlots.id, id), eq(timetableSlots.organisationId, orgId)));
}

/** Helper reused by several modules: current academic year of the tenant. */
export async function getCurrentYearId(db: DB, orgId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.organisationId, orgId), eq(academicYears.isCurrent, true)))
    .limit(1);
  return row?.id ?? null;
}
