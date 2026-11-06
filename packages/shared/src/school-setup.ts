export const SCHOOL_SETUP_TARGETS = ["years", "classes", "sections", "subjects", "assignments"] as const;
export type SchoolSetupTarget = (typeof SCHOOL_SETUP_TARGETS)[number];
export type AcademicWorkspaceTarget = SchoolSetupTarget | "timetable";

export function academicWorkspaceTarget(value?: string): AcademicWorkspaceTarget {
  return value === "timetable" || SCHOOL_SETUP_TARGETS.includes(value as SchoolSetupTarget) ? value as AcademicWorkspaceTarget : "years";
}

export type SchoolSetupStep = {
  target: SchoolSetupTarget;
  title: string;
  description: string;
  detail: string;
  complete: boolean;
};

export type SchoolSetupStatus = {
  years: { id: string; name: string; isCurrent: boolean }[];
  currentYear: { id: string; name: string } | null;
  teacherAccounts: number;
  steps: SchoolSetupStep[];
  completedSteps: number;
  totalSteps: number;
  ready: boolean;
  nextTarget: SchoolSetupTarget | null;
};

export function canViewSchoolSetup(user: { roles: string[]; permissions: string[]; isPlatformAdmin?: boolean }) {
  return !user.isPlatformAdmin
    && user.roles.some((role) => ["owner", "principal", "administrator"].includes(role))
    && user.permissions.includes("academic.view");
}
