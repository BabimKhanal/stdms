import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { academicWorkspaceTarget, canViewSchoolSetup, type SchoolSetupStatus } from "@edu/shared";
import { buildSchoolSetup, type SetupFacts } from "../src/modules/dashboard/setup";
import { dashboardRoutes } from "../src/modules/dashboard/routes";
import { listClasses, updateYear } from "../src/modules/academics/service";
import type { AppEnv, DB } from "../src/lib/types";
import type { AuthUser } from "../src/lib/context";
import { redis } from "../src/lib/redis";

redis.disconnect();
const empty: SetupFacts = { classes: 0, sections: 0, subjects: 0, classesWithoutSections: 0, classesWithoutSubjects: 0, assignments: 0, invalidTeacherAssignments: 0, teacherAccounts: 0 };
const configured: SetupFacts = { classes: 2, sections: 3, subjects: 4, classesWithoutSections: 0, classesWithoutSubjects: 0, assignments: 8, invalidTeacherAssignments: 0, teacherAccounts: 2 };
const years = [{ id: "year-1", name: "2026/27", isCurrent: true }];

test("a new school starts with five incomplete steps and a current-year action", () => {
  const setup = buildSchoolSetup([], empty);
  assert.equal(setup.completedSteps, 0);
  assert.equal(setup.totalSteps, 5);
  assert.equal(setup.ready, false);
  assert.equal(setup.nextTarget, "years");
});

test("existing academic records do not replace selecting exactly one current year", () => {
  for (const records of [[{ ...years[0], isCurrent: false }], [...years, { ...years[0], id: "year-2" }]]) {
    const setup = buildSchoolSetup(records, configured);
    assert.equal(setup.currentYear, null);
    assert.equal(setup.nextTarget, "years");
    assert.equal(setup.ready, false);
  }
});

test("setup checks section coverage and active subject-teacher assignments", () => {
  const sectionsMissing = buildSchoolSetup(years, { ...configured, classesWithoutSections: 1 });
  assert.equal(sectionsMissing.nextTarget, "sections");
  for (const change of [{ classesWithoutSubjects: 1 }, { invalidTeacherAssignments: 1 }, { assignments: 0 }, { teacherAccounts: 0 }]) {
    const setup = buildSchoolSetup(years, { ...configured, ...change });
    assert.equal(setup.nextTarget, "assignments");
    assert.equal(setup.ready, false);
  }
  const setup = buildSchoolSetup(years, configured);
  assert.equal(setup.completedSteps, 5);
  assert.equal(setup.ready, true);
  assert.equal(setup.nextTarget, null);
});

test("the checklist is an institution-admin experience and deep links reject unknown targets", () => {
  assert.equal(canViewSchoolSetup({ roles: ["administrator"], permissions: ["academic.view"] }), true);
  for (const role of ["teacher", "student", "parent", "accountant"]) assert.equal(canViewSchoolSetup({ roles: [role], permissions: ["academic.view"] }), false);
  assert.equal(canViewSchoolSetup({ roles: ["owner"], permissions: [] }), false);
  assert.equal(canViewSchoolSetup({ roles: ["owner"], permissions: ["academic.view"], isPlatformAdmin: true }), false);
  assert.equal(academicWorkspaceTarget("sections"), "sections");
  assert.equal(academicWorkspaceTarget("assignments"), "assignments");
  assert.equal(academicWorkspaceTarget("unknown"), "years");
});

function principal(role: string, permissions = ["academic.view"]): AuthUser {
  return { id: "user", name: "Test user", orgId: "11111111-1111-4111-8111-111111111111", roles: [role], permissions, isPlatformAdmin: false, mustChangePassword: false, studentId: null, employeeId: null, guardianIds: [] };
}

function setupApp(user: AuthUser | null) {
  let queries = 0;
  const db = { execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
    queries++;
    const compiled = new PgDialect().sqlToQuery(query);
    assert.ok(compiled.params.length >= 15, "all subqueries should be tenant-bound");
    assert.ok(compiled.params.every((value) => value === user!.orgId));
    return { rows: [{ years, ...configured }] };
  } } as unknown as DB;
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("user", user); c.set("orgId", user?.orgId ?? null); c.set("db", db); await next(); });
  app.route("/dashboard", dashboardRoutes);
  app.onError((error, c) => c.json({ ok: false, error: error.message }, (error as { status?: 401 | 403 }).status ?? 500));
  return { app, queries: () => queries };
}

test("setup API denies anonymous, non-admin, missing-permission and missing-tenant requests before querying", async () => {
  for (const [user, status] of [[null, 401], [principal("teacher"), 403], [principal("student"), 403], [principal("parent"), 403], [principal("accountant"), 403], [principal("administrator", []), 403], [{ ...principal("owner"), orgId: null }, 403]] as const) {
    const context = setupApp(user);
    const response = await context.app.request("/dashboard/setup");
    assert.equal(response.status, status);
    assert.equal(context.queries(), 0);
  }
});

test("setup API uses the authenticated tenant even if another organisation is requested", async () => {
  const context = setupApp(principal("administrator"));
  const response = await context.app.request("/dashboard/setup?organisationId=other-tenant");
  assert.equal(response.status, 200);
  const body = await response.json() as { data: SchoolSetupStatus };
  assert.equal(body.data.ready, true);
  assert.equal(context.queries(), 1);
});

test("class lists work before a current year exists without sending an invalid UUID", async () => {
  let sql = "";
  let values: unknown[] = [];
  const db = drizzle({ query: async (query: { text: string }, params: unknown[]) => { sql = query.text; values = params; return { rows: [] }; } } as unknown as PoolClient) as unknown as DB;
  assert.deepEqual(await listClasses(db, "11111111-1111-4111-8111-111111111111", null), []);
  assert.equal(values.includes(""), false);
  assert.equal(sql.includes("academic_year_id"), false);
});

test("choosing a missing academic year cannot clear the existing current year", async () => {
  let selections = 0;
  const query = { from: () => query, where: () => query, for: async () => selections++ === 0 ? [{ id: "org" }] : [] };
  const tx = { select: () => query, update: () => assert.fail("No year should be modified before the target is verified") };
  const db = { transaction: async (fn: (transaction: typeof tx) => unknown) => fn(tx) } as unknown as DB;
  await assert.rejects(updateYear(db, "org", "missing", { isCurrent: true }), /Academic year not found/);
  assert.equal(selections, 2);
});
