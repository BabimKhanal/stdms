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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() { try { const result = await api.get<{ data: Method[] }>("/fees/payment-methods"); setMethods(result.data); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load payment methods"); } }
  // Load configured methods once when the settings screen opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { await api.post("/fees/payment-methods", { ...form, enabled: true, qrImageUrl: form.qrImageUrl || null, instructions: form.instructions || null }); setForm(emptyForm); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save payment method"); } finally { setSaving(false); } }
  async function toggle(method: Method) { try { await api.put(`/fees/payment-methods/${method.id}`, { enabled: !method.enabled }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update payment method"); } }
  function update(name: keyof Form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  return <div className="space-y-6"><div><p className="text-sm font-medium text-blue-600">Finance configuration</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Payment methods</h2><p className="mt-2 text-sm text-slate-500">Configure bank transfers, QR payments, and eSewa checkout for this school.</p></div>{error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<Card><CardHeader><CardTitle>Add payment method</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><Input placeholder="Display name" value={form.label} onChange={(event) => update("label", event.target.value)} required /><select value={form.method} onChange={(event) => update("method", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="bank">Bank transfer</option><option value="esewa">eSewa online checkout</option><option value="other">Other manual method</option></select><Input placeholder="Bank name" value={form.bankName} onChange={(event) => update("bankName", event.target.value)} /><Input placeholder="Account name" value={form.accountName} onChange={(event) => update("accountName", event.target.value)} /><Input placeholder="Account number" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} /><Input placeholder="Branch" value={form.branch} onChange={(event) => update("branch", event.target.value)} /><div className="sm:col-span-2"><CloudinaryUpload value={form.qrImageUrl} onChange={(value) => update("qrImageUrl", value)} folder="payments" accept="image/*" label="Upload bank or QR image" /></div><Input placeholder="Instructions" value={form.instructions} onChange={(event) => update("instructions", event.target.value)} /><Button disabled={saving}>{saving ? "Saving..." : "Add payment method"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Configured methods</CardTitle></CardHeader><CardContent className="space-y-3">{methods.length === 0 ? <p className="text-sm text-slate-500">No payment methods configured.</p> : methods.map((method) => <div key={method.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{method.label} <span className="text-xs font-normal uppercase text-slate-400">{method.method}</span></p><p className="text-sm text-slate-500">{method.bankName ?? method.instructions ?? "Online checkout"}{method.accountNumber ? ` · ${method.accountNumber}` : ""}</p>{method.qrImageUrl && <a className="text-sm text-blue-600 underline" href={method.qrImageUrl} target="_blank" rel="noreferrer">View QR image</a>}</div><Button size="sm" variant="outline" onClick={() => void toggle(method)}>{method.enabled ? "Disable" : "Enable"}</Button></div>)}</CardContent></Card></div>;
}
