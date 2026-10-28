"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { CloudinaryUpload } from "./cloudinary-upload";

type Method = { id: string; method: string; label: string; enabled: number; instructions: string | null; bankName: string | null; accountName: string | null; accountNumber: string | null; branch: string | null; qrImageUrl: string | null };

export function PaymentSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [methods, setMethods] = useState<Method[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "Bank transfer", method: "bank", bankName: "", accountName: "", accountNumber: "", branch: "", qrImageUrl: "", instructions: "" });
  async function load() { try { const result = await api.get<{ data: Method[] }>("/fees/payment-methods"); setMethods(result.data); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load payment methods"); } }
  // Load configured methods once when the settings screen opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { await api.post("/fees/payment-methods", { ...form, enabled: true, qrImageUrl: form.qrImageUrl || null, instructions: form.instructions || null }); setForm({ ...form, bankName: "", accountName: "", accountNumber: "", branch: "", qrImageUrl: "", instructions: "" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save payment method"); } finally { setSaving(false); } }
  async function toggle(method: Method) { try { await api.put(`/fees/payment-methods/${method.id}`, { enabled: !method.enabled }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update payment method"); } }
  return <div className="space-y-6"><div><p className="text-sm font-medium text-blue-600">Finance configuration</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Payment methods</h2><p className="mt-2 text-sm text-slate-500">Configure the payment instructions shown only to this school&apos;s families.</p></div>{error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<Card><CardHeader><CardTitle>Add bank or QR payment method</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><Input placeholder="Display name" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="bank">Bank transfer</option><option value="other">Other manual method</option></select><Input placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /><Input placeholder="Account name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /><Input placeholder="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /><Input placeholder="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /><div className="sm:col-span-2"><CloudinaryUpload value={form.qrImageUrl} onChange={(qrImageUrl) => setForm({ ...form, qrImageUrl })} folder="payments" accept="image/*" label="Upload bank QR image" /></div><Input placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /><Button disabled={saving}>{saving ? "Saving..." : "Add payment method"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Configured methods</CardTitle></CardHeader><CardContent className="space-y-3">{methods.length === 0 ? <p className="text-sm text-slate-500">No manual methods configured.</p> : methods.map((method) => <div key={method.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><div><p className="font-semibold">{method.label}</p><p className="text-sm text-slate-500">{method.bankName ?? method.method}{method.accountNumber ? ` · ${method.accountNumber}` : ""}</p></div><Button size="sm" variant="outline" onClick={() => void toggle(method)}>{method.enabled ? "Disable" : "Enable"}</Button></div>)}</CardContent></Card></div>;
}
