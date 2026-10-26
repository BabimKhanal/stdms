import { relations } from "drizzle-orm";
import { boolean, date, integer, pgTable, text, time, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAtCol, idCol, orgIdCol, updatedAtCol, weekDayEnum, subjectTypeEnum } from "./tenant";
import { organisations } from "./tenant";
import { employees, students } from "./people";

export const academicYears = pgTable(
  "academic_years",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("academic_years_org_name_uq").on(t.organisationId, t.name)],
);

export const terms = pgTable(
  "terms",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("terms_year_name_uq").on(t.academicYearId, t.name)],
);

export const classes = pgTable(
  "classes",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    numericLevel: integer("numeric_level"),
    classTeacherId: uuid("class_teacher_id").references(() => employees.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("classes_org_name_uq").on(t.organisationId, t.name)],
);

export const sections = pgTable(
  "sections",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    classTeacherId: uuid("class_teacher_id").references(() => employees.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("sections_class_name_uq").on(t.classId, t.name)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    code: text("code"),
    type: subjectTypeEnum("type").notNull().default("theory"),
    creditHours: integer("credit_hours"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("subjects_org_name_uq").on(t.organisationId, t.name)],
);

/** Which subject is taught in which class, and by which teacher. */
export const classSubjects = pgTable(
  "class_subjects",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").references(() => employees.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("class_subjects_uq").on(t.classId, t.subjectId)],
);

/**
 * Academic history (SRS §60): one row per student per academic year.
 * A new year INSERTs new rows — previous years are never overwritten.
 */
export const enrolments = pgTable(
  "enrolments",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    rollNumber: integer("roll_number"),
    /** Set by the promotion wizard: promoted | repeated | transferred | graduated | withdrawn */
    promotionStatus: text("promotion_status"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("enrolments_year_student_uq").on(t.academicYearId, t.studentId)],
);

export const timetablePeriods = pgTable(
  "timetable_periods",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isBreak: boolean("is_break").notNull().default(false),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("timetable_periods_org_name_uq").on(t.organisationId, t.name)],
);

export const timetableSlots = pgTable(
  "timetable_slots",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    day: weekDayEnum("day").notNull(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => timetablePeriods.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").references(() => employees.id, { onDelete: "set null" }),
    room: text("room"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("timetable_slots_section_day_period_uq").on(t.sectionId, t.day, t.periodId)],
);

/* ------------------------------ Relations ------------------------------ */

export const academicYearsRelations = relations(academicYears, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [academicYears.organisationId],
    references: [organisations.id],
  }),
  terms: many(terms),
}));

export const termsRelations = relations(terms, ({ one }) => ({
  academicYear: one(academicYears, {
    fields: [terms.academicYearId],
    references: [academicYears.id],
  }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  sections: many(sections),
  classSubjects: many(classSubjects),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  class: one(classes, { fields: [sections.classId], references: [classes.id] }),
  timetableSlots: many(timetableSlots),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  classSubjects: many(classSubjects),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  class: one(classes, { fields: [classSubjects.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [classSubjects.subjectId], references: [subjects.id] }),
  teacher: one(employees, { fields: [classSubjects.teacherId], references: [employees.id] }),
}));

export const timetablePeriodsRelations = relations(timetablePeriods, ({ many }) => ({
  slots: many(timetableSlots),
}));

export const timetableSlotsRelations = relations(timetableSlots, ({ one }) => ({
  section: one(sections, { fields: [timetableSlots.sectionId], references: [sections.id] }),
  period: one(timetablePeriods, { fields: [timetableSlots.periodId], references: [timetablePeriods.id] }),
  subject: one(subjects, { fields: [timetableSlots.subjectId], references: [subjects.id] }),
  teacher: one(employees, { fields: [timetableSlots.teacherId], references: [employees.id] }),
}));
