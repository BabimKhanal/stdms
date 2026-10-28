/**
 * RBAC permission catalogue.
 *
 * A permission string is always `<resource>.<action>` (e.g. "student.create").
 * The web app hides navigation items the user lacks, and the API middleware
 * `requirePermission()` rejects requests the user lacks. Both read from here
 * so the two sides can never disagree.
 */

export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "print"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "organisation",
  "user",
  "role",
  "academic",
  "student",
  "guardian",
  "employee",
  "enrolment",
  "timetable",
  "attendance",
  "leave",
  "homework",
  "notice",
  "event",
  "fee",
  "invoice",
  "payment",
  "exam",
  "result",
  "report",
  "audit",
  "platform",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Permission = `${Resource}.${Action}`;

export const ALL_ACTIONS: Action[] = [...ACTIONS];

export function permission(resource: Resource, action: Action): Permission {
  return `${resource}.${action}`;
}

function perms(resource: Resource, actions: Action[]): Permission[] {
  return actions.map((a) => permission(resource, a));
}

const FULL: Action[] = [...ACTIONS];

/**
 * Default role -> permission grants, seeded into the database.
 * Institutions may clone a role and customise it later.
 */
export const DEFAULT_ROLES: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  owner: {
    name: "Institution Owner",
    description: "Full access to everything inside the institution.",
    permissions: RESOURCES.flatMap((r) => perms(r, FULL)),
  },
  principal: {
    name: "Principal",
    description: "Academic and administrative access.",
    permissions: [
      ...perms("organisation", ["view", "edit", "export", "print"]),
      ...RESOURCES.filter((r) => r !== "platform" && r !== "role").flatMap((r) => perms(r, FULL)),
    ],
  },
  administrator: {
    name: "Administrator",
    description: "Day-to-day institution management.",
    permissions: [
      ...perms("organisation", ["view", "edit"]),
      ...perms("user", FULL),
      ...perms("academic", FULL),
      ...perms("student", FULL),
      ...perms("guardian", FULL),
      ...perms("employee", ["view", "create", "edit", "export"]),
      ...perms("enrolment", FULL),
      ...perms("timetable", FULL),
      ...perms("attendance", ["view", "create", "edit", "export", "print"]),
      ...perms("leave", FULL),
      ...perms("homework", ["view", "edit", "delete"]),
      ...perms("notice", FULL),
      ...perms("event", FULL),
      ...perms("fee", ["view", "create", "edit", "export", "print"]),
      ...perms("invoice", ["view", "create", "edit", "export", "print"]),
       ...perms("payment", ["view", "create", "edit", "approve", "export"]),
      ...perms("exam", ["view", "create", "edit", "delete"]),
      ...perms("result", ["view", "create", "export", "print"]),
      ...perms("report", FULL),
      ...perms("audit", ["view"]),
    ],
  },
  teacher: {
    name: "Teacher",
    description: "Assigned classes and subjects only.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("academic", ["view"]),
      ...perms("student", ["view"]),
      ...perms("timetable", ["view"]),
      ...perms("attendance", ["view", "create", "edit", "export"]),
      ...perms("leave", ["view", "create"]),
      ...perms("homework", ["view", "create", "edit", "delete", "export", "print"]),
      ...perms("notice", ["view"]),
      ...perms("event", ["view"]),
      ...perms("exam", ["view", "create", "edit"]),
      ...perms("result", ["view", "create", "export"]),
      ...perms("report", ["view"]),
    ],
  },
  class_teacher: {
    name: "Class Teacher",
    description: "Teacher permissions plus class-level approvals (leave, conduct).",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("academic", ["view"]),
      ...perms("student", ["view", "edit"]),
      ...perms("timetable", ["view"]),
      ...perms("attendance", ["view", "create", "edit", "export"]),
      ...perms("leave", ["view", "create", "approve"]),
      ...perms("homework", ["view", "create", "edit", "delete", "export", "print"]),
      ...perms("notice", ["view", "create"]),
      ...perms("event", ["view"]),
      ...perms("exam", ["view", "create", "edit"]),
      ...perms("result", ["view", "create", "export"]),
      ...perms("report", ["view"]),
    ],
  },
  accountant: {
    name: "Accountant",
    description: "Fees, invoices, payments and finance reports.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("student", ["view"]),
      ...perms("guardian", ["view"]),
      ...perms("fee", FULL),
      ...perms("invoice", FULL),
      ...perms("payment", FULL),
      ...perms("report", ["view", "export"]),
      ...perms("audit", ["view"]),
    ],
  },
  exam_officer: {
    name: "Examination Officer",
    description: "Exams, marks entry, grading and results.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("academic", ["view"]),
      ...perms("student", ["view"]),
      ...perms("exam", FULL),
      ...perms("result", FULL),
      ...perms("report", ["view", "export", "print"]),
      ...perms("attendance", ["view"]),
    ],
  },
  student: {
    name: "Student",
    description: "Personal academic information only.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("academic", ["view"]),
      ...perms("timetable", ["view"]),
      ...perms("attendance", ["view"]),
      ...perms("leave", ["view", "create"]),
      ...perms("homework", ["view"]),
      ...perms("notice", ["view"]),
      ...perms("event", ["view"]),
      ...perms("exam", ["view"]),
      ...perms("result", ["view"]),
      ...perms("fee", ["view"]),
      ...perms("invoice", ["view"]),
      ...perms("payment", ["view", "create"]),
    ],
  },
  parent: {
    name: "Parent / Guardian",
    description: "Access to their children's information.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("academic", ["view"]),
      ...perms("student", ["view"]),
      ...perms("guardian", ["view"]),
      ...perms("timetable", ["view"]),
      ...perms("attendance", ["view"]),
      ...perms("leave", ["view", "create"]),
      ...perms("homework", ["view"]),
      ...perms("notice", ["view"]),
      ...perms("event", ["view"]),
      ...perms("exam", ["view"]),
      ...perms("result", ["view"]),
      ...perms("fee", ["view"]),
      ...perms("invoice", ["view"]),
      ...perms("payment", ["view", "create"]),
    ],
  },
  staff: {
    name: "Staff",
    description: "Non-teaching staff with permission-based access.",
    permissions: [
      ...perms("organisation", ["view"]),
      ...perms("notice", ["view"]),
      ...perms("event", ["view"]),
      ...perms("leave", ["view", "create"]),
      ...perms("timetable", ["view"]),
    ],
  },
};
