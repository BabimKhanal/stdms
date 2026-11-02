import { Hono, type Context } from "hono";
import { z } from "zod";
import { paginationQuerySchema, idSchema } from "@edu/shared";
import { employeeInputSchema } from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import * as svc from "./service";
import { writeAudit } from "../../lib/audit";
import { revokeAllSessions } from "../auth/session";

const db = (c: Context<AppEnv>) => c.get("db");
const org = (c: Context<AppEnv>) => c.get("orgId")!;
const actor = (c: Context<AppEnv>) => c.get("user")!;
const id = (value: string) => parse(idSchema, value);

const userFields = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).nullable().optional(),
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores, or hyphens").nullable().optional(),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  employeeId: z.uuid().nullable().optional(),
  roleIds: z.array(z.uuid()).max(30).optional(),
});
const userCreateInput = userFields.extend({ password: z.string().min(8).max(200) }).strict().refine((value) => Boolean(value.email || value.username), { message: "Email or username is required", path: ["email"] });
const userUpdateInput = userFields.partial().strict();
const passwordResetInput = z.object({ password: z.string().min(8).max(200), reason: z.string().trim().min(3).max(300) }).strict();
const roleInput = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(200).nullable().optional(), permissionIds: z.array(z.uuid()).max(500).optional(), key: z.string().trim().regex(/^[a-z0-9_]+$/).max(60).optional() }).strict();
const roleUpdateInput = roleInput.omit({ key: true });

export const userRoutes = new Hono<AppEnv>(); userRoutes.use("*", requireAuth, requireOrg);
userRoutes.get("/", requirePermission("user.view"), async (c) => okList(c, await svc.list(db(c), org(c), { search: c.req.query("search"), status: c.req.query("status"), employeeId: c.req.query("employeeId"), roleId: c.req.query("roleId") }), 0, 1, 1000));
userRoutes.get("/teachers", requirePermission("user.view"), async (c) => okList(c, await svc.listTeacherAccounts(db(c), org(c)), 0, 1, 1000));
userRoutes.get("/employees", requirePermission("user.view"), async (c) => okList(c, await svc.listEmployeeOptions(db(c), org(c)), 0, 1, 1000));
userRoutes.get("/employees/all", requirePermission("employee.view"), async (c) => okList(c, await svc.listEmployees(db(c), org(c)), 0, 1, 1000));
userRoutes.post("/employees", requirePermission("employee.create"), async (c) => { const input = parse(employeeInputSchema, await c.req.json()); const row = await svc.saveEmployee(db(c), org(c), undefined, input); await writeAudit(c, { action: "create", entity: "employee", entityId: row.id, newValue: input }); return ok(c, row, 201); });
userRoutes.put("/employees/:id", requirePermission("employee.edit"), async (c) => { const input = parse(employeeInputSchema.partial(), await c.req.json()); const row = await svc.saveEmployee(db(c), org(c), id(c.req.param("id")), input as never); await writeAudit(c, { action: "update", entity: "employee", entityId: row.id, newValue: input }); return ok(c, row); });
userRoutes.delete("/employees/:id", requirePermission("employee.delete"), async (c) => { const row = await svc.removeEmployee(db(c), org(c), id(c.req.param("id"))); await writeAudit(c, { action: "deactivate", entity: "employee", entityId: row.id }); return ok(c, row); });
userRoutes.post("/", requirePermission("user.create"), async (c) => {
  const input = parse(userCreateInput, await c.req.json());
  const row = await svc.save(db(c), org(c), actor(c), undefined, input);
  await writeAudit(c, { action: "create", entity: "user", entityId: row.id, newValue: { name: row.name, email: row.email, username: row.username, status: row.status, employeeId: row.employeeId, roleIds: row.roleIds } });
  return ok(c, row, 201);
});
userRoutes.put("/:id", requirePermission("user.edit"), async (c) => {
  const userId = id(c.req.param("id"));
  const before = await svc.get(db(c), org(c), userId);
  const input = parse(userUpdateInput, await c.req.json());
  const row = await svc.save(db(c), org(c), actor(c), userId, input);
  await writeAudit(c, { action: "update", entity: "user", entityId: row.id, oldValue: { name: before.name, email: before.email, username: before.username, status: before.status, employeeId: before.employeeId, roleIds: before.roleIds }, newValue: { name: row.name, email: row.email, username: row.username, status: row.status, employeeId: row.employeeId, roleIds: row.roleIds } });
  return ok(c, row);
});
userRoutes.post("/:id/reset-password", requirePermission("user.edit"), async (c) => {
  const userId = id(c.req.param("id"));
  const input = parse(passwordResetInput, await c.req.json());
  await revokeAllSessions(userId);
  const row = await svc.resetPassword(db(c), org(c), actor(c), userId, input.password);
  await writeAudit(c, { action: "reset_password", entity: "user", entityId: userId, newValue: { reason: input.reason, sessionsRevoked: true } });
  return ok(c, { id: row.id, mustChangePassword: true, sessionsRevoked: true });
});
userRoutes.delete("/:id", requirePermission("user.delete"), async (c) => {
  const userId = id(c.req.param("id"));
  const target = await svc.get(db(c), org(c), userId);
  await svc.remove(db(c), org(c), actor(c), userId);
  await writeAudit(c, { action: "delete", entity: "user", entityId: userId, oldValue: { name: target.name, email: target.email, status: target.status, roleIds: target.roleIds } });
  return ok(c, { deleted: true });
});
const bulkStatus = z.object({ ids: z.array(z.uuid()).min(1).max(500), status: z.enum(["active", "inactive"]) });
const bulkDelete = z.object({ ids: z.array(z.uuid()).min(1).max(500) });
userRoutes.post("/bulk/status", requirePermission("user.edit"), async (c) => {
  const input = parse(bulkStatus, await c.req.json());
  const result = await svc.bulkStatus(db(c), org(c), actor(c), input);
  await writeAudit(c, { action: input.status === "active" ? "activate" : "deactivate", entity: "user", newValue: input });
  return ok(c, result);
});
userRoutes.post("/bulk/delete", requirePermission("user.delete"), async (c) => {
  const input = parse(bulkDelete, await c.req.json());
  const result = await svc.bulkRemove(db(c), org(c), actor(c), input);
  await writeAudit(c, { action: "delete", entity: "user", newValue: input });
  return ok(c, result);
});

