"use client";

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

type Provider = "console" | "resend" | "sendgrid" | "mailgun" | "smtp";
type PlatformEmailSettings = {
  id: string | null;
  provider: Provider;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footer: string | null;
  providerDomain: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
};

const providers: { value: Provider; label: string }[] = [
  { value: "resend", label: "Resend" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "mailgun", label: "Mailgun" },
  { value: "smtp", label: "SMTP / custom server" },
  { value: "console", label: "Console (development)" },
];

function inputClass() {
  return "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
}

export function PlatformEmailSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [form, setForm] = useState<PlatformEmailSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testAddress, setTestAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<PlatformEmailSettings>("/super/email-settings")
      .then(setForm)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load platform email settings"))
      .finally(() => setLoading(false));
    // The API client reads the current browser token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof PlatformEmailSettings>(key: K, value: PlatformEmailSettings[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api.put<PlatformEmailSettings>("/super/email-settings", {
        ...form,
        replyTo: form.replyTo || null,
        footer: form.footer || null,
        providerDomain: form.providerDomain || null,
        smtpHost: form.smtpHost || null,
        smtpUsername: form.smtpUsername || null,
        ...(apiKey ? { apiKey } : {}),
        ...(smtpPassword ? { smtpPassword } : {}),
      });
      setForm(saved);
      setApiKey("");
      setSmtpPassword("");
      toast.success("Alert email settings saved", "Platform failure alerts will use this configuration.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to save platform email settings";
      setError(message);
      toast.error("Could not save alert email settings", message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError("");
    try {
      await api.post("/super/email-settings/test", { to: testAddress });
      toast.success("Test email sent", `Check ${testAddress}.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to send test email";
      setError(message);
      toast.error("Test email failed", message);
    } finally {
      setTesting(false);
    }
  }

  if (loading || !form) return <Card><CardContent className="p-6 text-sm text-slate-500">Loading alert email settings...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-800">Platform notifications</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Alert email</h2>
        <p className="mt-2 text-sm text-slate-600">Configure the sender used for failed platform operations and Super Admin test messages.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail size={18} /> Global mail provider</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
            <div className="md:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sender identity</p><p className="mt-1 text-sm text-slate-500">These details appear in maintenance and platform alert emails.</p></div>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm md:col-span-2"><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} /> <span><span className="font-medium text-slate-900">Enable platform alert emails</span><span className="block text-xs text-slate-500">Disable this to stop platform alerts and tenant broadcasts.</span></span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Provider</span><select className={inputClass()} value={form.provider} onChange={(event) => update("provider", event.target.value as Provider)}>{providers.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Sender name</span><Input value={form.fromName} onChange={(event) => update("fromName", event.target.value)} placeholder="Nucleus Platform" /><span className="mt-1 block text-xs text-slate-500">The display name recipients see.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Sender email address</span><Input type="email" value={form.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} placeholder="alerts@example.com" /><span className="mt-1 block text-xs text-slate-500">Use an address verified with your provider.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Reply-to email address <span className="font-normal text-slate-400">(optional)</span></span><Input type="email" value={form.replyTo ?? ""} onChange={(event) => update("replyTo", event.target.value || null)} placeholder="support@example.com" /><span className="mt-1 block text-xs text-slate-500">Where tenant replies should go.</span></label>
            {(form.provider === "resend" || form.provider === "sendgrid" || form.provider === "mailgun") && <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">API key</span><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={form.hasApiKey ? "Configured; enter a new key to replace" : "Provider API key"} autoComplete="new-password" /></label>}
            {form.provider === "mailgun" && <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Mailgun domain</span><Input value={form.providerDomain ?? ""} onChange={(event) => update("providerDomain", event.target.value || null)} placeholder="mg.example.com" /></label>}
            {form.provider === "smtp" && <>
              <div className="md:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">SMTP connection</p><p className="mt-1 text-sm text-slate-500">For Gmail, use <code>smtp.gmail.com</code>, port 587, and a 16-character App Password.</p></div>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP server host</span><Input value={form.smtpHost ?? ""} onChange={(event) => update("smtpHost", event.target.value || null)} placeholder="smtp.gmail.com" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP server port</span><Input type="number" min={1} max={65535} value={form.smtpPort ?? 587} onChange={(event) => { const port = Number(event.target.value); setForm((current) => current ? { ...current, smtpPort: port, smtpSecure: port === 465 } : current); }} /><span className="mt-1 block text-xs text-slate-500">587 uses STARTTLS. 465 uses implicit TLS.</span></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP username</span><Input value={form.smtpUsername ?? ""} onChange={(event) => update("smtpUsername", event.target.value || null)} placeholder="your-email@example.com" autoComplete="off" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">SMTP password or App Password</span><Input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} placeholder={form.hasSmtpPassword ? "Configured; enter a new password to replace" : "Paste SMTP password"} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">Stored encrypted. Gmail requires an App Password.</span></label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm md:col-span-2"><input type="checkbox" checked={form.smtpSecure} onChange={(event) => update("smtpSecure", event.target.checked)} /> <span><span className="font-medium text-slate-900">Use TLS immediately on connect</span><span className="block text-xs text-slate-500">Enable for port 465. Leave off for port 587 STARTTLS.</span></span></label>
            </>}
            <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Email footer <span className="font-normal text-slate-400">(optional)</span></span><textarea className={`${inputClass()} h-20 py-2`} value={form.footer ?? ""} onChange={(event) => update("footer", event.target.value || null)} placeholder="Nucleus Platform Operations" /><span className="mt-1 block text-xs text-slate-500">Added below every platform email.</span></label>
            <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save alert email settings"}</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send size={18} /> Send test message</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block flex-1"><span className="mb-2 block text-sm font-medium text-slate-700">Recipient email</span><Input type="email" value={testAddress} onChange={(event) => setTestAddress(event.target.value)} placeholder="admin@example.com" /></label><Button type="button" variant="outline" disabled={testing || !testAddress} onClick={() => void sendTest()}>{testing ? "Sending..." : "Send test"}</Button></CardContent>
      </Card>
    </div>
  );
}
