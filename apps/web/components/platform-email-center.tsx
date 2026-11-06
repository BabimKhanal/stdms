"use client";

import { useEffect, useState } from "react";
import { History, LayoutTemplate, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

type Template = { id: string; key: string; name: string; subject: string; htmlBody: string; textBody: string | null; isActive: boolean };
type TemplateDraft = Omit<Template, "textBody"> & { textBody: string };
type Delivery = { id: string; organisationName?: string | null; toEmail: string; subject: string; templateKey?: string | null; provider: string; status: string; error?: string | null; sentAt?: string | null; createdAt: string };
const emptyTemplate = { id: "", key: "", name: "", subject: "", htmlBody: "", textBody: "", isActive: true };

function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "-"; }

export function PlatformEmailCenter() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [template, setTemplate] = useState<TemplateDraft>(emptyTemplate);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [templateRows, deliveryRows] = await Promise.all([
      api.get<Template[]>("/super/email-templates"),
      api.get<Delivery[]>("/super/email-deliveries"),
    ]);
    setTemplates(templateRows);
    setDeliveries(deliveryRows);
    if (!template.id && templateRows[0]) setTemplate({ ...templateRows[0], textBody: templateRows[0].textBody ?? "" });
  }

  useEffect(() => {
    reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load platform email center")).finally(() => setLoading(false));
    // The API client reads the current browser token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveTemplate() {
    setSaving(true); setError("");
    try {
      const payload = { ...template, ...(template.id ? {} : { key: template.key }), textBody: template.textBody || null };
      if (template.id) await api.put(`/super/email-templates/${template.id}`, payload);
      else await api.post("/super/email-templates", payload);
      toast.success("Platform template saved", template.name);
      setTemplate(emptyTemplate);
      await reload();
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to save platform template"; setError(message); toast.error("Template save failed", message); }
    finally { setSaving(false); }
  }

  async function deleteTemplate() {
    if (!template.id || !window.confirm(`Delete the ${template.name} template?`)) return;
    try { await api.delete(`/super/email-templates/${template.id}`); setTemplate(emptyTemplate); await reload(); toast.success("Template deleted", "The platform template was removed."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete template"); }
  }

  async function broadcast() {
    if (!template.key || !title || !body) return;
    if (!window.confirm("Send this message to every active and trial tenant with a configured email address?")) return;
    setSending(true); setError("");
    try {
      const result = await api.post<{ total: number; sent: number; failed: number }>("/super/email-deliveries/broadcast", { templateKey: template.key, title, body });
      toast.success("Tenant broadcast completed", `${result.sent} sent, ${result.failed} failed, ${result.total} tenant recipients.`);
      setTitle(""); setBody(""); await reload();
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to send tenant broadcast"; setError(message); toast.error("Broadcast failed", message); }
    finally { setSending(false); }
  }

  async function retry(delivery: Delivery) {
    setRetrying(delivery.id);
    try { await api.post(`/super/email-deliveries/${delivery.id}/retry`, {}); await reload(); toast.success("Delivery retried", delivery.toEmail); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to retry delivery"); }
    finally { setRetrying(""); }
  }

  if (loading) return <Card><CardContent className="py-10 text-center text-sm text-slate-500">Loading platform email center...</CardContent></Card>;
  return <div className="space-y-6">
    {error && <Alert tone="error" title="Platform email center" onDismiss={() => setError("")}>{error}</Alert>}
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><LayoutTemplate size={18} /> Platform templates</CardTitle><Button size="sm" variant="outline" onClick={() => setTemplate(emptyTemplate)}><Plus size={15} /> New</Button></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">{templates.map((item) => <button key={item.id} type="button" onClick={() => setTemplate({ ...item, textBody: item.textBody ?? "" })} className={`rounded-lg border px-3 py-2 text-left text-sm ${template.id === item.id ? "border-cyan-400 bg-cyan-50" : "border-slate-200"}`}><span className="block font-medium">{item.name}</span><span className="font-mono text-xs text-slate-500">{item.key}</span></button>)}</div>
          <div className="grid gap-3 border-t border-slate-200 pt-4">
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Template key</span><Input placeholder="maintenance_notification" value={template.key} disabled={Boolean(template.id)} onChange={(event) => setTemplate((current) => ({ ...current, key: event.target.value }))} /><span className="mt-1 block text-xs text-slate-500">Unique internal name using lowercase letters, numbers, and underscores.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Template name</span><Input placeholder="Maintenance notification" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} /><span className="mt-1 block text-xs text-slate-500">Shown in the tenant broadcast selector.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email subject</span><Input placeholder="Scheduled maintenance: {{title}}" value={template.subject} onChange={(event) => setTemplate((current) => ({ ...current, subject: event.target.value }))} /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">HTML email body</span><textarea className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" placeholder="Write the formatted email body" value={template.htmlBody} onChange={(event) => setTemplate((current) => ({ ...current, htmlBody: event.target.value }))} /><span className="mt-1 block text-xs text-slate-500">Available variables: <code>{"{{title}}"}</code>, <code>{"{{body}}"}</code>, <code>{"{{schoolName}}"}</code>, <code>{"{{date}}"}</code>.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Plain-text email body <span className="font-normal text-slate-400">(optional)</span></span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" placeholder="Fallback content for email clients that do not support HTML" value={template.textBody ?? ""} onChange={(event) => setTemplate((current) => ({ ...current, textBody: event.target.value }))} /></label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={template.isActive} onChange={(event) => setTemplate((current) => ({ ...current, isActive: event.target.checked }))} /> <span><span className="font-medium text-slate-900">Template is active</span><span className="block text-xs text-slate-500">Only active templates can be used for broadcasts.</span></span></label>
            <div className="flex flex-wrap gap-2"><Button type="button" disabled={saving || !template.key || !template.name || !template.subject || !template.htmlBody} onClick={() => void saveTemplate()}>{saving ? "Saving..." : "Save template"}</Button>{template.id && <Button type="button" variant="danger" onClick={() => void deleteTemplate()}><Trash2 size={15} /> Delete</Button>}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send size={18} /> Notify tenants</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This sends to the configured email address of every active or trial tenant. Use this for maintenance, incidents, policy changes, and platform announcements.</p>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Template</span><select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" value={template.key} onChange={(event) => { const selected = templates.find((item) => item.key === event.target.value); if (selected) setTemplate({ ...selected, textBody: selected.textBody ?? "" }); }}>{templates.map((item) => <option key={item.id} value={item.key}>{item.name}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Announcement title</span><Input placeholder="Scheduled maintenance on Saturday" value={title} onChange={(event) => setTitle(event.target.value)} /><span className="mt-1 block text-xs text-slate-500">Used by the <code>{"{{title}}"}</code> variable in the subject and template.</span></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Announcement message</span><textarea className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Explain what tenants need to know, including dates and expected impact." value={body} onChange={(event) => setBody(event.target.value)} /><span className="mt-1 block text-xs text-slate-500">Inserted into the <code>{"{{body}}"}</code> variable.</span></label>
          <Button type="button" disabled={sending || !template.key || !title || !body} onClick={() => void broadcast()}>{sending ? "Sending to tenants..." : "Send to all active tenants"}</Button>
        </CardContent>
      </Card>
    </div>
    <Card>
      <CardHeader className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><History size={18} /> Platform delivery log</CardTitle><Button size="sm" variant="outline" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</Button></CardHeader>
      <CardContent>{deliveries.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No platform deliveries yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr className="border-b border-slate-200"><th className="py-2 pr-3">Tenant</th><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Date</th><th /></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id} className="border-b border-slate-100"><td className="py-2.5 pr-3">{delivery.organisationName ?? "-"}</td><td className="py-2.5 pr-3">{delivery.toEmail}</td><td className="max-w-64 truncate py-2.5 pr-3">{delivery.subject}{delivery.error && <span className="block text-xs text-rose-600">{delivery.error}</span>}</td><td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${delivery.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{delivery.status}</span></td><td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(delivery.sentAt ?? delivery.createdAt)}</td><td className="py-2.5 text-right">{delivery.status === "failed" && <Button size="sm" variant="ghost" disabled={retrying === delivery.id} onClick={() => void retry(delivery)}>{retrying === delivery.id ? "Retrying" : "Retry"}</Button>}</td></tr>)}</tbody></table></div>}</CardContent>
    </Card>
  </div>;
}
