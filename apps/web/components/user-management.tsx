"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Filter, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { CloudinaryUpload } from "./cloudinary-upload";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { BulkBar, downloadSelectedCsv } from "./table-tools";

type User = { id: string; name: string; email?: string | null; username?: string | null; avatarUrl?: string | null; status: string; employeeId?: string | null; roleIds?: string[] };
type Role = { id: string; name: string; key: string };
type Employee = { id: string; employeeId: string; name: string };
type Form = { name: string; email: string; username: string; password: string; avatarUrl: string; status: string; employeeId: string; roleIds: string[] };
const emptyForm: Form = { name: "", email: "", username: "", password: "", avatarUrl: "", status: "active", employeeId: "", roleIds: [] };

export function UserManagement() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
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
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load users"); } finally { setLoading(false); }
  }

  useEffect(() => {
    void Promise.all([api.get<{ data: Role[] }>("/roles"), api.get<{ data: Employee[] }>("/users/employees")]).then(([roleResult, employeeResult]) => { setRoles(roleResult.data); setEmployees(employeeResult.data); }).catch(() => undefined);
    void Promise.resolve().then(() => load());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function start(user?: User) { setShowForm(true); setEditing(user ?? null); setForm({ name: user?.name ?? "", email: user?.email ?? "", username: user?.username ?? "", password: "", avatarUrl: user?.avatarUrl ?? "", status: user?.status ?? "active", employeeId: user?.employeeId ?? "", roleIds: user?.roleIds ?? [] }); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm); }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { await (editing ? api.put(`/users/${editing.id}`, form) : api.post("/users", form)); closeForm(); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save user"); } finally { setSaving(false); } }
  async function bulkStatus(nextStatus: "active" | "inactive") { setBulkBusy(true); setError(""); try { await api.post("/users/bulk/status", { ids: selectedIds, status: nextStatus }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update users"); } finally { setBulkBusy(false); } }
  async function bulkDelete(ids = selectedIds) { if (!ids.length || !window.confirm(`Delete ${ids.length} selected user account${ids.length === 1 ? "" : "s"}?`)) return; setBulkBusy(true); setError(""); try { await api.post("/users/bulk/delete", { ids }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete users"); } finally { setBulkBusy(false); } }
  function toggleRole(id: string) { setForm((current) => ({ ...current, roleIds: current.roleIds.includes(id) ? current.roleIds.filter((role) => role !== id) : [...current.roleIds, id] })); }
  const allSelected = users.length > 0 && selectedIds.length === users.length;
  function toggleAll() { setSelectedIds(allSelected ? [] : users.map((user) => user.id)); }
  function exportSelected() { downloadSelectedCsv("selected-users.csv", ["Name", "Email", "Username", "Status"], users.filter((user) => selectedIds.includes(user.id)).map((user) => [user.name, user.email, user.username, user.status])); }

  return <div className="space-y-6"><BulkBar count={selectedIds.length} onExport={exportSelected} onClear={() => setSelectedIds([])} />
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-blue-600">Access control</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">User management</h2><p className="mt-2 text-sm text-slate-500">Create accounts, profile images, roles, and employee links.</p></div><Button onClick={() => start()}><Plus size={16} />Create user</Button></div>
    {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {showForm && <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{editing ? "Edit user" : "Create user"}</CardTitle><Button size="sm" variant="ghost" onClick={closeForm}><X size={16} /></Button></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2"><Input placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Input placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /><Input type="password" placeholder={editing ? "New password (optional)" : "Password (optional)"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><CloudinaryUpload folder="users" accept="image/*" value={form.avatarUrl} onChange={(avatarUrl) => setForm({ ...form, avatarUrl })} label="Upload profile image" /><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select><select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">No employee link</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employeeId})</option>)}</select><div className="rounded-xl border border-slate-200 p-3 md:col-span-2"><p className="mb-2 text-sm font-medium">Roles</p><div className="flex flex-wrap gap-2">{roles.map((role) => <label key={role.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />{role.name}</label>)}</div></div><div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create user"}</Button><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button></div></form></CardContent></Card>}
    <Card><CardHeader className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle>Accounts</CardTitle><p className="mt-1 text-sm text-slate-500">{users.length} matching account{users.length === 1 ? "" : "s"}</p></div>{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600">{selectedIds.length} selected</span><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("active")}><Check size={14} />Activate</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("inactive")}>Deactivate</Button><Button size="sm" variant="danger" disabled={bulkBusy} onClick={() => void bulkDelete()}><Trash2 size={14} />Delete</Button></div>}</div><form className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_180px_180px_auto]" onSubmit={(event) => { event.preventDefault(); void load(); }}><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="pl-9" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">All employee links</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><Button type="submit" variant="outline" disabled={loading}><Filter size={15} />Filter</Button></form></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead><input aria-label="Select all users" type="checkbox" checked={allSelected} onChange={toggleAll} /></TableHead><TableHead>User</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead>Employee</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell><input aria-label={`Select ${user.name}`} type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => setSelectedIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /></TableCell><TableCell><div className="flex items-center gap-3">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{user.name[0] ?? "U"}</div>}<div><div className="font-medium text-slate-900">{user.name}</div><div className="text-xs text-slate-400">{user.email ?? user.username ?? "No email"}</div></div></div></TableCell><TableCell>{user.roleIds?.length ? `${user.roleIds.length} role${user.roleIds.length === 1 ? "" : "s"}` : "No roles"}</TableCell><TableCell><Badge tone={user.status === "active" ? "green" : "slate"}>{user.status}</Badge></TableCell><TableCell>{employees.find((employee) => employee.id === user.employeeId)?.name ?? "Not linked"}</TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="ghost" aria-label={`Edit ${user.name}`} onClick={() => start(user)}><Pencil size={15} /></Button><Button size="sm" variant="ghost" aria-label={`Delete ${user.name}`} onClick={() => { setSelectedIds([user.id]); void bulkDelete(); }}><Trash2 size={15} /></Button></div></TableCell></TableRow>)}</TableBody></Table>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading users...</p> : !users.length && <p className="p-8 text-center text-sm text-slate-500">No users match these filters.</p>}</CardContent></Card>
  </div>;
}
