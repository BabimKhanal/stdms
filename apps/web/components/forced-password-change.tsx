"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { clearAccessTokenCookie } from "../lib/auth-cookie";

export function ForcedPasswordChange({ name }: { name: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    if (newPassword === currentPassword) return setError("Choose a password different from the temporary password.");
    setSaving(true);
    setError("");
    try {
      const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
      await api.post("/auth/change-password", { currentPassword, newPassword });
      ["edu_access_token", "edu_refresh_token", "edu_user"].forEach((key) => localStorage.removeItem(key));
      clearAccessTokenCookie();
      router.replace("/login?passwordChanged=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <Card className="w-full max-w-lg shadow-xl shadow-slate-200/60">
        <CardHeader>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white"><ShieldCheck size={24} /></div>
          <p className="text-sm font-medium text-blue-600">Secure your account</p>
          <CardTitle className="mt-1 text-2xl">Choose a private password</CardTitle>
          <p className="mt-2 text-sm leading-6 text-slate-500">Hi {name}. Your temporary password must be replaced before you can access school information.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Temporary password</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 text-slate-400" size={17} /><Input className="pl-10" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></div></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">New password</span><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">Use at least 8 characters and avoid passwords used elsewhere.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</span><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" /></label>
            {error && <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>}
            <Button className="w-full" disabled={saving}>{saving ? "Securing account..." : "Change password and continue"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
