"use client";

import { useEffect, useState } from "react";
import { History, LayoutTemplate, Mail, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

type Provider = "console" | "resend" | "sendgrid" | "mailgun" | "smtp";

type EmailSettings = {
  id: string | null;
  provider: Provider;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footer: string | null;
  dailyLimit: number;
  providerDomain: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  lastTestedAt: string | null;
  lastTestError: string | null;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
};

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  isActive: boolean;
  updatedAt: string;
};

type EmailDelivery = {
  id: string;
  toEmail: string;
  subject: string;
  provider: string;
  status: string;
  error: string | null;
  templateKey: string | null;
  sentAt: string | null;
  createdAt: string;
};

type ListResponse<T> = { data: T[] };
type Tab = "sender" | "templates" | "deliveries";

const defaults: EmailSettings = {
  id: null,
  provider: "resend",
  enabled: true,
  fromName: "",
  fromEmail: "",
  replyTo: null,
  footer: null,
  dailyLimit: 1000,
  providerDomain: null,
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: true,
  smtpUsername: null,
  lastTestedAt: null,
  lastTestError: null,
  hasApiKey: false,
  hasSmtpPassword: false,
};

const emptyTemplate = {
  id: "",
  key: "",
  name: "",
  subject: "",
  htmlBody: "",
  textBody: "",
  isActive: true,
};

