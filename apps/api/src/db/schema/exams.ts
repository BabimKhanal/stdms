import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAtCol,
  examStatusEnum,
  examTypeEnum,
  idCol,
  orgIdCol,
  updatedAtCol,
} from "./tenant";
import { organisations } from "./tenant";
import { students } from "./people";
import { academicYears, classes, subjects, terms } from "./academics";

export const exams = pgTable(
  "exams",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    type: examTypeEnum("type").notNull(),
    termId: uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: examStatusEnum("status").notNull().default("draft"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("exams_org_year_idx").on(t.organisationId, t.academicYearId)],
);

/** One exam × one class × one subject — the unit marks are entered for. */
export const examSubjects = pgTable(
  "exam_subjects",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    fullMarks: integer("full_marks").notNull().default(100),
    passMarks: integer("pass_marks").notNull().default(35),
    theoryMarks: integer("theory_marks"),
    practicalMarks: integer("practical_marks"),
    internalMarks: integer("internal_marks"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("exam_subjects_uq").on(t.examId, t.classId, t.subjectId)],
);

export const marks = pgTable(
  "marks",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    examSubjectId: uuid("exam_subject_id")
      .notNull()
      .references(() => examSubjects.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    marksObtained: integer("marks_obtained"),
    isAbsent: boolean("is_absent").notNull().default(false),
    remarks: text("remarks"),
    enteredBy: uuid("entered_by"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("marks_uq").on(t.examSubjectId, t.studentId)],
);

export const gradingScales = pgTable(
  "grading_scales",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("grading_scales_org_name_uq").on(t.organisationId, t.name)],
);

export const gradingScaleBands = pgTable(
  "grading_scale_bands",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    gradingScaleId: uuid("grading_scale_id")
      .notNull()
      .references(() => gradingScales.id, { onDelete: "cascade" }),
    minPercent: numeric("min_percent", { precision: 5, scale: 2 }).notNull(),
    maxPercent: numeric("max_percent", { precision: 5, scale: 2 }).notNull(),
    grade: text("grade").notNull(),
    gpa: numeric("gpa", { precision: 3, scale: 2 }).notNull(),
    remark: text("remark"),
    createdAt: createdAtCol(),
  },
  (t) => [index("grading_scale_bands_scale_idx").on(t.gradingScaleId)],
);

/* ------------------------------ Relations ------------------------------ */

export const examsRelations = relations(exams, ({ one, many }) => ({
  organisation: one(organisations, { fields: [exams.organisationId], references: [organisations.id] }),
  term: one(terms, { fields: [exams.termId], references: [terms.id] }),
  academicYear: one(academicYears, {
    fields: [exams.academicYearId],
    references: [academicYears.id],
  }),
  examSubjects: many(examSubjects),
}));

export const examSubjectsRelations = relations(examSubjects, ({ one, many }) => ({
  exam: one(exams, { fields: [examSubjects.examId], references: [exams.id] }),
  class: one(classes, { fields: [examSubjects.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [examSubjects.subjectId], references: [subjects.id] }),
  marks: many(marks),
}));

export const marksRelations = relations(marks, ({ one }) => ({
  examSubject: one(examSubjects, { fields: [marks.examSubjectId], references: [examSubjects.id] }),
  student: one(students, { fields: [marks.studentId], references: [students.id] }),
}));

export const gradingScalesRelations = relations(gradingScales, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [gradingScales.organisationId],
    references: [organisations.id],
  }),
  bands: many(gradingScaleBands),
}));

export const gradingScaleBandsRelations = relations(gradingScaleBands, ({ one }) => ({
  gradingScale: one(gradingScales, {
    fields: [gradingScaleBands.gradingScaleId],
    references: [gradingScales.id],
  }),
}));
