"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) return setError("This reset link is missing its token.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setSaving(true);
    try {
      await new EduApiClient().post("/auth/password-reset/reset", { token, newPassword: password });
      setMessage("Password reset successfully. You can now sign in.");
      setPassword("");
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setSaving(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"><div><p className="text-sm font-medium text-blue-600">Account recovery</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Use at least 8 characters. The reset link can only be used once.</p></div><Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" required /><Input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm new password" required />{error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}<Button className="w-full" disabled={saving}>{saving ? "Saving..." : "Reset password"}</Button></form></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f4f7fb] text-sm text-slate-500">Loading reset form...</main>}><ResetPasswordForm /></Suspense>;
}
