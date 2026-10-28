"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { CloudinaryUpload } from "./cloudinary-upload";

type Method = { id: string; method: string; label: string; enabled: number; instructions: string | null; bankName: string | null; accountName: string | null; accountNumber: string | null; branch: string | null; qrImageUrl: string | null };
type Form = { label: string; method: string; bankName: string; accountName: string; accountNumber: string; branch: string; qrImageUrl: string; instructions: string };
const emptyForm: Form = { label: "Bank transfer", method: "bank", bankName: "", accountName: "", accountNumber: "", branch: "", qrImageUrl: "", instructions: "" };

export function PaymentSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [methods, setMethods] = useState<Method[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const result = await api.get<{ data: Method[] }>("/fees/payment-methods");
      setMethods(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment methods");
    }
  }

  useEffect(() => { void api.get<{ data: Method[] }>("/fees/payment-methods").then((result) => setMethods(result.data)).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load payment methods")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(method: Method) {
    setEditingId(method.id);
    setForm({ label: method.label, method: method.method, bankName: method.bankName ?? "", accountName: method.accountName ?? "", accountNumber: method.accountNumber ?? "", branch: method.branch ?? "", qrImageUrl: method.qrImageUrl ?? "", instructions: method.instructions ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, enabled: true, qrImageUrl: form.qrImageUrl || null, instructions: form.instructions || null };
      if (editingId) await api.put(`/fees/payment-methods/${editingId}`, payload);
      else await api.post("/fees/payment-methods", payload);
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save payment method");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(method: Method) {
    try {
      await api.put(`/fees/payment-methods/${method.id}`, { enabled: !method.enabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payment method");
    }
  }

  function update(name: keyof Form, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-blue-600">Finance configuration</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Payment methods</h2><p className="mt-2 text-sm text-slate-500">Add, edit, and enable the bank, QR, and manual payment instructions families see on their invoices.</p></div>
    {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <Card>
      <CardHeader><CardTitle>{editingId ? "Edit payment method" : "Create payment method"}</CardTitle><p className="text-sm text-slate-500">Use one method for each bank account or wallet QR code.</p></CardHeader>
      <CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Display name" value={form.label} onChange={(event) => update("label", event.target.value)} required />
        <select value={form.method} onChange={(event) => update("method", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="bank">Bank transfer</option><option value="esewa">eSewa online checkout</option><option value="other">Other manual method</option></select>
        <Input placeholder="Bank / wallet name" value={form.bankName} onChange={(event) => update("bankName", event.target.value)} /><Input placeholder="Account name" value={form.accountName} onChange={(event) => update("accountName", event.target.value)} /><Input placeholder="Account or wallet number" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} /><Input placeholder="Branch (optional)" value={form.branch} onChange={(event) => update("branch", event.target.value)} />
        <div className="sm:col-span-2"><CloudinaryUpload value={form.qrImageUrl} onChange={(value) => update("qrImageUrl", value)} folder="payments" accept="image/*" label="Upload bank or QR image" /></div>
        <Input className="sm:col-span-2" placeholder="Instructions for families" value={form.instructions} onChange={(event) => update("instructions", event.target.value)} />
        <div className="flex flex-wrap gap-2"><Button disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create method"}</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}</div>
      </form></CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Configured methods</CardTitle><p className="text-sm text-slate-500">Only enabled methods appear to students and parents.</p></CardHeader><CardContent className="space-y-3">
      {methods.length === 0 ? <p className="text-sm text-slate-500">No payment methods configured yet.</p> : methods.map((method) => <div key={method.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-900">{method.label}</p><p className="mt-1 text-sm text-slate-500">{method.bankName || method.method}{method.accountNumber ? ` · ${method.accountNumber}` : ""}{method.qrImageUrl ? " · QR configured" : ""}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(method)}>Edit</Button><Button size="sm" variant={method.enabled ? "primary" : "ghost"} onClick={() => void toggle(method)}>{method.enabled ? "Enabled" : "Enable"}</Button></div></div>)}
    </CardContent></Card>
  </div>;
}
