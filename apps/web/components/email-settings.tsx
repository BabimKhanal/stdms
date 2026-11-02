"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

type EmailSettings = {
  provider: "console" | "resend";
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footer: string | null;
  dailyLimit: number;
  hasCredentials: boolean;
};

const defaults: EmailSettings = {
  provider: "resend",
  enabled: true,
  fromName: "",
  fromEmail: "",
  replyTo: null,
  footer: null,
  dailyLimit: 1000,
  hasCredentials: false,
};

export function EmailSettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [form, setForm] = useState<EmailSettings>(defaults);
  const [testAddress, setTestAddress] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<EmailSettings>("/organisation/email-settings")
      .then(setForm)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load email settings"))
      .finally(() => setLoading(false));
    // The API client is intentionally recreated from the current browser token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await api.put<EmailSettings>("/organisation/email-settings", { ...form, apiKey: apiKey || undefined });
      setForm(saved);
      setApiKey("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send test email");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-slate-500">Loading email settings...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Tenant communication</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Email settings</h2>
        <p className="mt-2 text-sm text-slate-500">Configure the sender identity used only by this institution. Provider credentials remain server-side.</p>
      </div>
      {error && <Alert tone="error" title="Email settings" onDismiss={() => setError("")}>{error}</Alert>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail size={18} /> Sender configuration</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Provider</span><select value={form.provider} onChange={(event) => update("provider", event.target.value as EmailSettings["provider"])} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="resend">Resend</option><option value="console">Console / development</option></select></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Resend API key</span><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={form.hasCredentials ? "Configured; enter a new key to replace" : "re_..."} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">{form.hasCredentials ? "A tenant key is encrypted and configured." : "No tenant key configured; the platform fallback will be used."}</span></label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} /> Enable outbound email for this tenant</label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">From name</span><Input value={form.fromName} onChange={(event) => update("fromName", event.target.value)} maxLength={120} required /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">From email</span><Input type="email" value={form.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} required /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Reply-to email</span><Input type="email" value={form.replyTo ?? ""} onChange={(event) => update("replyTo", event.target.value || null)} /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Daily message limit</span><Input type="number" min={1} max={100000} value={form.dailyLimit} onChange={(event) => update("dailyLimit", Number(event.target.value))} required /></label>
            <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Footer</span><textarea value={form.footer ?? ""} onChange={(event) => update("footer", event.target.value || null)} maxLength={2000} className="min-h-24 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm" placeholder="Optional institution footer" /></label>
            <div className="md:col-span-2"><Button disabled={saving}>{saving ? "Saving..." : "Save email settings"}</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Send a test email</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row"><Input type="email" placeholder="recipient@example.com" value={testAddress} onChange={(event) => setTestAddress(event.target.value)} /><Button type="button" variant="outline" disabled={testing || !testAddress} onClick={() => void sendTest()}>{testing ? "Sending..." : "Send test"}</Button></CardContent>
      </Card>
    </div>
  );
}
