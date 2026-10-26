"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BarChart3, BookOpen, CalendarCheck, CreditCard, FileText, GraduationCap, HeartHandshake, LayoutDashboard, LogOut, Menu, Palette, Users, UserCog, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { BrandingSettings, type OrganisationBranding } from "./branding-settings";
import { StudentDirectory } from "./student-directory";
import { FeeWorkspace } from "./fee-workspace";
import { ExamWorkspace } from "./exam-workspace";
import { LearningWorkspace } from "./learning-workspace";
import { AcademicWorkspace } from "./academic-workspace";
import { GuardianWorkspace } from "./guardian-workspace";
import { AttendanceWorkspace } from "./attendance-workspace";
import { UserManagement } from "./user-management";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatNpr } from "../lib/utils";
import { NotificationBell } from "./notification-bell";

type User = { name: string; orgName?: string | null; roles: string[]; permissions?: string[] };
type Dashboard = { students?: number; employees?: number; attendancePercentage?: number; fees?: { outstanding?: number } };
type Student = Record<string, unknown>;
const nav = [["Overview", LayoutDashboard, "dashboard"], ["Students", Users, "students"], ["Parents & guardians", HeartHandshake, "guardians"], ["Academics", GraduationCap, "academics"], ["Attendance", CalendarCheck, "attendance"], ["Learning", BookOpen, "learning"], ["Fees & invoices", CreditCard, "fees"], ["Exams & results", BarChart3, "exams"], ["User management", UserCog, "users"], ["Branding", Palette, "branding"]] as const;

export function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [branding, setBranding] = useState<OrganisationBranding | null>(null);
  const [brandingError, setBrandingError] = useState("");
  const [section, setSection] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try { const saved = localStorage.getItem("edu_user"); setUser(saved ? JSON.parse(saved) as User : null); }
    catch { localStorage.removeItem("edu_user"); }
    finally { setAuthReady(true); }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.replace("/login"); return; }
    const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
    Promise.all([api.get<Dashboard>("/dashboard"), api.get<{ data: Student[] }>("/students?page=1&pageSize=8")])
      .then(([stats, list]) => { setDashboard(stats); setStudents(list.data); })
      .catch((error: unknown) => { if (error instanceof Error && error.message === "Authentication required") { localStorage.clear(); router.replace("/login"); } });
  }, [authReady, router, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;
    void new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"))
      .get<OrganisationBranding>("/organisation/branding")
      .then((result) => {
        if (active) {
          setBranding(result);
          setBrandingError("");
        }
      })
      .catch((error: unknown) => {
        if (active) setBrandingError(error instanceof Error ? error.message : "Unable to load institution branding");
      });
    return () => { active = false; };
  }, [authReady, user]);

   async function logout() { const refreshToken = localStorage.getItem("edu_refresh_token"); if (refreshToken) await new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")).post("/auth/logout", { refreshToken }).catch(() => undefined); ["edu_access_token", "edu_refresh_token", "edu_user"].forEach((key) => localStorage.removeItem(key)); router.replace("/login"); }
  const visibleNav = nav.filter((item) => item[2] !== "branding" || user?.permissions?.includes("organisation.edit"));
  const current = visibleNav.find((item) => item[2] === section);
  const Icon = current?.[1] ?? LayoutDashboard;
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  return <div data-tenant-branding style={{ "--tenant-primary": primaryColor } as CSSProperties} className="min-h-screen bg-[#f6f8fc] text-slate-950">
    <aside className={`${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-600 text-white">{branding?.logoUrl ? <Image src={branding.logoUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-contain" /> : <GraduationCap size={20} />}</span><span className="truncate text-lg font-semibold tracking-tight">{branding?.name ?? user?.orgName ?? "Nucleus"}</span></div><button className="lg:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="px-4 py-5"><div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[11px] font-semibold uppercase tracking-widest text-blue-300">Institution</p><p className="mt-2 truncate text-sm font-semibold">{branding?.name ?? user?.orgName ?? "Institution"}</p><p className="mt-1 text-xs text-slate-400">2026 / 27 · Term 1</p></div></div>
      <nav className="flex-1 space-y-1 px-3">{visibleNav.map(([label, ItemIcon, key]) => <button key={key} onClick={() => { setSection(key); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${section === key ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><ItemIcon size={18} />{label}</button>)}</nav>
      <div className="border-t border-slate-100 p-3"><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600"><LogOut size={18} />Sign out</button></div>
    </aside>
       <div className="lg:pl-[260px]"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f6f8fc]/90 px-5 backdrop-blur-xl sm:px-8"><button className="lg:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="flex items-center gap-3"><Icon size={18} className="text-blue-600" /><span className="font-medium">{current?.[0] ?? "Overview"}</span></div><div className="flex items-center gap-3"><NotificationBell /><div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{user?.name?.charAt(0) ?? "U"}</div></div></header><main className="mx-auto max-w-[1500px] p-5 sm:p-8">{brandingError && <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Institution branding could not be loaded: {brandingError}</p>}{section === "dashboard" ? <DashboardView dashboard={dashboard} students={students} setSection={setSection} /> : section === "students" ? <StudentDirectory initialStudents={students} /> : section === "guardians" ? <GuardianWorkspace /> : section === "academics" ? <AcademicWorkspace /> : section === "attendance" ? <AttendanceWorkspace /> : section === "fees" ? <FeeWorkspace /> : section === "exams" ? <ExamWorkspace /> : section === "learning" ? <LearningWorkspace /> : section === "users" ? <UserManagement /> : section === "branding" && branding && user?.permissions?.includes("organisation.edit") ? <BrandingSettings branding={branding} onSaved={(updated) => { setBranding(updated); setBrandingError(""); }} /> : <PlaceholderView section={section} />}</main></div>
  </div>;
}

function DashboardView({ dashboard, students, setSection }: { dashboard: Dashboard; students: Student[]; setSection: (section: string) => void }) {
  const stats = [["Students", dashboard.students ?? 0], ["Staff members", dashboard.employees ?? 0], ["Attendance today", `${dashboard.attendancePercentage ?? 0}%`], ["Outstanding fees", formatNpr(dashboard.fees?.outstanding ?? 0)]];
  return <><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-blue-600">Wednesday, 14 October 2026</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Good morning, your school is in motion.</h2><p className="mt-2 text-sm text-slate-500">Here is the clearest view of what needs your attention today.</p></div><Button onClick={() => setSection("students")}><Users size={16} />View students</Button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p></CardContent></Card>)}</div><Card className="mt-6"><CardHeader><CardTitle>Recent students</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{students.slice(0, 6).map((student) => <button key={String(student.id)} onClick={() => setSection("students")} className="rounded-xl border border-slate-100 p-4 text-left hover:border-blue-200 hover:bg-blue-50/40"><p className="font-medium">{String(student.fullName ?? "Student")}</p><p className="mt-1 text-xs text-slate-500">{String(student.studentId ?? "-")}</p></button>)}</div></CardContent></Card></>;
}

function PlaceholderView({ section }: { section: string }) { return <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><FileText className="mx-auto text-slate-300" size={30} /><h2 className="mt-4 text-2xl font-semibold capitalize">{section}</h2><p className="mt-2 text-sm text-slate-500">This module is the next implementation slice. The API and tenant security layer are already connected.</p></div>; }
