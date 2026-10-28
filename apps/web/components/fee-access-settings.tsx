"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Settings = { studentVisible: number; studentOnlinePayment: number; guardianVisible: number; showDiscounts: number; dueReminders: number };
const defaults: Settings = { studentVisible: 1, studentOnlinePayment: 0, guardianVisible: 1, showDiscounts: 1, dueReminders: 1 };

export function FeeAccessSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [settings, setSettings] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { void api.get<Settings>("/fees/access-settings").then(setSettings).catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function toggle(name: keyof Settings) { setSettings((current) => ({ ...current, [name]: current[name] ? 0 : 1 })); }
  async function save() { setSaving(true); setMessage(""); try { await api.put("/fees/access-settings", Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, Boolean(value)]))); setMessage("Fee access settings saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save fee access settings"); } finally { setSaving(false); } }
  const options: Array<[keyof Settings, string, string]> = [["studentVisible", "Student fee visibility", "Allow students to view their own invoices and balances."], ["studentOnlinePayment", "Student online payment", "Allow students to start eSewa or submit bank/QR payments."], ["guardianVisible", "Parent fee access", "Allow parents to view linked children’s invoices."], ["showDiscounts", "Show discounts to students", "Display discounts and scholarship amounts in student views."], ["dueReminders", "Fee due reminders", "Enable due-date reminder notifications for families."]];
  return <Card><CardHeader><CardTitle>Fee access and family experience</CardTitle><p className="text-sm text-slate-500">Control what students and parents can see and do without changing accountant permissions.</p></CardHeader><CardContent className="space-y-3">{message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}{options.map(([key, label, description]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"><input className="mt-1 h-4 w-4" type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} /><span><span className="block text-sm font-medium text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></label>)}<Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save fee access settings"}</Button></CardContent></Card>;
}
