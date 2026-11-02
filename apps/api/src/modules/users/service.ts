import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import type { DB } from "../../lib/types";
import type { AuthUser } from "../../lib/context";
import { employees, permissions, rolePermissions, roles, userRoles, users } from "../../db/schema";
import { hashPassword } from "../../lib/password";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../../lib/errors";
import type { EmployeeInput } from "@edu/shared";
import { hasLoginIdentifier, remainingActiveOwnerCount } from "./policy";

export type SaveUserInput = {
  name?: string;
  email?: string | null;
  username?: string | null;
  password?: string;
  avatarUrl?: string | null;
  status?: "active" | "inactive";
  employeeId?: string | null;
  roleIds?: string[];
};

const safe = { id: users.id, organisationId: users.organisationId, name: users.name, email: users.email, username: users.username, avatarUrl: users.avatarUrl, isPlatformAdmin: users.isPlatformAdmin, status: users.status, locale: users.locale, employeeId: users.employeeId, studentId: users.studentId, guardianId: users.guardianId, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, updatedAt: users.updatedAt };
export async function list(db: DB, orgId: string, filters: { search?: string; status?: string; employeeId?: string; roleId?: string } = {}) { const conditions = [eq(users.organisationId, orgId)]; if (filters.search?.trim()) { const search = `%${filters.search.trim()}%`; conditions.push(or(ilike(users.name, search), ilike(users.email, search), ilike(users.username, search))!); } if (filters.status && filters.status !== "all") conditions.push(eq(users.status, filters.status)); if (filters.employeeId) conditions.push(eq(users.employeeId, filters.employeeId)); const rows = await db.select(safe).from(users).where(and(...conditions)).orderBy(asc(users.name)); const assignments = await db.select({ userId: userRoles.userId, roleId: userRoles.roleId }).from(userRoles); return rows.map((row) => ({ ...row, roleIds: assignments.filter((assignment) => assignment.userId === row.id).map((assignment) => assignment.roleId) })).filter((row) => !filters.roleId || row.roleIds.includes(filters.roleId)); }
export async function listTeacherAccounts(db: DB, orgId: string) { return db.select({ id: users.id, name: users.name, employeeId: users.employeeId, employeeName: employees.fullName }).from(users).innerJoin(employees, eq(users.employeeId, employees.id)).where(and(eq(users.organisationId, orgId), eq(employees.status, "active"))).orderBy(asc(users.name)); }
export async function listEmployeeOptions(db: DB, orgId: string) { return db.select({ id: employees.id, employeeId: employees.employeeId, name: employees.fullName }).from(employees).where(and(eq(employees.organisationId, orgId), eq(employees.status, "active"))).orderBy(asc(employees.fullName)); }
export async function listEmployees(db: DB, orgId: string) { return db.select().from(employees).where(eq(employees.organisationId, orgId)).orderBy(asc(employees.fullName)); }
export async function saveEmployee(db: DB, orgId: string, id: string | undefined, input: EmployeeInput) {
  const values = { ...input, organisationId: orgId, photoUrl: input.photoUrl ?? null, department: input.department ?? null, designation: input.designation ?? null, joiningDate: input.joiningDate ?? null, qualification: input.qualification ?? null, phone: input.phone ?? null, email: input.email ?? null, emergencyContact: input.emergencyContact ?? null, salary: input.salary == null ? null : String(input.salary) } as typeof employees.$inferInsert;
  try {
    const [row] = id
      ? await db.update(employees).set(values).where(and(eq(employees.id, id), eq(employees.organisationId, orgId))).returning()
      : await db.insert(employees).values(values).returning();
    if (!row) throw notFound("Employee not found");
    if (row.status === "terminated") {
      await db.update(users).set({ status: "inactive" }).where(and(eq(users.organisationId, orgId), eq(users.employeeId, row.id)));
    }
    return row;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw conflict("Employee ID or email already exists");
    throw error;
  }
}
export async function removeEmployee(db: DB, orgId: string, id: string) {
  const [row] = await db.update(employees).set({ status: "terminated" }).where(and(eq(employees.id, id), eq(employees.organisationId, orgId))).returning({ id: employees.id });
  if (!row) throw notFound("Employee not found");
  await db.update(users).set({ status: "inactive" }).where(and(eq(users.organisationId, orgId), eq(users.employeeId, row.id)));
  return row;
}
export async function get(db: DB, orgId: string, id: string) { const [row] = await db.select(safe).from(users).where(and(eq(users.id, id), eq(users.organisationId, orgId))).limit(1); if (!row) throw notFound("User not found"); const assignments = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, row.id)); return { ...row, roleIds: assignments.map((assignment) => assignment.roleId) }; }

