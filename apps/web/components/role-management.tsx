"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { useToast } from "./ui/toast";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TablePagination, TableRow, TableSkeleton } from "./ui/table";

type Role = { id: string; key: string; name: string; description?: string | null; isSystem: boolean; permissionIds: string[]; userCount: number };
type Permission = { id: string; resource: string; action: string; name: string };

export function RoleManagement({ permissions: actorPermissions, onRolesChanged }: { permissions: string[]; onRolesChanged?: () => void }) {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalogue, setCatalogue] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const canCreate = actorPermissions.includes("role.create");
  const canEdit = actorPermissions.includes("role.edit");
  const canDelete = actorPermissions.includes("role.delete");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [roleResult, permissionResult] = await Promise.all([
        api.get<{ data: Role[] }>("/roles"),
        api.get<{ data: Permission[] }>("/roles/permissions"),
      ]);
      setRoles(roleResult.data);
      setPage(1);
      setCatalogue(permissionResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load roles and permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void Promise.resolve().then(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => Object.entries(catalogue.reduce<Record<string, Permission[]>>((result, item) => {
    (result[item.resource] ??= []).push(item);
    return result;
  }, {})), [catalogue]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(roles.length / pageSize));
  const visibleRoles = roles.slice((page - 1) * pageSize, page * pageSize);

  function start(role?: Role) {
    setEditing(role ?? null);
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissionIds(role?.permissionIds ?? []);
    setError("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), description: description.trim() || null, permissionIds };
      await (editing ? api.put(`/roles/${editing.id}`, payload) : api.post("/roles", payload));
      toast.success(editing ? "Role updated" : "Role created", "Permission changes take effect on the user's next request.");
      close();
      await load();
      onRolesChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save role";
      setError(message);
      toast.error("Could not save role", message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: Role) {
    if (!window.confirm(`Delete the custom role “${role.name}”?`)) return;
    setSaving(true);
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success("Role deleted", `${role.name} was removed.`);
      await load();
      onRolesChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete role";
      setError(message);
      toast.error("Could not delete role", message);
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(items: Permission[]) {
    const ids = items.map((item) => item.id);
    const all = ids.every((id) => permissionIds.includes(id));
    setPermissionIds((current) => all ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h3 className="text-xl font-semibold">Roles and permissions</h3><p className="mt-1 text-sm text-slate-500">Use system roles as safe defaults and create custom roles for institution-specific responsibilities.</p></div>
        {canCreate && <Button onClick={() => start()}><Plus size={16} />Create custom role</Button>}
      </div>
      {error && <Alert tone="error" title="Roles and permissions" onDismiss={() => setError("")}>{error}</Alert>}
      <Card>
        <CardContent className="p-0">
          <Table stack>
            <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Users</TableHead><TableHead>Permissions</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={6} /> : roles.length === 0 ? <TableEmpty colSpan={6}>No roles found.</TableEmpty> : visibleRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell label="Role"><p className="font-semibold text-slate-900">{role.name}</p><p className="mt-0.5 text-xs text-slate-400">{role.key}</p></TableCell>
                  <TableCell label="Type"><Badge tone={role.isSystem ? "blue" : "slate"}>{role.isSystem ? "System" : "Custom"}</Badge></TableCell>
                  <TableCell label="Description" className="max-w-sm text-slate-500">{role.description || "No description provided."}</TableCell>
                  <TableCell label="Users">{role.userCount}</TableCell>
                  <TableCell label="Permissions">{role.permissionIds.length}</TableCell>
                  <TableCell label="Actions" className="text-right">{!role.isSystem && <span className="inline-flex gap-1">{canEdit && <Button size="sm" variant="ghost" onClick={() => start(role)}><Pencil size={14} />Edit</Button>}{canDelete && <Button size="sm" variant="ghost" disabled={saving || role.userCount > 0} title={role.userCount ? "Remove this role from all users first" : undefined} onClick={() => void remove(role)}><Trash2 size={14} />Delete</Button>}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} onChange={setPage} summary={`${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, roles.length)} of ${roles.length} roles`} />
        </CardContent>
      </Card>
      <Modal open={open} title={editing ? "Edit custom role" : "Create custom role"} description="Select only the access needed for this responsibility." onClose={close} size="lg" footer={<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" form="role-form" disabled={saving}>{saving ? "Saving..." : "Save role"}</Button></div>}>
        <form id="role-form" onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Role name</span><Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={60} /></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Description</span><Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} /></label></div>
          <div><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium text-slate-700">Permissions</span><span className="text-xs text-slate-500">{permissionIds.length} selected</span></div><div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">{groups.map(([resource, items]) => items && <div key={resource} className="rounded-xl border border-slate-200 p-3"><div className="mb-3 flex items-center justify-between"><p className="font-medium capitalize text-slate-900">{resource}</p><Button type="button" size="sm" variant="ghost" onClick={() => toggleGroup(items)}>{items.every((item) => permissionIds.includes(item.id)) ? "Clear" : "Select all"}</Button></div><div className="flex flex-wrap gap-2">{items.map((item) => <label key={item.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${permissionIds.includes(item.id) ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-100 bg-slate-50 text-slate-600"}`}><input type="checkbox" checked={permissionIds.includes(item.id)} onChange={() => setPermissionIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />{item.action}</label>)}</div></div>)}</div></div>
        </form>
      </Modal>
    </div>
  );
}
