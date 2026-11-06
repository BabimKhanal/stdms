import { sql } from "drizzle-orm";
import type { SchoolSetupStatus, SchoolSetupStep } from "@edu/shared";
import { academicYears, classes, classSubjects, employees, roles, sections, subjects, userRoles, users } from "../../db/schema";
import type { DB } from "../../lib/types";

export type SetupFacts = {
  classes: number;
  sections: number;
  subjects: number;
  classesWithoutSections: number;
  classesWithoutSubjects: number;
  assignments: number;
  invalidTeacherAssignments: number;
  teacherAccounts: number;
};

export function buildSchoolSetup(years: SchoolSetupStatus["years"], facts: SetupFacts): SchoolSetupStatus {
  const current = years.filter((year) => year.isCurrent);
  const steps: SchoolSetupStep[] = [
    {
      target: "years", title: "Choose the current academic year",
      description: "Create an academic year with its dates and mark it as current.",
      complete: current.length === 1,
      detail: current.length === 1 ? `${current[0].name} is the current academic year.` : current.length > 1 ? "More than one year is marked current. Choose one current year." : years.length ? "Academic years exist, but none is marked current." : "No academic years yet. Start by creating your first year.",
    },
    {
      target: "classes", title: "Add your classes or grades",
      description: "Create the classes your school or college teaches.",
      complete: facts.classes > 0,
      detail: facts.classes ? `${facts.classes} class${facts.classes === 1 ? "" : "es"} configured.` : "No classes yet. Add your first class before creating sections or enrolling students.",
    },
    {
      target: "sections", title: "Create class sections",
      description: "Add at least one section to each class, such as Section A.",
      complete: facts.classes > 0 && facts.sections > 0 && facts.classesWithoutSections === 0,
      detail: !facts.classes ? "Create a class first, then add its sections." : facts.classesWithoutSections ? `${facts.classesWithoutSections} class${facts.classesWithoutSections === 1 ? " needs" : "es need"} a section.` : `${facts.sections} section${facts.sections === 1 ? "" : "s"} configured across all classes.`,
    },
    {
      target: "subjects", title: "Build your subject catalogue",
      description: "Add the subjects used by teaching assignments, homework and exams.",
      complete: facts.subjects > 0,
      detail: facts.subjects ? `${facts.subjects} subject${facts.subjects === 1 ? "" : "s"} available.` : "No subjects yet. Add your first subject, such as Mathematics.",
    },
    {
      target: "assignments", title: "Assign subjects and teachers",
      description: "Allocate subjects to every class and link each allocation to an active teacher account.",
      complete: facts.classes > 0 && facts.subjects > 0 && facts.assignments > 0 && facts.teacherAccounts > 0 && facts.classesWithoutSubjects === 0 && facts.invalidTeacherAssignments === 0,
      detail: !facts.classes || !facts.subjects ? "Create classes and subjects before making teaching assignments." : !facts.teacherAccounts ? "No active employee-linked teacher accounts. Create staff profiles and link teacher logins in User management." : facts.classesWithoutSubjects || facts.invalidTeacherAssignments ? `${facts.classesWithoutSubjects} class${facts.classesWithoutSubjects === 1 ? "" : "es"} without subjects; ${facts.invalidTeacherAssignments} allocation${facts.invalidTeacherAssignments === 1 ? "" : "s"} without an active teacher account.` : `${facts.assignments} class-subject allocation${facts.assignments === 1 ? "" : "s"} linked to active teacher accounts.`,
    },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  return { years, currentYear: current.length === 1 ? { id: current[0].id, name: current[0].name } : null, teacherAccounts: facts.teacherAccounts, steps, completedSteps, totalSteps: steps.length, ready: completedSteps === steps.length, nextTarget: steps.find((step) => !step.complete)?.target ?? null };
}

export async function schoolSetup(db: DB, orgId: string): Promise<SchoolSetupStatus> {
  // One statement gives a consistent snapshot. Explicit tenant predicates also
  // cover correlated subqueries and joins, independently of PostgreSQL RLS.
  const result = await db.execute<SetupFacts & { years: SchoolSetupStatus["years"] }>(sql`
    with teacher_accounts as (
      select distinct ${employees.id} as employee_id
      from ${employees} inner join ${users} on ${users.employeeId} = ${employees.id}
      where ${employees.organisationId} = ${orgId} and ${users.organisationId} = ${orgId}
        and ${employees.status} = 'active' and ${users.status} = 'active'
        and exists (
          select 1 from ${userRoles} inner join ${roles} on ${roles.id} = ${userRoles.roleId}
          where ${userRoles.userId} = ${users.id} and ${roles.organisationId} = ${orgId}
            and ${roles.key} in ('teacher', 'class_teacher')
        )
    )
    select
      (select coalesce(json_agg(json_build_object('id', ${academicYears.id}, 'name', ${academicYears.name}, 'isCurrent', ${academicYears.isCurrent}) order by ${academicYears.startDate} desc), '[]'::json) from ${academicYears} where ${academicYears.organisationId} = ${orgId}) as years,
      (select count(*)::int from ${classes} where ${classes.organisationId} = ${orgId}) as classes,
      (select count(*)::int from ${sections} where ${sections.organisationId} = ${orgId}) as sections,
      (select count(*)::int from ${subjects} where ${subjects.organisationId} = ${orgId}) as subjects,
      (select count(*)::int from ${classes} where ${classes.organisationId} = ${orgId} and not exists (select 1 from ${sections} where ${sections.organisationId} = ${orgId} and ${sections.classId} = ${classes.id})) as "classesWithoutSections",
      (select count(*)::int from ${classes} where ${classes.organisationId} = ${orgId} and not exists (select 1 from ${classSubjects} inner join ${subjects} on ${subjects.id} = ${classSubjects.subjectId} and ${subjects.organisationId} = ${orgId} where ${classSubjects.organisationId} = ${orgId} and ${classSubjects.classId} = ${classes.id})) as "classesWithoutSubjects",
      (select count(*)::int from ${classSubjects} where ${classSubjects.organisationId} = ${orgId}) as assignments,
      (select count(*)::int from ${classSubjects} where ${classSubjects.organisationId} = ${orgId} and (
        not exists (select 1 from teacher_accounts where employee_id = ${classSubjects.teacherId})
        or not exists (select 1 from ${classes} where ${classes.organisationId} = ${orgId} and ${classes.id} = ${classSubjects.classId})
        or not exists (select 1 from ${subjects} where ${subjects.organisationId} = ${orgId} and ${subjects.id} = ${classSubjects.subjectId})
      )) as "invalidTeacherAssignments",
      (select count(*)::int from teacher_accounts) as "teacherAccounts"
  `);
  const facts = result.rows[0];
  return buildSchoolSetup(facts.years, facts);
}