async function assertOwnerSafety(db: DB, orgId: string, actor: AuthUser, targetIds: string[], action: "remove" | "deactivate") {
  const [ownerRole] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.organisationId, orgId), eq(roles.key, "owner"))).limit(1);
  if (!ownerRole) return;
  const owners = await db.select({ userId: userRoles.userId, status: users.status }).from(userRoles).innerJoin(users, eq(userRoles.userId, users.id)).where(and(eq(userRoles.roleId, ownerRole.id), eq(users.organisationId, orgId)));
  const targets = owners.filter((owner) => targetIds.includes(owner.userId));
  if (!targets.length) return;
  const actorIsOwner = actor.isPlatformAdmin || actor.roles.includes("owner");
  if (!actorIsOwner) throw forbidden("Only an institution owner can remove or deactivate owner accounts");
  if (remainingActiveOwnerCount(owners, targetIds) < 1) {
    throw badRequest(`At least one active owner account must remain after this ${action === "remove" ? "deletion" : "change"}`);
  }
}

export async function save(db: DB, orgId: string, actor: AuthUser, id: string | undefined, input: SaveUserInput) {
  const roleIds = input.roleIds ? [...new Set(input.roleIds)] : undefined;
  let savedId: string;
  try {
    savedId = await db.transaction(async (tx) => {
      const [existing] = id ? await tx.select().from(users).where(and(eq(users.id, id), eq(users.organisationId, orgId))).limit(1) : [];
      if (id && !existing) throw notFound("User not found");
      if (id === actor.id && input.status === "inactive") throw badRequest("You cannot deactivate your own account");
      const nextEmail = input.email !== undefined ? input.email : existing?.email;
      const nextUsername = input.username !== undefined ? input.username : existing?.username;
      if (!hasLoginIdentifier(nextEmail, nextUsername)) throw badRequest("Email or username is required");
      if (input.employeeId) {
        const [employee] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.organisationId, orgId), eq(employees.status, "active"))).limit(1);
        if (!employee) throw badRequest("Select an active employee from this institution");
      }
      const orgRoles = await tx.select({ id: roles.id, key: roles.key }).from(roles).where(eq(roles.organisationId, orgId));
      const ownerRole = orgRoles.find((role) => role.key === "owner");
      const actorIsOwner = actor.isPlatformAdmin || actor.roles.includes("owner");
      let existingIsOwner = false;
      if (existing && ownerRole) {
        const [assignment] = await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(and(eq(userRoles.userId, existing.id), eq(userRoles.roleId, ownerRole.id))).limit(1);
        existingIsOwner = Boolean(assignment);
      }
      if (existingIsOwner && !actorIsOwner && existing.id !== actor.id) throw forbidden("Only an institution owner can edit another owner account");
      if (existingIsOwner && existing?.status === "active" && input.status === "inactive") {
        const owners = await tx.select({ userId: userRoles.userId, status: users.status }).from(userRoles).innerJoin(users, eq(userRoles.userId, users.id)).where(and(eq(userRoles.roleId, ownerRole!.id), eq(users.organisationId, orgId)));
        if (remainingActiveOwnerCount(owners, [existing.id]) < 1) throw badRequest("At least one active owner account must remain after this change");
      }
      if (roleIds) {
        if (orgRoles.filter((role) => roleIds.includes(role.id)).length !== roleIds.length) throw badRequest("One or more selected roles are invalid");
        if (ownerRole && roleIds.includes(ownerRole.id) && !actorIsOwner) throw forbidden("Only an institution owner can assign the owner role");
        if (ownerRole && existingIsOwner && !roleIds.includes(ownerRole.id)) {
          if (!actorIsOwner) throw forbidden("Only an institution owner can remove the owner role");
          if (existing.id === actor.id) throw badRequest("You cannot remove your own owner role");
          const owners = await tx.select({ userId: userRoles.userId }).from(userRoles).innerJoin(users, eq(userRoles.userId, users.id)).where(and(eq(userRoles.roleId, ownerRole.id), eq(users.organisationId, orgId), eq(users.status, "active")));
          if (owners.length <= 1) throw badRequest("At least one active owner account is required");
        }
      }

      const changes: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined) changes.name = input.name;
      if (input.email !== undefined) changes.email = input.email || null;
      if (input.username !== undefined) changes.username = input.username || null;
      if (input.avatarUrl !== undefined) changes.avatarUrl = input.avatarUrl || null;
      if (input.status !== undefined) changes.status = input.status;
      if (input.employeeId !== undefined) changes.employeeId = input.employeeId || null;
      if (input.password) {
        changes.passwordHash = await hashPassword(input.password);
        changes.mustChangePassword = id !== actor.id;
      }

      let rowId: string;
      if (id) {
        const [updated] = await tx.update(users).set(changes).where(and(eq(users.id, id), eq(users.organisationId, orgId))).returning({ id: users.id });
        if (!updated) throw notFound("User not found");
        rowId = updated.id;
      } else {
        if (!input.name?.trim() || !input.password) throw badRequest("Name and password are required");
        const [created] = await tx.insert(users).values({ name: input.name, email: input.email || null, username: input.username || null, avatarUrl: input.avatarUrl || null, status: input.status ?? "active", employeeId: input.employeeId || null, organisationId: orgId, passwordHash: await hashPassword(input.password), mustChangePassword: true }).returning({ id: users.id });
        rowId = created.id;
      }

      if (roleIds !== undefined) {
        await tx.delete(userRoles).where(eq(userRoles.userId, rowId));
        if (roleIds.length) await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: rowId, roleId })));
      }
      return rowId;
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if ((error as { code?: string }).code === "23505") throw conflict("Email, username, or employee link already exists");
    throw error;
  }
  return get(db, orgId, savedId);
}
export async function remove(db: DB, orgId: string, actor: AuthUser, id: string) {
  const [existing] = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, id), eq(users.organisationId, orgId))).limit(1);
  if (!existing) throw notFound("User not found");
  if (id === actor.id) throw badRequest("You cannot delete your own account");
  await assertOwnerSafety(db, orgId, actor, [id], "remove");
  await db.delete(users).where(and(eq(users.id, id), eq(users.organisationId, orgId)));
}
export async function bulkStatus(db: DB, orgId: string, actor: AuthUser, input: { ids: string[]; status: "active" | "inactive" }) {
  const ids = [...new Set(input.ids)];
  if (input.status === "inactive") {
    if (ids.includes(actor.id)) throw badRequest("You cannot deactivate your own account");
    await assertOwnerSafety(db, orgId, actor, ids, "deactivate");
  }
  const rows = await db.update(users).set({ status: input.status }).where(and(eq(users.organisationId, orgId), inArray(users.id, ids))).returning({ id: users.id });
  return { updated: rows.length };
}
export async function bulkRemove(db: DB, orgId: string, actor: AuthUser, input: { ids: string[] }) {
  const ids = [...new Set(input.ids)];
  if (ids.includes(actor.id)) throw badRequest("You cannot delete your own account");
  await assertOwnerSafety(db, orgId, actor, ids, "remove");
  const rows = await db.delete(users).where(and(eq(users.organisationId, orgId), inArray(users.id, ids))).returning({ id: users.id });
  return { deleted: rows.length };
}
export async function listRoles(db: DB, orgId: string) { return db.select().from(roles).where(eq(roles.organisationId, orgId)).orderBy(asc(roles.name)); }
export async function saveRole(db: DB, orgId: string, id: string | undefined, input: { name: string; description?: string | null; permissionIds?: string[]; key?: string }) { const { permissionIds, ...data } = input; const values = { ...data, organisationId: orgId } as typeof roles.$inferInsert; const row = id ? (await db.update(roles).set(data).where(and(eq(roles.id, id), eq(roles.organisationId, orgId), eq(roles.isSystem, false))).returning())[0] : (await db.insert(roles).values(values).returning())[0]; if (!row) throw notFound("Role not found"); if (permissionIds) { await db.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id)); if (permissionIds.length) await db.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId: row.id, permissionId }))); } return row; }
export async function removeRole(db: DB, orgId: string, id: string) { const rows = await db.delete(roles).where(and(eq(roles.id, id), eq(roles.organisationId, orgId), eq(roles.isSystem, false))).returning(); if (!rows.length) throw notFound("Role not found"); }
export async function listPermissions(db: DB) { return db.select().from(permissions).orderBy(asc(permissions.resource), asc(permissions.action)); }
