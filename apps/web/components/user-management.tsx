"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Filter, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { EduApiClient } from "@edu/api-client";
import { CloudinaryUpload } from "./cloudinary-upload";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useToast } from "./ui/toast";
import { BulkBar, downloadSelectedCsv } from "./table-tools";
import { RoleManagement } from "./role-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type User = { id: string; name: string; email?: string | null; username?: string | null; avatarUrl?: string | null; status: string; employeeId?: string | null; roleIds?: string[]; mustChangePassword?: boolean };
type Role = { id: string; name: string; key: string; permissionKeys?: string[] };
type Employee = { id: string; employeeId: string; name: string };
type Form = { name: string; email: string; username: string; password: string; avatarUrl: string; status: string; employeeId: string; roleIds: string[] };
type DeleteTarget = { ids: string[]; names: string[]; owners: string[]; includesSelf: boolean };
type ResetTarget = { id: string; name: string };

const emptyForm: Form = { name: "", email: "", username: "", password: "", avatarUrl: "", status: "active", employeeId: "", roleIds: [] };

function readCurrentUserId() {
  try {
    return (JSON.parse(localStorage.getItem("edu_user") ?? "null") as { id?: string } | null)?.id;
  } catch {
    return undefined;
  }
}

export function UserManagement({ permissions, roles: actorRoles }: { permissions: string[]; roles: string[] }) {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleId, setRoleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const [metaError, setMetaError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const canCreate = permissions.includes("user.create");
  const canEdit = permissions.includes("user.edit");
  const canDelete = permissions.includes("user.delete");
  const canManageRoles = permissions.some((permission) => permission.startsWith("role."));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (roleId) params.set("roleId", roleId);
      if (employeeId) params.set("employeeId", employeeId);
      const result = await api.get<{ data: User[] }>(`/users${params.size ? `?${params}` : ""}`);
      setUsers(result.data);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([api.get<{ data: Role[] }>("/roles"), api.get<{ data: Employee[] }>("/users/employees")])
      .then(([roleResult, employeeResult]) => {
        setRoles(roleResult.data);
        setEmployees(employeeResult.data);
      })
      .catch((err: unknown) => setMetaError(err instanceof Error ? err.message : "Unable to load roles or employee links"));
    void Promise.resolve().then(load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function start(user?: User) {
    setEditing(user ?? null);
    setForm({
      name: user?.name ?? "",
      email: user?.email ?? "",
      username: user?.username ?? "",
      password: "",
      avatarUrl: user?.avatarUrl ?? "",
      status: user?.status ?? "active",
      employeeId: user?.employeeId ?? "",
      roleIds: user?.roleIds ?? [],
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.email.trim() && !form.username.trim()) {
      setError("Enter an email address or a username.");
      return;
    }
    if (!editing && form.password.length < 8) {
      setError("A password of at least 8 characters is required for a new account.");
      return;
    }
    if (form.password && form.password.length < 8) {
      setError("Passwords must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      username: form.username.trim() || null,
      avatarUrl: form.avatarUrl || null,
      status: form.status,
      employeeId: form.employeeId || null,
      roleIds: form.roleIds,
      ...(!editing ? { password: form.password } : {}),
    };
    try {
      await (editing ? api.put(`/users/${editing.id}`, payload) : api.post("/users", payload));
      toast.success(editing ? "User updated" : "User created", form.name || "The account has been saved.");
      closeForm();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save user";
      setError(message);
      toast.error("Could not save user", message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { password: resetPassword, reason: resetReason });
      toast.success("Temporary password set", `${resetTarget.name} must choose a new password at the next sign-in. Existing sessions were revoked.`);
      setResetTarget(null);
      setResetPassword("");
      setResetReason("");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reset password";
      setError(message);
      toast.error("Could not reset password", message);
    } finally {
      setSaving(false);
    }
  }

  async function bulkStatus(nextStatus: "active" | "inactive") {
    setBulkBusy(true);
    setError("");
    try {
      await api.post("/users/bulk/status", { ids: selectedIds, status: nextStatus });
      toast.success(`Users ${nextStatus === "active" ? "activated" : "deactivated"}`, `${selectedIds.length} account${selectedIds.length === 1 ? "" : "s"} updated.`);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update users";
      setError(message);
      toast.error("Could not update users", message);
    } finally {
      setBulkBusy(false);
    }
  }

  function requestDelete(ids: string[], names: string[]) {
    const ownerRoleIds = new Set(roles.filter((role) => role.key === "owner").map((role) => role.id));
    const owners = users.filter((user) => ids.includes(user.id) && user.roleIds?.some((id) => ownerRoleIds.has(id))).map((user) => user.name);
    const currentUserId = readCurrentUserId();
    setDeleteTarget({ ids, names, owners, includesSelf: Boolean(currentUserId && ids.includes(currentUserId)) });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteTarget.includesSelf) return;
    const ids = deleteTarget.ids;
    setDeleteTarget(null);
    setBulkBusy(true);
    setError("");
    try {
      await api.post("/users/bulk/delete", { ids });
      toast.success("Users deleted", `${ids.length} account${ids.length === 1 ? "" : "s"} removed.`);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete users";
      setError(message);
      toast.error("Could not delete users", message);
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleRole(id: string) {
    setForm((current) => ({ ...current, roleIds: current.roleIds.includes(id) ? current.roleIds.filter((role) => role !== id) : [...current.roleIds, id] }));
  }

  function canAssignRole(role: Role) {
    if (role.key === "owner") return actorRoles.includes("owner");
    return (role.permissionKeys ?? []).every((permission) => permissions.includes(permission)) || actorRoles.includes("owner");
  }

  const allSelected = users.length > 0 && selectedIds.length === users.length;
  function toggleAll() {
    setSelectedIds(allSelected ? [] : users.map((user) => user.id));
  }

  function exportSelected() {
    downloadSelectedCsv("selected-users.csv", ["Name", "Email", "Username", "Status"], users.filter((user) => selectedIds.includes(user.id)).map((user) => [user.name, user.email, user.username, user.status]));
  }

  function roleNames(user: User) {
    const names = (user.roleIds ?? []).map((id) => roles.find((role) => role.id === id)?.name).filter(Boolean);
    return names.length ? names.join(", ") : "No roles";
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="accounts"><TabsList ariaLabel="Access control sections"><TabsTrigger value="accounts">User accounts</TabsTrigger>{canManageRoles && <TabsTrigger value="roles">Roles & permissions</TabsTrigger>}</TabsList>{canManageRoles && <TabsContent value="roles"><RoleManagement permissions={permissions} onRolesChanged={() => { void Promise.all([api.get<{ data: Role[] }>("/roles").then((result) => setRoles(result.data)), load()]); }} /></TabsContent>}<TabsContent value="accounts">
      <BulkBar count={selectedIds.length} onExport={exportSelected} onClear={() => setSelectedIds([])} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Access control</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">User management</h2>
          <p className="mt-2 text-sm text-slate-500">Create accounts, assign roles, link staff profiles, and control access.</p>
        </div>
        {canCreate && <Button onClick={() => start()}><Plus size={16} />Create user</Button>}
      </div>

      {error && <Alert tone="error" title="User management" onDismiss={() => setError("")}>{error}</Alert>}
      {metaError && <Alert tone="warning" title="Some options could not load" onDismiss={() => setMetaError("")}>{metaError}. Roles and employee links may be incomplete.</Alert>}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Accounts</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{users.length} matching account{users.length === 1 ? "" : "s"}</p>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600">{selectedIds.length} selected</span>
                {canEdit && <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("active")}><Check size={14} />Activate</Button>}
                {canEdit && <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("inactive")}>Deactivate</Button>}
                {canDelete && <Button size="sm" variant="danger" disabled={bulkBusy} onClick={() => requestDelete(selectedIds, users.filter((user) => selectedIds.includes(user.id)).map((user) => user.name))}><Trash2 size={14} />Delete</Button>}
              </div>
            )}
          </div>
          <form className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_180px_180px_auto]" onSubmit={(event) => { event.preventDefault(); void load(); }}>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or username" className="pl-9" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All roles</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All employee links</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" disabled={loading}><Filter size={15} />Filter</Button>
              <Button type="button" variant="ghost" onClick={() => { setSearch(""); setStatus("all"); setRoleId(""); setEmployeeId(""); void Promise.resolve().then(() => load()); }}>Clear</Button>
            </div>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table stack>
            <TableHeader>
              <TableRow>
                <TableHead><input aria-label="Select all users" type="checkbox" checked={allSelected} onChange={toggleAll} /></TableHead>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell label="Select"><input aria-label={`Select ${user.name}`} type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => setSelectedIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /></TableCell>
                  <TableCell label="User">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{user.name[0] ?? "U"}</div>}
                      <div>
                        <div className="font-medium text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.email ?? user.username ?? "No email"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell label="Roles"><span className="text-sm text-slate-600">{roleNames(user)}</span></TableCell>
                  <TableCell label="Status"><div className="flex flex-wrap gap-1"><Badge tone={user.status === "active" ? "green" : "slate"}>{user.status}</Badge>{user.mustChangePassword && <Badge tone="amber">Password change required</Badge>}</div></TableCell>
                  <TableCell label="Employee">{employees.find((employee) => employee.id === user.employeeId)?.name ?? "Not linked"}</TableCell>
                  <TableCell label="Actions">
                    <div className="flex gap-1">
                      {canEdit && <Button size="sm" variant="ghost" aria-label={`Edit ${user.name}`} onClick={() => start(user)}><Pencil size={15} /></Button>}
                      {canEdit && user.id !== readCurrentUserId() && <Button size="sm" variant="ghost" aria-label={`Reset password for ${user.name}`} onClick={() => setResetTarget({ id: user.id, name: user.name })}><KeyRound size={15} /></Button>}
                      {canDelete && <Button size="sm" variant="ghost" aria-label={`Delete ${user.name}`} onClick={() => requestDelete([user.id], [user.name])}><Trash2 size={15} /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading users...</p> : !users.length && <p className="p-8 text-center text-sm text-slate-500">No users match these filters.</p>}
        </CardContent>
      </Card>

      <Modal
        open={showForm}
        title={editing ? "Edit user" : "Create user"}
        description={editing ? "Update the account, roles, and staff link." : "Create a login and assign the permissions this person needs."}
        onClose={closeForm}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="user-form" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create user"}</Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Full name</span><Input placeholder="e.g. Anita Sharma" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={120} /></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email</span><Input type="email" placeholder="name@school.edu" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">Email or username is required.</span></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Username</span><Input placeholder="anita.sharma" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} minLength={3} maxLength={60} /></label>
          {!editing && <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Temporary password</span><Input type="password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">The user must replace this temporary password after their first sign-in.</span></label>}
          <div className="md:col-span-2"><CloudinaryUpload folder="users" accept="image/*" value={form.avatarUrl} onChange={(avatarUrl) => setForm({ ...form, avatarUrl })} label="Upload profile image" /></div>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee link</span><select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">No employee link</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employeeId})</option>)}</select></label>
          <div className="rounded-xl border border-slate-200 p-3 md:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">Roles</p>
            <p className="mb-3 text-xs text-slate-500">Roles decide which screens and actions are available. Only an owner can assign the owner role.</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role.id} title={canAssignRole(role) ? undefined : "This role grants permissions you cannot assign"} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.roleIds.includes(role.id) ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-100 bg-slate-50 text-slate-700"} ${canAssignRole(role) ? "" : "cursor-not-allowed opacity-50"}`}>
                  <input type="checkbox" checked={form.roleIds.includes(role.id)} disabled={!canAssignRole(role)} onChange={() => toggleRole(role.id)} />{role.name}
                </label>
              ))}
              {!roles.length && <span className="text-sm text-slate-500">No roles available.</span>}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        title="Reset user password"
        description={resetTarget ? `Set a temporary password for ${resetTarget.name}. All existing sessions will be signed out.` : undefined}
        onClose={() => { setResetTarget(null); setResetPassword(""); setResetReason(""); }}
        footer={<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button><Button type="submit" form="password-reset-form" disabled={saving}>{saving ? "Resetting..." : "Reset password"}</Button></div>}
      >
        <form id="password-reset-form" onSubmit={confirmPasswordReset} className="space-y-4">
          <Alert tone="warning" title="Security-sensitive action">The user will be required to choose a private password before accessing the ERP again.</Alert>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Temporary password</span><Input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" /></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Reason for reset</span><Input value={resetReason} onChange={(event) => setResetReason(event.target.value)} required minLength={3} maxLength={300} placeholder="e.g. User reported a compromised password" /></label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={deleteTarget && deleteTarget.ids.length > 1 ? `Delete ${deleteTarget.ids.length} accounts?` : "Delete user account?"}
        description="Use deactivation for normal offboarding. Permanent deletion is only for accounts created by mistake and removes access immediately."
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" disabled={bulkBusy || Boolean(deleteTarget?.includesSelf)} onClick={() => void confirmDelete()}>{bulkBusy ? "Deleting..." : "Delete"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{deleteTarget?.ids.length === 1 ? <>Delete <strong>{deleteTarget.names[0]}</strong>?</> : <>Delete these accounts: <strong>{deleteTarget?.names.join(", ")}</strong>?</>}</p>
          {deleteTarget?.includesSelf && <Alert tone="warning" title="Your own account is selected">Remove your own account from the selection before deleting.</Alert>}
          {deleteTarget?.owners.length ? <Alert tone="warning" title="Owner accounts are protected">This selection includes {deleteTarget.owners.join(", ")}. Only an owner can delete another owner, and at least one active owner must remain.</Alert> : null}
        </div>
      </Modal>
      </TabsContent></Tabs>
    </div>
  );
}
