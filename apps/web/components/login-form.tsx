"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, School } from "lucide-react";
import { ApiError, EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Alert } from "./ui/alert";
import { setAccessTokenCookie } from "../lib/auth-cookie";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setConnectionError(false);
    try {
      const result = await new EduApiClient(undefined, () => null).post<{ accessToken: string; refreshToken: string; user: unknown }>("/auth/login", { identifier: identifier.trim(), password });
      localStorage.setItem("edu_access_token", result.accessToken);
      setAccessTokenCookie(result.accessToken);
      localStorage.setItem("edu_refresh_token", result.refreshToken);
      localStorage.setItem("edu_user", JSON.stringify(result.user));
      router.replace("/");
    } catch (err) {
      setConnectionError(err instanceof ApiError && (err.status === 0 || err.status >= 500));
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#f4f7fb] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 top-16 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500"><School size={21} /></span><span className="font-semibold tracking-tight">Nucleus</span></div>
          <div className="mt-28 max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">One place for every learner</p><h1 className="text-6xl font-semibold leading-[1.02] tracking-[-0.05em]">Make school work feel simple.</h1><p className="mt-7 max-w-md text-lg leading-8 text-slate-300">A calm, connected workspace for classes, attendance, learning, families and the people who make education happen.</p></div>
        </div>
        <p className="relative text-sm text-slate-400">Built for schools, colleges and curious learners.</p>
      </section>
      <main className="flex min-h-dvh items-center justify-center px-4 py-8 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 text-slate-950 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><School size={21} /></span><span className="font-semibold">Nucleus</span></div>
          <div className="mb-8"><p className="text-sm font-medium text-blue-600">Welcome back</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use your school account to continue where you left off.</p></div>
          {searchParams.get("passwordChanged") === "1" && <div className="mb-4"><Alert tone="success" title="Password changed">Sign in with your new password.</Alert></div>}
          {searchParams.get("sessionExpired") === "1" && <div className="mb-4"><Alert tone="warning" title="Session expired">Please sign in again to continue.</Alert></div>}
          <form onSubmit={submit} aria-busy={loading} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <label className="block" htmlFor="login-identifier"><span className="mb-2 block text-sm font-medium text-slate-700">Email, username or student ID</span><Input id="login-identifier" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your school account" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading} required /></label>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" size={17} /><Input id="login-password" name="password" autoComplete="current-password" className="pl-10 pr-12" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword((value) => !value)} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:text-slate-900">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </div>
            {error && <Alert tone="error" title={connectionError ? "School service unavailable" : "Couldn't sign you in"} onDismiss={() => setError("")}><p>{error}</p>{connectionError && <p className="mt-2">Your credentials could not be checked. Please retry once the service is available.</p>}</Alert>}
            <Button type="submit" disabled={loading || !identifier.trim() || !password} className="w-full">{loading ? <><LoaderCircle size={17} className="animate-spin" />Signing in…</> : <>Sign in<ArrowRight size={17} /></>}</Button>
            <a href="/forgot-password" className="block rounded-lg py-2 text-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">Forgot your password?</a>
          </form>
          <p className="mt-6 text-center text-sm leading-6 text-slate-500">Need an account? Contact your school administrator.</p>
        </div>
      </main>
    </div>
  );
}
