"use client";

import { useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await new EduApiClient().post("/auth/password-reset/request", { identifier: identifier.trim() });
      setMessage("If an active account matches, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a reset link");
    } finally {
      setSaving(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"><div><p className="text-sm font-medium text-blue-600">Account recovery</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Forgot your password?</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter your email or username and we will send recovery instructions.</p></div><Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or username" required minLength={3} />{error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}<Button className="w-full" disabled={saving}>{saving ? "Sending..." : "Send reset link"}</Button></form></main>;
}
