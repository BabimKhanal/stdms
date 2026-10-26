"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, School } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("owner@greenwood.edu.np");
  const [password, setPassword] = useState("Owner@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await new EduApiClient(undefined, () => null).post<{ accessToken: string; refreshToken: string; user: unknown }>("/auth/login", { identifier: identifier.trim(), password });
      localStorage.setItem("edu_access_token", result.accessToken);
      localStorage.setItem("edu_refresh_token", result.refreshToken);
      localStorage.setItem("edu_user", JSON.stringify(result.user));
      router.replace("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); } finally { setLoading(false); }
  }
  return <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
    <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-32 top-16 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" /><div className="relative"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500"><School size={21} /></span><span className="font-semibold tracking-tight">Nucleus</span></div><div className="mt-28 max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">One place for every learner</p><h1 className="text-6xl font-semibold leading-[1.02] tracking-[-0.05em]">Make school work feel simple.</h1><p className="mt-7 max-w-md text-lg leading-8 text-slate-300">A calm, connected workspace for classes, attendance, learning, families and the people who make education happen.</p></div></div><p className="relative text-sm text-slate-400">Built for schools, colleges and curious learners.</p></section>
    <main className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><div className="flex items-center gap-3 text-slate-950"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><School size={21} /></span><span className="font-semibold">Nucleus</span></div></div><div className="mb-8"><p className="text-sm font-medium text-blue-600">Welcome back</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use your school account to continue where you left off.</p></div><form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email, username or student ID</span><Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Password</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 text-slate-400" size={17} /><Input className="pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div></label>{error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<Button disabled={loading} className="w-full">{loading ? "Signing in..." : "Continue"}<ArrowRight size={17} /></Button><p className="text-center text-xs leading-5 text-slate-400">Demo: owner@greenwood.edu.np / Owner@123</p></form></div></main>
  </div>;
}
