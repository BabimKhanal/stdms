import { Hono } from "hono";
import { z } from "zod";
import {
  academicYearInputSchema,
  classInputSchema,
  classSubjectInputSchema,
  sectionInputSchema,
  subjectInputSchema,
  termInputSchema,
  timetablePeriodInputSchema,
} from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import { writeAudit } from "../../lib/audit";
import * as svc from "./service";

export const academicRoutes = new Hono<AppEnv>();

academicRoutes.use("*", requireAuth, requireOrg);

const yearQuery = z.object({ academicYearId: z.uuid().optional() });

/* Academic years */
academicRoutes.get("/years", requirePermission("academic.view"), async (c) => {
  return okList(c, await svc.listYears(c.get("db"), c.get("orgId")!), 0, 1, 1000);
});

academicRoutes.post("/years", requirePermission("academic.create"), async (c) => {
  const input = parse(academicYearInputSchema, await c.req.json());
  const row = await svc.createYear(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "academic_year", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

academicRoutes.put("/years/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(academicYearInputSchema.partial(), await c.req.json());
  const row = await svc.updateYear(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  await writeAudit(c, { action: "update", entity: "academic_year", entityId: row.id, newValue: input });
  return ok(c, row);
});

academicRoutes.delete("/years/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteYear(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "academic_year", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

/* Terms */
academicRoutes.get("/terms", requirePermission("academic.view"), async (c) => {
  const q = parse(yearQuery, c.req.query());
  return okList(c, await svc.listTerms(c.get("db"), c.get("orgId")!, q.academicYearId), 0, 1, 1000);
});

academicRoutes.post("/terms", requirePermission("academic.create"), async (c) => {
  const input = parse(termInputSchema, await c.req.json());
  const row = await svc.createTerm(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "term", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

academicRoutes.delete("/terms/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteTerm(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "term", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

/* Classes */
academicRoutes.get("/classes", requirePermission("academic.view"), async (c) => {
  const yearId = (await svc.getCurrentYearId(c.get("db"), c.get("orgId")!)) ?? "";
  return okList(c, await svc.listClasses(c.get("db"), c.get("orgId")!, yearId, c.get("user")!), 0, 1, 1000);
});

academicRoutes.post("/classes", requirePermission("academic.create"), async (c) => {
  const input = parse(classInputSchema, await c.req.json());
  const row = await svc.createClass(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "class", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

academicRoutes.put("/classes/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(classInputSchema.partial(), await c.req.json());
  const row = await svc.updateClass(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  await writeAudit(c, { action: "update", entity: "class", entityId: row.id, newValue: input });
  return ok(c, row);
});

academicRoutes.delete("/classes/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteClass(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "class", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

/* Sections */
const sectionQuery = z.object({ classId: z.uuid().optional() });

academicRoutes.get("/sections", requirePermission("academic.view"), async (c) => {
  const q = parse(sectionQuery, c.req.query());
  const yearId = await svc.getCurrentYearId(c.get("db"), c.get("orgId")!);
  return okList(c, await svc.listSections(c.get("db"), c.get("orgId")!, q.classId, yearId ?? undefined, c.get("user")!), 0, 1, 1000);
});

academicRoutes.post("/sections", requirePermission("academic.create"), async (c) => {
  const input = parse(sectionInputSchema, await c.req.json());
  const row = await svc.createSection(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "section", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

academicRoutes.put("/sections/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(sectionInputSchema.partial(), await c.req.json());
  const row = await svc.updateSection(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  return ok(c, row);
});

academicRoutes.delete("/sections/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteSection(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "section", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

/* Subjects */
academicRoutes.get("/subjects", requirePermission("academic.view"), async (c) => {
  return okList(c, await svc.listSubjects(c.get("db"), c.get("orgId")!), 0, 1, 1000);
});

academicRoutes.post("/subjects", requirePermission("academic.create"), async (c) => {
  const input = parse(subjectInputSchema, await c.req.json());
  const row = await svc.createSubject(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, { action: "create", entity: "subject", entityId: row.id, newValue: input });
  return ok(c, row, 201);
});

academicRoutes.put("/subjects/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(subjectInputSchema.partial(), await c.req.json());
  const row = await svc.updateSubject(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  return ok(c, row);
});

academicRoutes.delete("/subjects/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteSubject(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, { action: "delete", entity: "subject", entityId: c.req.param("id") });
  return ok(c, { deleted: true });
});

/* Class ↔ subject allocations */
academicRoutes.get("/class-subjects", requirePermission("academic.view"), async (c) => {
  const q = parse(sectionQuery, c.req.query());
  return okList(c, await svc.listClassSubjects(c.get("db"), c.get("orgId")!, q.classId), 0, 1, 1000);
});

academicRoutes.post("/class-subjects", requirePermission("academic.create"), async (c) => {
  const input = parse(classSubjectInputSchema, await c.req.json());
  const row = await svc.createClassSubject(c.get("db"), c.get("orgId")!, input);
  return ok(c, row, 201);
});

academicRoutes.put("/class-subjects/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(classSubjectInputSchema.partial(), await c.req.json());
  return ok(c, await svc.updateClassSubject(c.get("db"), c.get("orgId")!, c.req.param("id"), input));
});

academicRoutes.delete("/class-subjects/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deleteClassSubject(c.get("db"), c.get("orgId")!, c.req.param("id"));
  return ok(c, { deleted: true });
});

/* Timetable periods */
academicRoutes.get("/periods", requirePermission("academic.view"), async (c) => {
  return okList(c, await svc.listPeriods(c.get("db"), c.get("orgId")!), 0, 1, 1000);
});

academicRoutes.post("/periods", requirePermission("academic.create"), async (c) => {
  const input = parse(timetablePeriodInputSchema, await c.req.json());
  const row = await svc.createPeriod(c.get("db"), c.get("orgId")!, input);
  return ok(c, row, 201);
});

academicRoutes.put("/periods/:id", requirePermission("academic.edit"), async (c) => {
  const input = parse(timetablePeriodInputSchema.partial(), await c.req.json());
  const row = await svc.updatePeriod(c.get("db"), c.get("orgId")!, c.req.param("id"), input);
  return ok(c, row);
});

academicRoutes.delete("/periods/:id", requirePermission("academic.delete"), async (c) => {
  await svc.deletePeriod(c.get("db"), c.get("orgId")!, c.req.param("id"));
  return ok(c, { deleted: true });
});
