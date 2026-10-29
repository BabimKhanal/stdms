import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  classSubjects,
  classes,
  enrolments,
  examSubjects,
  exams,
  gradingScaleBands,
  gradingScales,
  marks,
  organisations,
  sections,
  studentGuardians,
  students,
  subjects,
  users,
} from "../../db/schema";
import type { GradingScaleInput, MarkEntryInput } from "@edu/shared";
import { z } from "zod";
import { examInputSchema, examSubjectInputSchema } from "@edu/shared";
type ExamInput = z.infer<typeof examInputSchema>;
type ExamSubjectInput = z.infer<typeof examSubjectInputSchema>;
import { conflict, forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../lib/context";
import {
  assertAssigned,
  assertClassSubjectAssigned,
  idList,
  isScopedTeacher,
  learnerStudentIds,
  teacherScope,
} from "../../lib/teacher-scope";
import { createForUsers } from "../notifications/service";
import { publishNotification } from "../notifications/socket";
import { loadGradingScale, resolveBand, round2 } from "./grading";

const tenant = (table: { organisationId: any }, orgId: string) =>
  eq(table.organisationId, orgId);

export async function listExams(db: DB, orgId: string, principal?: AuthUser) {
  const learnerIds = principal
    ? await learnerStudentIds(db, orgId, principal)
    : null;
  const scope =
    principal && isScopedTeacher(principal)
      ? sql`exists (select 1 from exam_subjects scoped_es join class_subjects scoped_cs on scoped_cs.class_id = scoped_es.class_id and scoped_cs.subject_id = scoped_es.subject_id where scoped_es.exam_id = ${exams.id} and scoped_es.organisation_id = ${orgId} and scoped_cs.teacher_id = ${principal.employeeId})`
      : undefined;
  const learnerScope = learnerIds
    ? learnerIds.length
      ? sql`${exams.status} = 'published' and exists (select 1 from exam_subjects es join enrolments e on e.class_id = es.class_id and e.organisation_id = es.organisation_id where es.exam_id = ${exams.id} and es.organisation_id = ${orgId} and e.student_id in (${idList(learnerIds)}))`
      : sql`false`
    : undefined;
  const conditions = learnerIds
    ? [tenant(exams, orgId), learnerScope]
    : [tenant(exams, orgId), scope];
  return db
    .select({
      ...(exams as any),
      subjectCount: sql<number>`(select count(*) from exam_subjects es where es.exam_id = ${exams.id} and es.organisation_id = ${orgId})`,
    })
    .from(exams)
    .where(and(...conditions))
    .orderBy(asc(exams.startDate));
}

export async function createExam(db: DB, orgId: string, input: ExamInput) {
  const [row] = await db
    .insert(exams)
    .values({
      ...input,
      organisationId: orgId,
      termId: input.termId ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    })
    .returning();
  return row;
}

export async function updateExam(
  db: DB,
  orgId: string,
  id: string,
  input: Partial<ExamInput>,
) {
  const [existing] = await db
    .select({ status: exams.status })
    .from(exams)
    .where(and(eq(exams.id, id), tenant(exams, orgId)))
    .limit(1);
  if (!existing) throw notFound("Exam not found");
  if (
    existing.status === "published" &&
    input.status &&
    input.status !== "published"
  )
    throw conflict("Published results cannot be reverted");
  const [row] = await db
    .update(exams)
    .set(input)
    .where(and(eq(exams.id, id), tenant(exams, orgId)))
    .returning();
  if (!row) throw notFound("Exam not found");
  return row;
}

export async function deleteExam(db: DB, orgId: string, id: string) {
  const [existing] = await db
    .select({ status: exams.status })
    .from(exams)
    .where(and(eq(exams.id, id), tenant(exams, orgId)))
    .limit(1);
  if (!existing) throw notFound("Exam not found");
  if (existing.status === "published")
    throw conflict("Published results cannot be deleted");
  await db.delete(exams).where(and(eq(exams.id, id), tenant(exams, orgId)));
}

export async function listExamSubjects(
  db: DB,
  orgId: string,
  examId: string,
  principal?: AuthUser,
) {
  const scope = principal
    ? teacherScope(
        principal,
        sql`${examSubjects.classId}`,
        sql`null`,
        sql`${examSubjects.subjectId}`,
      )
    : undefined;
  return db
    .select({
      ...(examSubjects as any),
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(examSubjects)
    .innerJoin(classes, eq(examSubjects.classId, classes.id))
    .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
    .where(
      and(eq(examSubjects.examId, examId), tenant(examSubjects, orgId), scope),
    );
}

export async function addExamSubject(
  db: DB,
  orgId: string,
  examId: string,
  input: ExamSubjectInput,
  principal?: AuthUser,
) {
  if (principal) await assertAssigned(db, principal, orgId, input.classId);
  try {
    const [row] = await db
      .insert(examSubjects)
      .values({ ...input, examId, organisationId: orgId })
      .returning();
    return row;
  } catch (e) {
    if ((e as any).code === "23505")
      throw conflict("Subject already assigned to exam class");
    throw e;
  }
}

export async function deleteExamSubject(
  db: DB,
  orgId: string,
  id: string,
  principal?: AuthUser,
) {
  if (principal) {
    const [row] = await db
      .select({
        classId: examSubjects.classId,
        subjectId: examSubjects.subjectId,
      })
      .from(examSubjects)
      .where(and(eq(examSubjects.id, id), tenant(examSubjects, orgId)))
      .limit(1);
    if (!row) throw notFound("Exam subject not found");
    await assertClassSubjectAssigned(
      db,
      principal,
      orgId,
      row.classId,
      row.subjectId,
    );
  }
  const rows = await db
    .delete(examSubjects)
    .where(and(eq(examSubjects.id, id), tenant(examSubjects, orgId)))
    .returning();
  if (!rows.length) throw notFound("Exam subject not found");
}

export async function saveMarks(
  db: DB,
  orgId: string,
  userId: string,
  input: MarkEntryInput,
  principal?: AuthUser,
) {
  const [examState] = await db
    .select({ status: exams.status })
    .from(examSubjects)
    .innerJoin(exams, eq(examSubjects.examId, exams.id))
    .where(
      and(
        eq(examSubjects.id, input.examSubjectId),
        tenant(examSubjects, orgId),
        tenant(exams, orgId),
      ),
    )
    .limit(1);
  if (!examState) throw notFound("Exam subject not found");
  if (examState.status === "completed" || examState.status === "published")
    throw conflict("This examination is locked for mark changes");
  if (principal) {
    const [row] = await db
      .select({
        classId: examSubjects.classId,
        subjectId: examSubjects.subjectId,
      })
      .from(examSubjects)
      .where(
        and(
          eq(examSubjects.id, input.examSubjectId),
          tenant(examSubjects, orgId),
        ),
      )
      .limit(1);
    if (!row) throw notFound("Exam subject not found");
    await assertClassSubjectAssigned(
      db,
      principal,
      orgId,
      row.classId,
      row.subjectId,
    );
  }
  return db.transaction(async (tx) => {
    for (const entry of input.marks) {
      await tx
        .insert(marks)
        .values({
          organisationId: orgId,
          examSubjectId: input.examSubjectId,
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          isAbsent: entry.marksObtained === null,
          remarks: entry.remarks ?? null,
          enteredBy: userId,
        })
        .onConflictDoUpdate({
          target: [marks.examSubjectId, marks.studentId],
          set: {
            marksObtained: entry.marksObtained,
            isAbsent: entry.marksObtained === null,
            remarks: entry.remarks ?? null,
            enteredBy: userId,
          },
        });
    }
    return input.marks.length;
  });
}

export async function approveExam(db: DB, orgId: string, examId: string) {
  const [exam] = await db
    .select({ id: exams.id, status: exams.status })
    .from(exams)
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .limit(1);
  if (!exam) throw notFound("Examination not found");
  if (exam.status === "published")
    throw conflict("Published examination results are already locked");
  if (exam.status === "completed") return exam;
  const [subject] = await db
    .select({ id: examSubjects.id })
    .from(examSubjects)
    .where(and(eq(examSubjects.examId, examId), tenant(examSubjects, orgId)))
    .limit(1);
  if (!subject) throw conflict("Add at least one subject before approving");
  const [updated] = await db
    .update(exams)
    .set({ status: "completed" })
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .returning();
  return updated;
}

export async function listMarks(
  db: DB,
  orgId: string,
  examSubjectId: string,
  principal?: AuthUser,
) {
  if (principal) {
    const [row] = await db
      .select({
        classId: examSubjects.classId,
        subjectId: examSubjects.subjectId,
      })
      .from(examSubjects)
      .where(
        and(eq(examSubjects.id, examSubjectId), tenant(examSubjects, orgId)),
      )
      .limit(1);
    if (!row) throw notFound("Exam subject not found");
    await assertClassSubjectAssigned(
      db,
      principal,
      orgId,
      row.classId,
      row.subjectId,
    );
  }
  const learnerIds = principal
    ? await learnerStudentIds(db, orgId, principal)
    : null;
  const conditions = [
    eq(marks.examSubjectId, examSubjectId),
    tenant(marks, orgId),
  ];
  if (learnerIds)
    conditions.push(
      learnerIds.length ? inArray(marks.studentId, learnerIds) : sql`false`,
    );
  return db
    .select({
      ...(marks as any),
      studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`,
    })
    .from(marks)
    .innerJoin(students, eq(marks.studentId, students.id))
    .where(and(...conditions));
}

type ResultRowInternal = {
  studentId: string;
  studentName: string;
  rollNumber: number | null;
  className: string | null;
  sectionName: string | null;
  subjects: Array<{
    examSubjectId: string;
    subjectName: string;
    creditHours: number | null;
    fullMarks: number;
    passMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    grade: string | null;
    gpa: number | null;
    passed: boolean;
  }>;
  totalObtained: number;
  totalFull: number;
  percentage: number;
  gpa: number | null;
  grade: string | null;
  rank: number | null;
  sectionRank: number | null;
  passed: boolean;
  _classId: string;
  _sectionId: string | null;
};

/**
 * Builds per-student result rows for an exam.
 *
 * - Grades and GPA come from the tenant's default grading scale (bands are
 *   matched against the subject percentage and the overall percentage).
 * - Ranks are competition ranks inside the class and, when a section exists,
 *   inside that section, so a learner's own row can still show a rank.
 * - Only students enrolled in the exam's academic year are included.
 */
export async function resultRows(
  db: DB,
  orgId: string,
  examId: string,
  classId?: string,
  sectionId?: string,
  studentId?: string | null,
  canViewDraft = false,
): Promise<Array<Omit<ResultRowInternal, "_classId" | "_sectionId">>> {
  const [exam] = await db
    .select({ status: exams.status, academicYearId: exams.academicYearId })
    .from(exams)
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .limit(1);
  if (!exam) throw notFound("Examination not found");
  if (!canViewDraft && exam.status !== "published") return [];

  const scale = await loadGradingScale(db, orgId);

  const subjectConditions = [
    eq(examSubjects.examId, examId),
    tenant(examSubjects, orgId),
  ];
  if (classId) subjectConditions.push(eq(examSubjects.classId, classId));
  const subjectsRows = await db
    .select({
      es: examSubjects,
      subjectName: subjects.name,
      creditHours: subjects.creditHours,
    })
    .from(examSubjects)
    .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
    .where(and(...subjectConditions));

  const enrolmentConditions = [
    tenant(enrolments, orgId),
    eq(enrolments.academicYearId, exam.academicYearId),
  ];
  if (classId) enrolmentConditions.push(eq(enrolments.classId, classId));
  if (sectionId) enrolmentConditions.push(eq(enrolments.sectionId, sectionId));

  // A learner/guardian asks for one student. Load that student's classmates so
  // ranks are calculated against real peers, never against a single row.
  if (studentId && !classId) {
    const own = await db
      .select({ classId: enrolments.classId, sectionId: enrolments.sectionId })
      .from(enrolments)
      .where(
        and(
          tenant(enrolments, orgId),
          eq(enrolments.studentId, studentId),
          eq(enrolments.academicYearId, exam.academicYearId),
        ),
      );
    if (!own.length) return [];
    const pairs = own.map((row) =>
      row.sectionId
        ? and(
            eq(enrolments.classId, row.classId),
            eq(enrolments.sectionId, row.sectionId),
          )
        : eq(enrolments.classId, row.classId),
    );
    const pairFilter = or(...pairs);
    if (pairFilter) enrolmentConditions.push(pairFilter);
  }

  const enrolmentRows = await db
    .select({
      student: students,
      enrolment: enrolments,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(enrolments)
    .innerJoin(students, eq(enrolments.studentId, students.id))
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .leftJoin(sections, eq(enrolments.sectionId, sections.id))
    .where(and(...enrolmentConditions));

  const examSubjectIds = subjectsRows.map((row) => row.es.id);
  const markRows = examSubjectIds.length
    ? await db
        .select()
        .from(marks)
        .where(
          and(
            tenant(marks, orgId),
            inArray(marks.examSubjectId, examSubjectIds),
          ),
        )
    : [];

  const rows: ResultRowInternal[] = enrolmentRows.map(
    ({ student, enrolment, className, sectionName }) => {
      const own = subjectsRows
        .filter(({ es }) => es.classId === enrolment.classId)
        .map(({ es, subjectName, creditHours }) => {
          const mark = markRows.find(
            (item) =>
              item.examSubjectId === es.id && item.studentId === student.id,
          );
          const isAbsent = mark?.isAbsent ?? false;
          const marksObtained = mark?.marksObtained ?? null;
          const percentage =
            marksObtained !== null && !isAbsent && es.fullMarks > 0
              ? round2((marksObtained * 100) / es.fullMarks)
              : null;
          const band = resolveBand(percentage, scale?.bands ?? []);
          return {
            examSubjectId: es.id,
            subjectName,
            creditHours,
            fullMarks: es.fullMarks,
            passMarks: es.passMarks,
            marksObtained,
            isAbsent,
            grade: band?.grade ?? null,
            gpa: band ? band.gpa : null,
            passed:
              marksObtained !== null &&
              !isAbsent &&
              marksObtained >= es.passMarks,
          };
        });

      const totalFull = own.reduce(
        (total, subject) => total + subject.fullMarks,
        0,
      );
      const totalObtained = own.reduce(
        (total, subject) => total + (subject.marksObtained ?? 0),
        0,
      );
      const percentage = totalFull
        ? round2((totalObtained * 100) / totalFull)
        : 0;
      const overallBand = resolveBand(percentage, scale?.bands ?? []);
      const graded = own.filter((subject) => subject.gpa !== null);
      const gpaCredits = graded.reduce(
        (total, subject) => total + (subject.creditHours ?? 1),
        0,
      );
      const gpa = graded.length
        ? round2(
            graded.reduce(
              (total, subject) =>
                total + (subject.gpa ?? 0) * (subject.creditHours ?? 1),
              0,
            ) / gpaCredits,
          )
        : (overallBand?.gpa ?? null);

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        rollNumber: enrolment.rollNumber,
        className,
        sectionName,
        subjects: own,
        totalObtained,
        totalFull,
        percentage,
        gpa,
        grade: overallBand?.grade ?? null,
        rank: null,
        sectionRank: null,
        passed: own.length > 0 && own.every((subject) => subject.passed),
        _classId: enrolment.classId,
        _sectionId: enrolment.sectionId,
      };
    },
  );

  assignRanks(rows, (row) => row._classId, "rank");
  assignRanks(
    rows,
    (row) => `${row._classId}:${row._sectionId ?? ""}`,
    "sectionRank",
  );
  for (const row of rows) if (!row._sectionId) row.sectionRank = null;

  const visible = studentId
    ? rows.filter((row) => row.studentId === studentId)
    : rows;
  return visible.map(({ _classId, _sectionId, ...row }) => row);
}

export async function transcriptRows(
  db: DB,
  orgId: string,
  studentId: string,
  academicYearId?: string,
) {
  const conditions = [
    tenant(exams, orgId),
    eq(exams.status, "published" as never),
  ];
  if (academicYearId) conditions.push(eq(exams.academicYearId, academicYearId));
  const published = await db
    .select({
      id: exams.id,
      name: exams.name,
      academicYearId: exams.academicYearId,
    })
    .from(exams)
    .where(and(...conditions))
    .orderBy(asc(exams.startDate), asc(exams.createdAt));
  const records = [] as Array<{
    examId: string;
    examName: string;
    academicYearId: string;
    percentage: number;
    gpa: number | null;
    grade: string | null;
    rank: number | null;
    passed: boolean;
    subjects: ResultRowInternal["subjects"];
  }>;
  for (const exam of published) {
    const [row] = await resultRows(
      db,
      orgId,
      exam.id,
      undefined,
      undefined,
      studentId,
      false,
    );
    if (row)
      records.push({
        examId: exam.id,
        examName: exam.name,
        academicYearId: exam.academicYearId,
        percentage: row.percentage,
        gpa: row.gpa,
        grade: row.grade,
        rank: row.rank,
        passed: row.passed,
        subjects: row.subjects,
      });
  }
  const gradedSubjects = records.flatMap((record) =>
    record.subjects.filter((subject) => subject.gpa !== null),
  );
  const credits = gradedSubjects.reduce(
    (total, subject) => total + (subject.creditHours ?? 1),
    0,
  );
  const cgpa = credits
    ? round2(
        gradedSubjects.reduce(
          (total, subject) =>
            total + (subject.gpa ?? 0) * (subject.creditHours ?? 1),
          0,
        ) / credits,
      )
    : null;
  return { studentId, cgpa, records };
}

function assignRanks(
  rows: Array<{
    percentage: number;
    rank: number | null;
    sectionRank: number | null;
  }>,
  keyOf: (row: any) => string,
  field: "rank" | "sectionRank",
) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => b.percentage - a.percentage);
    let previous: number | null = null;
    let rank = 0;
    sorted.forEach((row, index) => {
      if (row.percentage !== previous) {
        rank = index + 1;
        previous = row.percentage;
      }
      row[field] = rank;
    });
  }
}

export async function publishExam(
  db: DB,
  orgId: string,
  examId: string,
  principal?: AuthUser,
) {
  const [exam] = await db
    .select({
      id: exams.id,
      name: exams.name,
      status: exams.status,
      academicYearId: exams.academicYearId,
    })
    .from(exams)
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .limit(1);
  if (!exam) throw notFound("Examination not found");
  if (exam.status === "published") return exam;
  if (exam.status !== "completed")
    throw conflict(
      "Approve and lock the examination before publishing results",
    );

  if (principal && isScopedTeacher(principal)) {
    if (!principal.employeeId)
      throw forbidden("Teacher account is not linked to an employee");
    const [assigned] = await db
      .select({ id: examSubjects.id })
      .from(examSubjects)
      .innerJoin(
        classSubjects,
        and(
          eq(classSubjects.organisationId, orgId),
          eq(classSubjects.classId, examSubjects.classId),
          eq(classSubjects.subjectId, examSubjects.subjectId),
          eq(classSubjects.teacherId, principal.employeeId),
        ),
      )
      .where(and(eq(examSubjects.examId, examId), tenant(examSubjects, orgId)))
      .limit(1);
    if (!assigned) throw forbidden("You are not assigned to this examination");
  }

  const classRows = await db
    .select({ classId: examSubjects.classId })
    .from(examSubjects)
    .where(and(eq(examSubjects.examId, examId), tenant(examSubjects, orgId)));
  if (!classRows.length)
    throw conflict("Add at least one subject before publishing");

  const [updated] = await db
    .update(exams)
    .set({ status: "published" })
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .returning();
  if (!updated) throw notFound("Examination not found");

  const classIds = [...new Set(classRows.map((row) => row.classId))];

  if (classIds.length) {
    const studentRows = await db
      .select({ id: enrolments.studentId })
      .from(enrolments)
      .where(
        and(
          tenant(enrolments, orgId),
          eq(enrolments.academicYearId, exam.academicYearId),
          inArray(enrolments.classId, classIds),
        ),
      );
    const studentIds = [...new Set(studentRows.map((row) => row.id))];
    const guardianRows = studentIds.length
      ? await db
          .select({ id: studentGuardians.guardianId })
          .from(studentGuardians)
          .where(
            and(
              tenant(studentGuardians, orgId),
              inArray(studentGuardians.studentId, studentIds),
            ),
          )
      : [];
    const guardianIds = [...new Set(guardianRows.map((row) => row.id))];

    if (studentIds.length || guardianIds.length) {
      const recipientRows = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            tenant(users, orgId),
            or(
              studentIds.length
                ? inArray(users.studentId, studentIds)
                : undefined,
              guardianIds.length
                ? inArray(users.guardianId, guardianIds)
                : undefined,
            ),
          ),
        );
      const created = await createForUsers(
        db,
        orgId,
        recipientRows.map((row) => row.id),
        {
          type: "exam_published",
          title: "Results published",
          body: `${exam.name} results are now available.`,
          data: { examId, type: "exam_published" },
        },
      );
      created.forEach(publishNotification);
    }
  }

  return updated;
}

export async function reportCardContext(db: DB, orgId: string, examId: string) {
  const [exam] = await db
    .select({
      id: exams.id,
      name: exams.name,
      type: exams.type,
      startDate: exams.startDate,
      endDate: exams.endDate,
      status: exams.status,
    })
    .from(exams)
    .where(and(eq(exams.id, examId), tenant(exams, orgId)))
    .limit(1);
  if (!exam) throw notFound("Examination not found");
  const [organisation] = await db
    .select({
      name: organisations.name,
      address: organisations.address,
      phone: organisations.phone,
      email: organisations.email,
      website: organisations.website,
      primaryColor: organisations.primaryColor,
    })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  return { exam, organisation: organisation ?? null };
}

export async function listScales(db: DB, orgId: string) {
  const rows = await db
    .select()
    .from(gradingScales)
    .where(tenant(gradingScales, orgId));
  const bands = await db
    .select()
    .from(gradingScaleBands)
    .where(tenant(gradingScaleBands, orgId));
  return rows.map((row) => ({
    ...row,
    bands: bands.filter((band) => band.gradingScaleId === row.id),
  }));
}

export async function createScale(
  db: DB,
  orgId: string,
  input: GradingScaleInput,
) {
  return db.transaction(async (tx) => {
    if (input.isDefault)
      await tx
        .update(gradingScales)
        .set({ isDefault: false })
        .where(tenant(gradingScales, orgId));
    const [row] = await tx
      .insert(gradingScales)
      .values({
        organisationId: orgId,
        name: input.name,
        isDefault: input.isDefault ?? false,
      })
      .returning();
    await tx.insert(gradingScaleBands).values(
      input.bands.map((band) => ({
        ...band,
        gradingScaleId: row.id,
        organisationId: orgId,
        minPercent: String(band.minPercent),
        maxPercent: String(band.maxPercent),
        gpa: String(band.gpa),
        remark: band.remark ?? null,
      })),
    );
    return row;
  });
}

export async function setDefaultScale(db: DB, orgId: string, id: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: gradingScales.id })
      .from(gradingScales)
      .where(and(eq(gradingScales.id, id), tenant(gradingScales, orgId)))
      .limit(1);
    if (!existing) throw notFound("Grading scale not found");
    await tx
      .update(gradingScales)
      .set({ isDefault: false })
      .where(tenant(gradingScales, orgId));
    const [row] = await tx
      .update(gradingScales)
      .set({ isDefault: true })
      .where(and(eq(gradingScales.id, id), tenant(gradingScales, orgId)))
      .returning();
    return row;
  });
}