export const roleRoutes = new Hono<AppEnv>(); roleRoutes.use("*", requireAuth, requireOrg);
roleRoutes.get("/", requirePermission("user.view"), async (c) => okList(c, await svc.listRoles(db(c), org(c)), 0, 1, 1000));
roleRoutes.post("/", requirePermission("role.create"), async (c) => {
  const input = parse(roleInput, await c.req.json());
  const row = await svc.saveRole(db(c), org(c), actor(c), undefined, input);
  await writeAudit(c, { action: "create", entity: "role", entityId: row.id, newValue: { name: row.name, key: row.key } });
  return ok(c, row, 201);
});
roleRoutes.put("/:id", requirePermission("role.edit"), async (c) => {
  const input = parse(roleUpdateInput, await c.req.json());
  const row = await svc.saveRole(db(c), org(c), actor(c), id(c.req.param("id")), input);
  await writeAudit(c, { action: "update", entity: "role", entityId: row.id, newValue: { name: row.name, description: row.description } });
  return ok(c, row);
});
roleRoutes.delete("/:id", requirePermission("role.delete"), async (c) => {
  const roleId = id(c.req.param("id"));
  await svc.removeRole(db(c), org(c), roleId);
  await writeAudit(c, { action: "delete", entity: "role", entityId: roleId });
  return ok(c, { deleted: true });
});
roleRoutes.get("/permissions", requirePermission("user.view"), async (c) => okList(c, await svc.listPermissions(db(c)), 0, 1, 1000));
void paginationQuerySchema;
