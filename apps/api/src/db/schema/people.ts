import { relations } from "drizzle-orm";
import { boolean, date, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  createdAtCol,
  employeeStatusEnum,
  employeeTypeEnum,
  employmentTypeEnum,
  genderEnum,
  guardianRelationshipEnum,
  idCol,
  orgIdCol,
  studentStatusEnum,
  updatedAtCol,
} from "./tenant";
import { organisations } from "./tenant";

export const students = pgTable(
  "students",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    /** Platform-wide student code, e.g. ST-1025 (also used as a login ID). */
    studentId: text("student_id").notNull(),
    admissionNumber: text("admission_number"),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    photoUrl: text("photo_url"),
    dateOfBirth: date("date_of_birth"),
    gender: genderEnum("gender").notNull(),
    bloodGroup: text("blood_group"),
    nationality: text("nationality"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    admissionDate: date("admission_date"),
    /** Placement for the current year lives in `enrolments` (never overwritten). */
    status: studentStatusEnum("status").notNull().default("active"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("students_org_code_uq").on(t.organisationId, t.studentId),
    uniqueIndex("students_org_admission_uq").on(t.organisationId, t.admissionNumber),
  ],
);

export const guardians = pgTable("guardians", {
  id: idCol(),
  organisationId: orgIdCol(),
  fullName: text("full_name").notNull(),
  relationship: guardianRelationshipEnum("relationship").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  occupation: text("occupation"),
  photoUrl: text("photo_url"),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});

/** A student can have several guardians; one guardian can have several children. */
export const studentGuardians = pgTable(
  "student_guardians",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("student_guardians_uq").on(t.studentId, t.guardianId)],
);

export const employees = pgTable(
  "employees",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    employeeId: text("employee_id").notNull(),
    fullName: text("full_name").notNull(),
    photoUrl: text("photo_url"),
    department: text("department"),
    designation: text("designation"),
    joiningDate: date("joining_date"),
    qualification: text("qualification"),
    phone: text("phone"),
    email: text("email"),
    emergencyContact: text("emergency_contact"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    staffType: employeeTypeEnum("staff_type").notNull().default("teaching"),
    salary: numeric("salary", { precision: 12, scale: 2 }),
    status: employeeStatusEnum("status").notNull().default("active"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("employees_org_code_uq").on(t.organisationId, t.employeeId),
    uniqueIndex("employees_org_email_uq").on(t.organisationId, t.email),
  ],
);

/* ------------------------------ Relations ------------------------------ */

export const studentsRelations = relations(students, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [students.organisationId],
    references: [organisations.id],
  }),
  studentGuardians: many(studentGuardians),
}));

export const guardiansRelations = relations(guardians, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [guardians.organisationId],
    references: [organisations.id],
  }),
  studentGuardians: many(studentGuardians),
}));

export const studentGuardiansRelations = relations(studentGuardians, ({ one }) => ({
  student: one(students, { fields: [studentGuardians.studentId], references: [students.id] }),
  guardian: one(guardians, { fields: [studentGuardians.guardianId], references: [guardians.id] }),
}));

export const employeesRelations = relations(employees, ({ one }) => ({
  organisation: one(organisations, {
    fields: [employees.organisationId],
    references: [organisations.id],
  }),
}));
