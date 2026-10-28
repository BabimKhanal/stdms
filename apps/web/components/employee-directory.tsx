"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  staffType: string;
  employmentType: string;
  phone: string | null;
  email: string | null;
  status: string;
};

type Form = {
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  staffType: string;
  employmentType: string;
  phone: string;
  email: string;
  status: string;
};

const emptyForm: Form = {
  employeeId: "",
  fullName: "",
  department: "",
  designation: "",
  staffType: "teaching",
  employmentType: "full_time",
  phone: "",
  email: "",
  status: "active",
};

export function EmployeeDirectory() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [rows, setRows] = useState<Employee[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const result = await api.get<{ data: Employee[] }>("/users/employees/all");
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load staff");
    }
  }

  // Initial data load synchronizes this screen with the API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function start(row?: Employee) {
    setEditing(row?.id ?? null);
    setForm(row ? { ...emptyForm, employeeId: row.employeeId, fullName: row.fullName, department: row.department ?? "", designation: row.designation ?? "", staffType: row.staffType, employmentType: row.employmentType, phone: row.phone ?? "", email: row.email ?? "", status: row.status } : emptyForm);
    setShowForm(true);
  }

  function update(name: keyof Form, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = { ...form, department: form.department || null, designation: form.designation || null, phone: form.phone || null, email: form.email || null };
      if (editing) await api.put(`/users/employees/${editing}`, payload);
      else await api.post("/users/employees", payload);
      setEditing(null);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save staff profile");
    }
  }

  async function remove(id: string) {
    try { await api.delete(`/users/employees/${id}`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to deactivate staff profile"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-blue-600">People operations</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Staff profiles</h2><p className="mt-2 text-sm text-slate-500">Maintain teaching and non-teaching employee records separately from login accounts.</p></div>
        <Button onClick={() => start()}><Plus size={16} />Add staff member</Button>
      </div>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {showForm && <Card><CardHeader><CardTitle>{editing ? "Edit staff profile" : "New staff profile"}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><Input placeholder="Employee ID" value={form.employeeId} onChange={(event) => update("employeeId", event.target.value)} required /><Input placeholder="Full name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required /><Input placeholder="Department" value={form.department} onChange={(event) => update("department", event.target.value)} /><Input placeholder="Designation" value={form.designation} onChange={(event) => update("designation", event.target.value)} /><Input placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} /><Input type="email" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} /><select value={form.staffType} onChange={(event) => update("staffType", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="teaching">Teaching</option><option value="non_teaching">Non-teaching</option><option value="support">Support</option><option value="administrative">Administrative</option></select><select value={form.employmentType} onChange={(event) => update("employmentType", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="probation">Probation</option></select>{editing && <select value={form.status} onChange={(event) => update("status", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="active">Active</option><option value="on_leave">On leave</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option></select>}<div className="flex gap-2"><Button type="submit">Save profile</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div></form></CardContent></Card>}
      <Card><CardHeader><CardTitle>{rows.length} staff profile{rows.length === 1 ? "" : "s"}</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <p className="text-sm text-slate-500">No staff profiles yet.</p> : <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{row.fullName} <span className="text-xs font-normal text-slate-400">{row.employeeId}</span></p><p className="text-sm text-slate-500">{row.designation ?? row.staffType} · {row.department ?? "No department"} · {row.status}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => start(row)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void remove(row.id)}><Trash2 size={14} />Deactivate</Button></div></div>)}</div>}</CardContent></Card>
    </div>
  );
}
