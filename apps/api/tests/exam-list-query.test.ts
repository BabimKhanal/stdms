import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { listExams } from "../src/modules/exams/service";
import type { AuthUser } from "../src/lib/context";
import type { DB } from "../src/lib/types";
import { redis } from "../src/lib/redis";

redis.disconnect();
const orgId = "11111111-1111-4111-8111-111111111111";

test("exam-list aggregates correlate to the qualified outer exam for admins, teachers and students", async () => {
  const principal: AuthUser = { id: "user", name: "User", orgId, roles: ["administrator"], permissions: ["exam.view"], isPlatformAdmin: false, mustChangePassword: false, employeeId: null, studentId: null, guardianIds: [] };
  for (const user of [principal, { ...principal, roles: ["teacher"], employeeId: "teacher" }, { ...principal, roles: ["student"], studentId: "student" }]) {
    let text = "";
    const db = drizzle({ query: async (query: { text: string }) => { text = query.text; return { rows: [] }; } } as unknown as PoolClient) as unknown as DB;
    await listExams(db, orgId, user);
    assert.equal(/es\.exam_id = "id"/.test(text), false);
    assert.ok(text.includes('es.exam_id = "exams"."id"'));
    assert.ok(text.includes('c.organisation_id = $'));
    if (user.roles.includes("teacher")) assert.ok(text.includes("scoped_cs.organisation_id = $"));
    if (user.studentId) assert.ok(text.includes("'published'"));
  }
});
