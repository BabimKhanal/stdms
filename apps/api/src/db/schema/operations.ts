import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  attendanceStatusEnum,
  createdAtCol,
  homeworkStatusEnum,
  idCol,
  leaveApplicantEnum,
  leaveStatusEnum,
  leaveTypeEnum,
  noticePriorityEnum,
  orgIdCol,
  updatedAtCol,
} from "./tenant";
import { organisations, users } from "./tenant";
import { employees, students } from "./people";
import { classes, sections, subjects, timetablePeriods } from "./academics";

/**
 * Daily / periodic student attendance.
 * Named `attendance_records` (not `attendance`) so future attendance
 * sessions, device imports or QR scans can be added without fighting the
 * table name.
 */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    /** Null = whole-day attendance; set = period attendance. */
    periodId: uuid("period_id").references(() => timetablePeriods.id, { onDelete: "set null" }),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    status: attendanceStatusEnum("status").notNull(),
    markedBy: uuid("marked_by").references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("attendance_records_uq").on(
      t.organisationId,
      t.studentId,
      t.date,
      t.periodId,
      t.subjectId,
    ),
    index("attendance_records_section_date_idx").on(t.sectionId, t.date),
    index("attendance_records_student_date_idx").on(t.studentId, t.date),
  ],
);

export const attendanceSettings = pgTable(
  "attendance_settings",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    minimumPercentage: integer("minimum_percentage").notNull().default(75),
    countLateAsPresent: integer("count_late_as_present").notNull().default(1),
    excludeLeave: integer("exclude_leave").notNull().default(1),
    excludeExcused: integer("exclude_excused").notNull().default(1),
    excludeSick: integer("exclude_sick").notNull().default(1),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("attendance_settings_org_uq").on(t.organisationId)],
);

/** Leave requests for students AND staff (SRS §11). */
export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    applicantType: leaveApplicantEnum("applicant_type").notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    type: leaveTypeEnum("type").notNull(),
    customType: text("custom_type"),
    reason: text("reason").notNull(),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    status: leaveStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("leave_requests_org_status_idx").on(t.organisationId, t.status)],
);

export const homework = pgTable(
  "homework",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    assignedDate: date("assigned_date").notNull(),
    submissionDate: date("submission_date"),
    attachmentUrl: text("attachment_url"),
    link: text("link"),
    maxMarks: integer("max_marks"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("homework_section_date_idx").on(t.sectionId, t.assignedDate)],
);

export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    content: text("content"),
    fileUrl: text("file_url"),
    status: homeworkStatusEnum("status").notNull().default("not_submitted"),
    marks: integer("marks"),
    feedback: text("feedback"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("homework_submissions_uq").on(t.homeworkId, t.studentId)],
);

export const notices = pgTable("notices", {
  id: idCol(),
  organisationId: orgIdCol(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  attachmentUrl: text("attachment_url"),
  priority: noticePriorityEnum("priority").notNull().default("normal"),
  publishAt: timestamp("publish_at", { withTimezone: true }).defaultNow().notNull(),
  expireAt: timestamp("expire_at", { withTimezone: true }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAtCol(),
});

/** audience_type: everyone | students | parents | teachers | staff | class | section */
export const noticeAudiences = pgTable(
  "notice_audiences",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    audienceType: text("audience_type").notNull(),
    audienceId: uuid("audience_id"),
  },
  (t) => [index("notice_audiences_notice_idx").on(t.noticeId)],
);

export const events = pgTable("events", {
  id: idCol(),
  organisationId: orgIdCol(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  venue: text("venue"),
  imageUrl: text("image_url"),
  /** Same vocabulary as notice_audiences, stored inline: ["everyone"] etc. */
  audiences: jsonb("audiences").$type<string[]>().notNull().default([]),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});

/* ------------------------------ Relations ------------------------------ */

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  student: one(students, { fields: [attendanceRecords.studentId], references: [students.id] }),
  section: one(sections, { fields: [attendanceRecords.sectionId], references: [sections.id] }),
  period: one(timetablePeriods, {
    fields: [attendanceRecords.periodId],
    references: [timetablePeriods.id],
  }),
  markedByUser: one(users, { fields: [attendanceRecords.markedBy], references: [users.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  student: one(students, { fields: [leaveRequests.studentId], references: [students.id] }),
  reviewer: one(users, { fields: [leaveRequests.reviewedBy], references: [users.id] }),
  creator: one(users, { fields: [leaveRequests.createdBy], references: [users.id] }),
}));

export const homeworkRelations = relations(homework, ({ one, many }) => ({
  class: one(classes, { fields: [homework.classId], references: [classes.id] }),
  section: one(sections, { fields: [homework.sectionId], references: [sections.id] }),
  subject: one(subjects, { fields: [homework.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [homework.teacherId], references: [users.id] }),
  submissions: many(homeworkSubmissions),
}));

export const homeworkSubmissionsRelations = relations(homeworkSubmissions, ({ one }) => ({
  homework: one(homework, { fields: [homeworkSubmissions.homeworkId], references: [homework.id] }),
  student: one(students, { fields: [homeworkSubmissions.studentId], references: [students.id] }),
}));

export const noticesRelations = relations(notices, ({ one, many }) => ({
  author: one(users, { fields: [notices.authorId], references: [users.id] }),
  audiences: many(noticeAudiences),
}));

export const noticeAudiencesRelations = relations(noticeAudiences, ({ one }) => ({
  notice: one(notices, { fields: [noticeAudiences.noticeId], references: [notices.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
}));