const providers: { value: Provider; label: string }[] = [
  { value: "resend", label: "Resend" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "mailgun", label: "Mailgun" },
  { value: "smtp", label: "SMTP / custom server" },
  { value: "console", label: "Console (development)" },
];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function EmailSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("sender");
  const [form, setForm] = useState<EmailSettings>(defaults);
  const [apiKey, setApiKey] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testAddress, setTestAddress] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [preview, setPreview] = useState<{ subject: string; html: string; text?: string } | null>(null);
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [retrying, setRetrying] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<EmailSettings>("/organisation/email-settings"),
      api.get<ListResponse<EmailTemplate>>("/organisation/email-templates"),
      api.get<ListResponse<EmailDelivery>>("/organisation/email-deliveries"),
    ])
      .then(([settings, templateList, deliveryList]) => {
        setForm(settings);
        setTemplates(templateList.data);
        setDeliveries(deliveryList.data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load email settings"))
      .finally(() => setLoading(false));
    // The API client is intentionally recreated from the current browser token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function reload() {
    const [settings, templateList, deliveryList] = await Promise.all([
      api.get<EmailSettings>("/organisation/email-settings"),
      api.get<ListResponse<EmailTemplate>>("/organisation/email-templates"),
      api.get<ListResponse<EmailDelivery>>("/organisation/email-deliveries"),
    ]);
    setForm(settings);
    setTemplates(templateList.data);
    setDeliveries(deliveryList.data);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        provider: form.provider,
        enabled: form.enabled,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        replyTo: form.replyTo || null,
        footer: form.footer || null,
        dailyLimit: form.dailyLimit,
        providerDomain: form.providerDomain || null,
        smtpHost: form.smtpHost || null,
        smtpPort: form.smtpPort ?? null,
        smtpSecure: form.smtpSecure,
        smtpUsername: form.smtpUsername || null,
        ...(apiKey ? { apiKey } : {}),
        ...(smtpPassword ? { smtpPassword } : {}),
      };
      const saved = await api.put<EmailSettings>("/organisation/email-settings", payload);
      setForm(saved);
      setApiKey("");
      setSmtpPassword("");
      toast.success("Email settings saved", "This tenant's outbound email identity has been updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save email settings";
      setError(message);
      toast.error("Could not save email settings", message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError("");
    try {
      await api.post("/organisation/email-settings/test", { to: testAddress });
      toast.success("Test email sent", `Check ${testAddress}.`);
      setForm(await api.get<EmailSettings>("/organisation/email-settings"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send test email";
      setError(message);
      toast.error("Test email failed", message);
    } finally {
      setTesting(false);
    }
  }

  function startNewTemplate() {
    setTemplateForm(emptyTemplate);
    setPreview(null);
  }

  function editTemplate(template: EmailTemplate) {
    setTemplateForm({
      id: template.id,
      key: template.key,
      name: template.name,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody ?? "",
      isActive: template.isActive,
    });
    setPreview(null);
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setError("");
    try {
      const payload = {
        ...(templateForm.id ? {} : { key: templateForm.key }),
        name: templateForm.name,
        subject: templateForm.subject,
        htmlBody: templateForm.htmlBody,
        textBody: templateForm.textBody || null,
        isActive: templateForm.isActive,
      };
      if (templateForm.id) await api.put(`/organisation/email-templates/${templateForm.id}`, payload);
      else await api.post("/organisation/email-templates", payload);
      toast.success("Template saved", `${templateForm.name} is ready to use.`);
      await reload();
      startNewTemplate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save template";
      setError(message);
      toast.error("Could not save template", message);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function previewTemplate() {
    setError("");
    try {
      const rendered = await api.post<{ subject: string; html: string; text?: string }>("/organisation/email-templates/preview", {
        subject: templateForm.subject,
        htmlBody: templateForm.htmlBody,
        textBody: templateForm.textBody || null,
      });
      setPreview(rendered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to render preview");
    }
  }

  async function deleteTemplate(template: EmailTemplate) {
    if (!window.confirm(`Delete the "${template.name}" template?`)) return;
    setError("");
    try {
      await api.delete(`/organisation/email-templates/${template.id}`);
      toast.success("Template deleted", template.name);
      await reload();
      if (templateForm.id === template.id) startNewTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete template");
    }
  }

  async function retryDelivery(delivery: EmailDelivery) {
    setRetrying(delivery.id);
    setError("");
    try {
      await api.post(`/organisation/email-deliveries/${delivery.id}/retry`, {});
      toast.success("Email retried", delivery.toEmail);
      setDeliveries((await api.get<ListResponse<EmailDelivery>>("/organisation/email-deliveries")).data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to retry email";
      setError(message);
      toast.error("Retry failed", message);
    } finally {
      setRetrying("");
    }
  }

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-slate-500">Loading email settings...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Tenant communication</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Email settings</h2>
        <p className="mt-2 text-sm text-slate-500">Configure the sender identity, templates, and delivery visibility used only by this institution. Provider credentials remain server-side.</p>
      </div>
      {error && <Alert tone="error" title="Email settings" onDismiss={() => setError("")}>{error}</Alert>}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {([
          { id: "sender", label: "Sender & provider", icon: Mail },
          { id: "templates", label: "Templates", icon: LayoutTemplate },
          { id: "deliveries", label: "Delivery log", icon: History },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${tab === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === "sender" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail size={18} /> Sender configuration</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Provider</span><select value={form.provider} onChange={(event) => update("provider", event.target.value as Provider)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{providers.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label>
                <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} /> Enable outbound email for this tenant</label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">From name</span><Input value={form.fromName} onChange={(event) => update("fromName", event.target.value)} maxLength={120} required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">From email</span><Input type="email" value={form.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Reply-to email</span><Input type="email" value={form.replyTo ?? ""} onChange={(event) => update("replyTo", event.target.value || null)} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Daily message limit</span><Input type="number" min={1} max={100000} value={form.dailyLimit} onChange={(event) => update("dailyLimit", Number(event.target.value))} required /></label>

                {(form.provider === "resend" || form.provider === "sendgrid" || form.provider === "mailgun") && (
                  <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">{providerLabel(form.provider)} API key</span><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={form.hasApiKey ? "Configured; enter a new key to replace" : "Paste the tenant API key"} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">{form.hasApiKey ? "A tenant key is encrypted and configured." : "No tenant key configured; the platform fallback will be used."}</span></label>
                )}
                {form.provider === "mailgun" && (
                  <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Mailgun sending domain</span><Input value={form.providerDomain ?? ""} onChange={(event) => update("providerDomain", event.target.value || null)} placeholder="mg.example.com" /></label>
                )}

                {form.provider === "smtp" && (
                  <>
                    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP host</span><Input value={form.smtpHost ?? ""} onChange={(event) => update("smtpHost", event.target.value || null)} placeholder="smtp.example.com" /></label>
                    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP port</span><Input type="number" min={1} max={65535} value={form.smtpPort ?? 587} onChange={(event) => update("smtpPort", Number(event.target.value))} /></label>
                    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP username</span><Input value={form.smtpUsername ?? ""} onChange={(event) => update("smtpUsername", event.target.value || null)} autoComplete="off" /></label>
                    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP password</span><Input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} placeholder={form.hasSmtpPassword ? "Configured; enter a new password to replace" : "SMTP password"} autoComplete="new-password" /></label>
                    <label className="flex items-center gap-3 md:col-span-2 rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.smtpSecure} onChange={(event) => update("smtpSecure", event.target.checked)} /> Use TLS on connect (typically port 465)</label>
                  </>
                )}

                {form.provider === "console" && (
                  <div className="md:col-span-2"><Alert tone="info" title="Development provider">Messages are written to the server log instead of being delivered.</Alert></div>
                )}

                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Footer</span><textarea value={form.footer ?? ""} onChange={(event) => update("footer", event.target.value || null)} maxLength={2000} className="min-h-24 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm" placeholder="Optional institution footer" /></label>
                <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={saving}>{saving ? "Saving..." : "Save email settings"}</Button><span className="text-xs text-slate-500">{form.lastTestedAt ? `Last test ${formatDate(form.lastTestedAt)}${form.lastTestError ? ` — failed: ${form.lastTestError}` : " — succeeded"}` : "No test sent from this configuration yet."}</span></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Send a test email</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row"><Input type="email" placeholder="recipient@example.com" value={testAddress} onChange={(event) => setTestAddress(event.target.value)} /><Button type="button" variant="outline" disabled={testing || !testAddress} onClick={() => void sendTest()}>{testing ? "Sending..." : "Send test"}</Button></CardContent>
          </Card>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex items-center justify-between"><CardTitle>Templates</CardTitle><Button size="sm" variant="outline" onClick={startNewTemplate}><Plus size={15} /> New</Button></CardHeader>
            <CardContent className="space-y-2">
              {templates.map((template) => (
                <button key={template.id} type="button" onClick={() => editTemplate(template)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${templateForm.id === template.id ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-900">{template.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{template.isActive ? "Active" : "Off"}</span></span>
                  <span className="mt-1 block truncate font-mono text-xs text-slate-500">{template.key}</span>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{templateForm.id ? `Edit: ${templateForm.name}` : "New template"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Key</span><Input value={templateForm.key} onChange={(event) => setTemplateForm((current) => ({ ...current, key: event.target.value }))} disabled={Boolean(templateForm.id)} placeholder="bulk_message" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Name</span><Input value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Subject</span><Input value={templateForm.subject} onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))} placeholder="{{title}}" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">HTML body</span><textarea value={templateForm.htmlBody} onChange={(event) => setTemplateForm((current) => ({ ...current, htmlBody: event.target.value }))} className="min-h-48 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-xs" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Plain text (optional)</span><textarea value={templateForm.textBody} onChange={(event) => setTemplateForm((current) => ({ ...current, textBody: event.target.value }))} className="min-h-24 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-xs" /></label>
              </div>
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Variables: {"{{title}}"} {"{{body}}"} {"{{schoolName}}"} {"{{recipientName}}"} {"{{appUrl}}"} {"{{date}}"}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void saveTemplate()} disabled={savingTemplate || !templateForm.name || !templateForm.subject || !templateForm.htmlBody || (!templateForm.id && !templateForm.key)}>{savingTemplate ? "Saving..." : "Save template"}</Button>
                <Button type="button" variant="outline" onClick={() => void previewTemplate()} disabled={!templateForm.subject || !templateForm.htmlBody}>Preview</Button>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={templateForm.isActive} onChange={(event) => setTemplateForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active</label>
                {templateForm.id && <Button type="button" variant="danger" onClick={() => { const current = templates.find((item) => item.id === templateForm.id); if (current) void deleteTemplate(current); }}><Trash2 size={15} /> Delete</Button>}
              </div>
              {preview && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview subject</p>
                  <p className="text-sm font-medium text-slate-900">{preview.subject}</p>
                  <div className="max-h-80 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3" dangerouslySetInnerHTML={{ __html: preview.html }} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "deliveries" && (
        <Card>
          <CardHeader className="flex items-center justify-between"><CardTitle>Delivery log</CardTitle><Button size="sm" variant="outline" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</Button></CardHeader>
          <CardContent>
            {deliveries.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No email deliveries recorded yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500"><tr className="border-b border-slate-200"><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Template</th><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Sent</th><th className="py-2" /></tr></thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-700">{delivery.toEmail}</td>
                        <td className="py-2.5 pr-3"><span className="block max-w-56 truncate text-slate-900">{delivery.subject}</span>{delivery.error && <span className="block max-w-56 truncate text-xs text-rose-600">{delivery.error}</span>}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{delivery.templateKey ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{delivery.provider}</td>
                        <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${delivery.status === "sent" ? "bg-emerald-100 text-emerald-700" : delivery.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{delivery.status}</span></td>
                        <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(delivery.sentAt ?? delivery.createdAt)}</td>
                        <td className="py-2.5 text-right"><Button size="sm" variant="ghost" disabled={retrying === delivery.id} onClick={() => void retryDelivery(delivery)}><Send size={14} /> {retrying === delivery.id ? "Sending" : "Retry"}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function providerLabel(provider: Provider) {
  return providers.find((item) => item.value === provider)?.label ?? provider;
}
