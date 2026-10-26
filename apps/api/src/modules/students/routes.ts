import { Hono } from "hono";
import { z } from "zod";
import { guardianInputSchema, linkGuardianSchema, studentInputSchema, studentListQuerySchema } from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import { writeAudit } from "../../lib/audit";
import * as svc from "./service";
import { getCurrentYearId } from "../academics/service";

export const studentRoutes = new Hono<AppEnv>();

studentRoutes.use("*", requireAuth, requireOrg);

/* List + search + filter + server-side pagination (SRS §65) */
studentRoutes.get("/", requirePermission("student.view"), async (c) => {
  const q = parse(studentListQuerySchema, c.req.query());
  const db = c.get("db");
  const orgId = c.get("orgId")!;
  const yearId = q.status === "graduated" ? undefined : (await getCurrentYearId(db, orgId)) ?? undefined;
   const { data, total } = await svc.listStudents(db, orgId, { ...q, academicYearId: yearId, principal: c.get("user")! });
  return okList(c, data, total, q.page, q.pageSize);
});

studentRoutes.get("/:id", requirePermission("student.view"), async (c) => {
  return ok(c, await svc.getStudent(c.get("db"), c.get("orgId")!, c.req.param("id"), c.get("user")!));
});

studentRoutes.post("/", requirePermission("student.create"), async (c) => {
  const input = parse(studentInputSchema, await c.req.json());
  const orgId = c.get("orgId")!;
  const yearId = input.academicYearId ?? (await getCurrentYearId(c.get("db"), orgId));
  const row = await svc.createStudent(c.get("db"), orgId, { ...input, academicYearId: yearId });
  await writeAudit(c, { action: "create", entity: "student", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

studentRoutes.put("/:id", requirePermission("student.edit"), async (c) => {
  const input = parse(studentInputSchema.partial(), await c.req.json());
  const before = await svc.getStudent(c.get("db"), c.get("orgId")!, c.req.param("id"), c.get("user")!).catch(() => null);
  const row = await svc.updateStudent(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  await writeAudit(c, {
    action: "update",
    entity: "student",
    entityId: row.id,
    oldValue: before ? { status: before.status, phone: before.phone, address: before.address } : null,
    newValue: input,
  });
  return ok(c, row);
});

studentRoutes.delete("/:id", requirePermission("student.delete"), async (c) => {
  await svc.getStudent(c.get("db"), c.get("orgId")!, c.req.param("id"), c.get("user")!);
  await svc.deleteStudent(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "student", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

studentRoutes.post("/:id/account", requirePermission("user.create"), async (c) => {
  const result = await svc.provisionStudentAccount(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "provision_account", entity: "student", entityId: c.req.param("id") });
  return ok(c, result, result.created ? 201 : 200);
});

/* Guardians */
const guardianQuery = z.object({ search: z.string().max(80).optional() });

export const guardianRoutes = new Hono<AppEnv>();
guardianRoutes.use("*", requireAuth, requireOrg);

guardianRoutes.get("/", requirePermission("guardian.view"), async (c) => {
  const q = parse(guardianQuery, c.req.query());
  const rows = await svc.listGuardians(c.get("db"), c.get("orgId")!, q.search);
  return okList(c, rows, rows.length, 1, 1000);
});

guardianRoutes.post("/", requirePermission("guardian.create"), async (c) => {
  const input = parse(guardianInputSchema, await c.req.json());
  const row = await svc.createGuardian(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "guardian", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

guardianRoutes.put("/:id", requirePermission("guardian.edit"), async (c) => {
  const input = parse(guardianInputSchema.partial(), await c.req.json());
  const row = await svc.updateGuardian(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  await writeAudit(c, { action: "update", entity: "guardian", entityId: row.id, newValue: input });
  return ok(c, row);
});

guardianRoutes.post("/:id/account", requirePermission("user.create"), async (c) => {
  const result = await svc.provisionGuardianAccount(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "provision_account", entity: "guardian", entityId: c.req.param("id") });
  return ok(c, result, result.created ? 201 : 200);
});

guardianRoutes.post("/link", requirePermission("guardian.edit"), async (c) => {
  const input = parse(linkGuardianSchema, await c.req.json());
  const row = await svc.linkGuardian(c.get("db"), c.get("orgId")!, input.studentId, input.guardianId, input.isPrimary);
  return ok(c, row, 201);
});

guardianRoutes.post("/unlink", requirePermission("guardian.edit"), async (c) => {
  const input = parse(linkGuardianSchema, await c.req.json());
  await svc.unlinkGuardian(c.get("db"), c.get("orgId")!, input.studentId, input.guardianId);
  return ok(c, { unlinked: true });
});

/* Enrolment / promotion wizard */
export const enrolmentRoutes = new Hono<AppEnv>();
enrolmentRoutes.use("*", requireAuth, requireOrg);

const promoteSchema = z.object({
  fromYearId: z.uuid(),
  toYearId: z.uuid(),
  entries: z
    .array(
      z.object({
        studentId: z.uuid(),
        status: z.enum(["promoted", "repeated", "transferred", "graduated", "withdrawn"]),
        toClassId: z.uuid().nullable().optional(),
        toSectionId: z.uuid().nullable().optional(),
      }),
    )
    .min(1),
});

enrolmentRoutes.post("/promote", requirePermission("enrolment.edit"), async (c) => {
  const input = parse(promoteSchema, await c.req.json());
  const result = await svc.promoteStudents(
    c.get("db"),
    c.get("orgId")!,
    input.fromYearId,
    input.toYearId,
    input.entries,
  );
  await writeAudit(c, { action: "promote", entity: "enrolment", newValue: { count: result.length } });
  return ok(c, result);
});
