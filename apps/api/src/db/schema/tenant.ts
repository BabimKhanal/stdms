import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Enumerations shared across domains
 * ------------------------------------------------------------------ */

export const organisationStatusEnum = pgEnum("organisation_status", [
  "active",
  "suspended",
  "trial",
]);

export const academicTypeEnum = pgEnum("academic_type", ["school", "college", "academy", "university"]);

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const studentStatusEnum = pgEnum("student_status", [
  "active",
  "graduated",
  "suspended",
  "withdrawn",
  "transferred",
  "alumni",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "leave",
  "excused",
  "sick",
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "sick",
  "personal",
  "emergency",
  "annual",
  "casual",
  "custom",
]);

export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);

export const leaveApplicantEnum = pgEnum("leave_applicant", ["student", "employee"]);

export const employeeTypeEnum = pgEnum("employee_type", [
  "teaching",
  "non_teaching",
  "administrative",
  "support",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "probation",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_leave",
  "resigned",
  "terminated",
]);

export const examTypeEnum = pgEnum("exam_type", [
  "unit_test",
  "mid_term",
  "term",
  "pre_board",
  "final",
  "practical",
]);

export const examStatusEnum = pgEnum("exam_status", ["draft", "ongoing", "completed", "published"]);

export const feeFrequencyEnum = pgEnum("fee_frequency", [
  "monthly",
  "quarterly",
  "semester",
  "annual",
  "one_time",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank",
  "esewa",
  "khalti",
  "fonepay",
  "card",
  "other",
]);

export const paymentSubmissionStatusEnum = pgEnum("payment_submission_status", ["pending", "approved", "rejected"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

export const homeworkStatusEnum = pgEnum("homework_status", [
  "not_submitted",
  "submitted",
  "late",
  "reviewed",
  "resubmission_requested",
]);

export const noticePriorityEnum = pgEnum("notice_priority", ["low", "normal", "high", "urgent"]);

export const guardianRelationshipEnum = pgEnum("guardian_relationship", [
  "father",
  "mother",
  "guardian",
  "emergency",
]);

export const subjectTypeEnum = pgEnum("subject_type", ["theory", "practical", "both"]);

export const weekDayEnum = pgEnum("week_day", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

/* ------------------------------------------------------------------ *
 * Shared column helpers
 * ------------------------------------------------------------------ */

export const idCol = () => uuid("id").defaultRandom().primaryKey();

export const orgIdCol = () =>
  uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" });

export const createdAtCol = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const updatedAtCol = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ *
 * Tenancy & security
 * ------------------------------------------------------------------ */

/**
 * Platform-level row: the tenant itself. No organisation_id (it *is* the
 * organisation) so it is deliberately NOT covered by Row Level Security —
 * the super-admin portal manages it.
 */
export const organisations = pgTable("organisations", {
  id: idCol(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  registrationNumber: text("registration_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  academicType: academicTypeEnum("academic_type").notNull().default("school"),
  country: text("country").notNull().default("Nepal"),
  currency: text("currency").notNull().default("NPR"),
  timezone: text("timezone").notNull().default("Asia/Kathmandu"),
  dateFormat: text("date_format").notNull().default("YYYY-MM-DD"),
  primaryColor: text("primary_color").notNull().default("#2563eb"),
  secondaryColor: text("secondary_color").notNull().default("#0f172a"),
  status: organisationStatusEnum("status").notNull().default("trial"),
  plan: text("plan").notNull().default("starter"),
  maxStudents: integer("max_students").notNull().default(500),
  maxUsers: integer("max_users").notNull().default(100),
  maxStorageMb: integer("max_storage_mb").notNull().default(5120),
  currentAcademicYearId: uuid("current_academic_year_id"),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});

/** Permission catalogue — global, read-only, shared by every tenant. */
export const permissions = pgTable(
  "permissions",
  {
    id: idCol(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("permissions_resource_action_uq").on(t.resource, t.action)],
);

/** Roles belong to one institution; system roles cannot be deleted. */
export const roles = pgTable(
  "roles",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("roles_org_key_uq").on(t.organisationId, t.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: idCol(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("role_permissions_uq").on(t.roleId, t.permissionId)],
);

/**
 * A user belongs to exactly one organisation, EXCEPT platform admins
 * (orgId null + isPlatformAdmin) who operate the SaaS console.
 */
export const users = pgTable(
  "users",
  {
    id: idCol(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    email: text("email"),
    username: text("username"),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    status: text("status").notNull().default("active"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    locale: text("locale").notNull().default("en"),
    /** Login linkage: a user may represent an employee, student or guardian. */
    employeeId: uuid("employee_id"),
    studentId: uuid("student_id"),
    guardianId: uuid("guardian_id"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    // Email and username are globally unique so login is unambiguous —
    // one person has exactly one account across the whole platform.
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: idCol(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("user_roles_uq").on(t.userId, t.roleId)],
);

/** Immutable audit trail (SRS §50). */
export const auditLogs = pgTable("audit_logs", {
  id: idCol(),
  organisationId: orgIdCol(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ip: text("ip"),
  createdAt: createdAtCol(),
});

/** Per-institution module switches (SRS §55). */
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    flag: text("flag").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("feature_flags_uq").on(t.organisationId, t.flag)],
);

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */

export const organisationsRelations = relations(organisations, ({ many }) => ({
  roles: many(roles),
  users: many(users),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
        references: [permissions.id],
  }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLogs.organisationId],
    references: [organisations.id],
  }),
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  organisation: one(organisations, {
    fields: [featureFlags.organisationId],
    references: [organisations.id],
  }),
}));
