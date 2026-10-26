/** Shared enums / constants used by both the API and the web app. */

export const STUDENT_STATUSES = [
  "active",
  "graduated",
  "suspended",
  "withdrawn",
  "transferred",
  "alumni",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "leave", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = [
  "sick",
  "personal",
  "emergency",
  "annual",
  "casual",
  "custom",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_APPLICANTS = ["student", "employee"] as const;
export type LeaveApplicant = (typeof LEAVE_APPLICANTS)[number];

export const EMPLOYEE_TYPES = ["teaching", "non_teaching", "administrative", "support"] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "probation"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = ["active", "on_leave", "resigned", "terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EXAM_TYPES = ["unit_test", "mid_term", "term", "pre_board", "final", "practical"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const FEE_FREQUENCIES = ["monthly", "quarterly", "semester", "annual", "one_time"] as const;
export type FeeFrequency = (typeof FEE_FREQUENCIES)[number];

export const PAYMENT_METHODS = ["cash", "bank", "esewa", "khalti", "fonepay", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVOICE_STATUSES = ["unpaid", "partial", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const HOMEWORK_STATUSES = ["not_submitted", "submitted", "late", "reviewed", "resubmission_requested"] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];

export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const NOTICE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type NoticePriority = (typeof NOTICE_PRIORITIES)[number];

export const ACADEMIC_TYPES = ["school", "college", "academy", "university"] as const;
export type AcademicType = (typeof ACADEMIC_TYPES)[number];

export const ORGANISATION_STATUSES = ["active", "suspended", "trial"] as const;
export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

export const FEATURE_FLAGS = [
  "attendance",
  "timetable",
  "homework",
  "notices",
  "fees",
  "exams",
  "results",
  "leave",
  "reports",
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Role keys used at login (matched against the roles table by name-slug). */
export const ROLE_KEYS = [
  "owner",
  "principal",
  "administrator",
  "teacher",
  "class_teacher",
  "accountant",
  "exam_officer",
  "student",
  "parent",
  "staff",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Languages: translation keys are used in the UI, never hard-coded strings. */
export const SUPPORTED_LOCALES = ["en", "ne"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
