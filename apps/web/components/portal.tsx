"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Megaphone,
  Palette,
  RefreshCw,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { BrandingSettings, type OrganisationBranding } from "./branding-settings";
import { StudentDirectory } from "./student-directory";
import { FeeWorkspace } from "./fee-workspace";
import { ExamWorkspace } from "./exam-workspace";
import { LearningWorkspace } from "./learning-workspace";
import { StudentLearning } from "./student-learning";
import { AcademicWorkspace } from "./academic-workspace";
import { GuardianWorkspace } from "./guardian-workspace";
import { AttendanceWorkspace } from "./attendance-workspace";
import { UserManagement } from "./user-management";
import { ReportsWorkspace } from "./reports-workspace";
import { CommunicationWorkspace } from "./communication-workspace";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatNpr } from "../lib/utils";
import { NotificationBell } from "./notification-bell";
import { PaymentSettings } from "./payment-settings";
import { EmployeeDirectory } from "./employee-directory";
import { ExamApprovalPanel } from "./exam-approval-panel";

type User = { name: string; email?: string | null; orgName?: string | null; roles: string[]; permissions?: string[]; isPlatformAdmin?: boolean; studentId?: string | null };
type Notice = { id: string; title: string; body?: string | null; priority?: string; publishAt?: string };
type CalendarEvent = { id: string; title: string; startDate?: string; endDate?: string | null; startTime?: string | null; venue?: string | null };
type Dashboard = {
  students?: number;
  employees?: number;
  attendancePercentage?: number;
  fees?: { total?: number; paid?: number; outstanding?: number };
  recentNotices?: Notice[];
  upcomingEvents?: CalendarEvent[];
};
type Student = Record<string, unknown>;
const nav = [
  ["Overview", LayoutDashboard, "dashboard"],
  ["Students", Users, "students"],
  ["Parents & guardians", HeartHandshake, "guardians"],
  ["Academics", GraduationCap, "academics"],
  ["Attendance", CalendarCheck, "attendance"],
  ["Learning", BookOpen, "learning"],
  ["Fees & invoices", CreditCard, "fees"],
  ["Exams & results", BarChart3, "exams"],
  ["Reports", LineChart, "reports"],
  ["Notices & events", Megaphone, "communication"],
  ["User management", UserCog, "users"],
  ["Staff profiles", UserCog, "employees"],
  ["Branding", Palette, "branding"],
  ["Payment settings", CreditCard, "payment-settings"],
] as const;

export function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [branding, setBranding] = useState<OrganisationBranding | null>(null);
  const [brandingError, setBrandingError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardVersion, setDashboardVersion] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try { const saved = localStorage.getItem("edu_user"); setUser(saved ? JSON.parse(saved) as User : null); }
    catch { localStorage.removeItem("edu_user"); }
    finally { setAuthReady(true); }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.replace("/login"); return; }
    let active = true;
    setDashboardLoading(true);
    setDashboardError("");
    const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
    const canLoadStudents = canViewNav("students", user);
    Promise.all([api.get<Dashboard>("/dashboard"), canLoadStudents ? api.get<{ data: Student[] }>("/students?page=1&pageSize=8") : Promise.resolve({ data: [] as Student[] })])
      .then(([stats, list]) => {
        if (!active) return;
        setDashboard(stats);
        setStudents(list.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "Authentication required") {
          localStorage.clear();
          router.replace("/login");
          return;
        }
        setDashboardError(error instanceof Error ? error.message : "Unable to load the dashboard");
      })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, [authReady, router, user, dashboardVersion]);

  useEffect(() => {
    if (!authReady || !user || !user.permissions?.includes("organisation.edit")) return;
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

  async function logout() {
    const refreshToken = localStorage.getItem("edu_refresh_token");
    if (refreshToken) await new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")).post("/auth/logout", { refreshToken }).catch(() => undefined);
    ["edu_access_token", "edu_refresh_token", "edu_user"].forEach((key) => localStorage.removeItem(key));
    router.replace("/login");
  }

  function navigate(nextSection: string) {
    setSection(nextSection);
    setMobileNav(false);
    setUserMenu(false);
  }

  const visibleNav = nav.filter((item) => canViewNav(item[2], user));
  const current = visibleNav.find((item) => item[2] === section);
  const Icon = current?.[1] ?? LayoutDashboard;
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  return (
    <div data-tenant-branding style={{ "--tenant-primary": primaryColor } as CSSProperties} className="min-h-screen bg-[#f6f8fc] text-slate-950">
      {mobileNav && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside className={`${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-600 text-white">
              {branding?.logoUrl ? <Image src={branding.logoUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-contain" /> : <GraduationCap size={20} />}
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">{branding?.name ?? user?.orgName ?? "Nucleus"}</span>
          </div>
          <button aria-label="Close navigation" className="lg:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="px-4 py-5">
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-300">Institution</p>
            <p className="mt-2 truncate text-sm font-semibold">{branding?.name ?? user?.orgName ?? "Institution"}</p>
            <p className="mt-1 text-xs text-slate-400">2026 / 27 · Term 1</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {visibleNav.map(([label, ItemIcon, key]) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${section === key ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <ItemIcon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f6f8fc]/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
            <Icon size={18} className="text-blue-600" />
            <span className="font-medium">{current?.[0] ?? "Overview"}</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="relative">
              <button
                aria-label="Account menu"
                aria-expanded={userMenu}
                onClick={() => setUserMenu((value) => !value)}
                className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2.5 text-sm shadow-sm ring-1 ring-slate-200 hover:text-blue-600"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{user?.name?.charAt(0) ?? "U"}</span>
                <ChevronDown size={15} className={`text-slate-400 transition ${userMenu ? "rotate-180" : ""}`} />
              </button>
              {userMenu && (
                <>
                  <button aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="truncate text-sm font-semibold">{user?.name ?? "User"}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{user?.email ?? user?.orgName ?? "Institution account"}</p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">{user?.roles?.join(" · ") ?? "Member"}</p>
                    </div>
                    <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {brandingError && <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Institution branding could not be loaded: {brandingError}</p>}
          {dashboardError && section === "dashboard" && (
            <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{dashboardError}</span>
              <Button size="sm" variant="outline" onClick={() => setDashboardVersion((value) => value + 1)}>Retry</Button>
            </div>
          )}
          {section === "dashboard" ? (
            <DashboardView
              dashboard={dashboard}
              students={students}
              setSection={navigate}
              loading={dashboardLoading}
              onRefresh={() => setDashboardVersion((value) => value + 1)}
              user={user}
            />
          ) : section === "students" ? <StudentDirectory initialStudents={students} />
            : section === "guardians" ? <GuardianWorkspace />
            : section === "academics" ? <AcademicWorkspace />
            : section === "attendance" ? <AttendanceWorkspace />
            : section === "fees" ? <FeeWorkspace canManage={Boolean(user?.permissions?.includes("invoice.create"))} />
            : section === "exams" ? <div className="space-y-6"><ExamWorkspace canManage={Boolean(user?.isPlatformAdmin || user?.permissions?.includes("exam.create") || user?.permissions?.includes("exam.edit"))} />{user?.isPlatformAdmin || user?.permissions?.includes("result.approve") ? <ExamApprovalPanel /> : null}</div>
            : section === "learning" ? (user?.studentId ? <StudentLearning /> : <LearningWorkspace canManage={Boolean(user?.isPlatformAdmin || user?.permissions?.includes("homework.create"))} />)
            : section === "reports" ? <ReportsWorkspace />
            : section === "communication" ? <CommunicationWorkspace />
            : section === "users" ? <UserManagement />
            : section === "employees" ? <EmployeeDirectory />
            : section === "branding" && branding && user?.permissions?.includes("organisation.edit") ? <BrandingSettings branding={branding} onSaved={(updated) => { setBranding(updated); setBrandingError(""); }} />
            : section === "payment-settings" && user?.permissions?.includes("payment.edit") ? <PaymentSettings />
            : <PlaceholderView section={section} />}
        </main>
      </div>
    </div>
  );
}

function DashboardView({
  dashboard,
  students,
  setSection,
  loading,
  onRefresh,
  user,
}: {
  dashboard: Dashboard;
  students: Student[];
  setSection: (section: string) => void;
  loading: boolean;
  onRefresh: () => void;
  user: User | null;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  const greeting = now ? (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome";
  const dateLabel = now ? new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now) : "";
  const fees = dashboard.fees ?? {};
  const billed = Number(fees.total ?? 0);
  const collected = Number(fees.paid ?? 0);
  const collectionRate = billed ? Math.round((collected / billed) * 100) : 0;
  const studentsCount = dashboard.students ?? 0;
  const attendance = dashboard.attendancePercentage ?? 0;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const canAction = (...permissions: string[]) => Boolean(user?.isPlatformAdmin || user?.permissions?.some((permission) => permissions.includes(permission)));
  const quickActions = [
    { label: "Add student", description: "Create a learner profile", section: "students", icon: Users, allowed: canAction("student.create") },
    { label: "Mark attendance", description: "Today's class register", section: "attendance", icon: CalendarCheck, allowed: canAction("attendance.create", "attendance.edit") },
    { label: "Create invoice", description: "Issue a fee invoice", section: "fees", icon: CreditCard, allowed: canAction("invoice.create") },
    { label: "Publish notice", description: "Share an announcement", section: "communication", icon: Megaphone, allowed: canAction("notice.create") },
  ].filter((action) => action.allowed);

  const stats = [
    { label: "Students", value: studentsCount, hint: "Active learner records", tone: "bg-blue-50 text-blue-700", icon: Users },
    { label: "Staff members", value: dashboard.employees ?? 0, hint: "People on your team", tone: "bg-violet-50 text-violet-700", icon: GraduationCap },
    { label: "Attendance today", value: `${attendance}%`, hint: "Present or late", tone: "bg-emerald-50 text-emerald-700", icon: CalendarCheck },
    { label: "Outstanding fees", value: formatNpr(fees.outstanding ?? 0), hint: `${collectionRate}% collected`, tone: "bg-amber-50 text-amber-700", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">{dateLabel}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{greeting}, {firstName}.</h2>
          <p className="mt-2 text-sm text-slate-500">Here is the clearest view of what needs your attention today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          {canViewNav("students", user) && (
            <Button onClick={() => setSection("students")}>
              <Users size={16} />
              View students
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, hint, tone, icon: StatIcon }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
                  <StatIcon size={17} />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{loading ? "—" : value}</p>
              <p className="mt-1 text-xs text-slate-400">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {quickActions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(({ label, description, section: target, icon: ActionIcon }) => (
            <button
              key={label}
              onClick={() => setSection(target)}
              className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                <ActionIcon size={17} />
              </span>
              <p className="mt-3 text-sm font-semibold">{label}</p>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Fee collection</CardTitle>
            <p className="text-sm text-slate-500">Billed, collected and outstanding at a glance.</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Collected</p>
                  <p className="mt-2 text-3xl font-semibold">{formatNpr(collected)}</p>
                </div>
                <p className="text-sm text-slate-300">of {formatNpr(billed)}</p>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                <span>{collectionRate}% collected</span>
                <span>{formatNpr(fees.outstanding ?? 0)} outstanding</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Attendance</p>
                <p className="mt-1 text-xl font-semibold">{attendance}%</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(attendance, 100)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">Learners</p>
                <p className="mt-1 text-xl font-semibold">{studentsCount}</p>
                <p className="mt-2 text-xs text-slate-400">Across your institution</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Latest notices</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Recent announcements for your community.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSection("communication")}>View all</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : dashboard.recentNotices?.length ? (
              dashboard.recentNotices.map((notice) => (
                <button key={notice.id} onClick={() => setSection("communication")} className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40">
                  <div className="flex items-center gap-2">
                    <Badge tone={notice.priority === "urgent" ? "rose" : notice.priority === "high" ? "amber" : "blue"}>{notice.priority ?? "normal"}</Badge>
                    {notice.publishAt && <span className="text-[11px] text-slate-400">{new Date(notice.publishAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{notice.title}</p>
                  {notice.body && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{notice.body}</p>}
                </button>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No notices yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
            <p className="text-sm text-slate-500">What is coming up next on the calendar.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">{[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : dashboard.upcomingEvents?.length ? (
              dashboard.upcomingEvents.map((event) => (
                <button key={event.id} onClick={() => setSection("communication")} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/40">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-xs font-bold uppercase text-violet-700">
                    {event.startDate ? new Date(`${event.startDate}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }) : "—"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{event.title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {event.startTime ?? "All day"}{event.venue ? ` · ${event.venue}` : ""}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No events scheduled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent students</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setSection("students")}>Open directory</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : students.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.slice(0, 6).map((student) => (
                  <button key={String(student.id)} onClick={() => setSection("students")} className="rounded-xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40">
                    <p className="truncate font-medium">{String(student.fullName ?? "Student")}</p>
                    <p className="mt-1 text-xs text-slate-500">{String(student.studentId ?? "-")}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No students have been enrolled yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlaceholderView({ section }: { section: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><FileText className="mx-auto text-slate-300" size={30} /><h2 className="mt-4 text-2xl font-semibold capitalize">{section}</h2><p className="mt-2 text-sm text-slate-500">This module is the next implementation slice. The API and tenant security layer are already connected.</p></div>;
}

const roleNav: Record<string, string[]> = {
  dashboard: ["*"],
  students: ["owner", "principal", "administrator", "teacher", "accountant", "exam_officer"],
  guardians: ["owner", "principal", "administrator", "accountant"],
  academics: ["owner", "principal", "administrator", "teacher", "exam_officer"],
  attendance: ["owner", "principal", "administrator", "teacher", "student", "parent", "guardian"],
  learning: ["owner", "principal", "administrator", "teacher", "student", "parent", "guardian"],
  fees: ["owner", "principal", "administrator", "accountant", "student", "parent", "guardian"],
  exams: ["owner", "principal", "administrator", "teacher", "exam_officer", "student", "parent", "guardian"],
  reports: ["owner", "principal", "administrator", "teacher", "class_teacher", "accountant", "exam_officer"],
  communication: ["*"],
  users: ["owner", "principal", "administrator"],
  branding: ["owner", "principal", "administrator"],
  "payment-settings": ["owner", "principal", "administrator", "accountant"],
};

const permissionNav: Record<string, string> = {
  branding: "organisation.edit",
  "payment-settings": "payment.edit",
  reports: "report.view",
  communication: "notice.view",
};

function canViewNav(section: string, user: User | null) {
  if (!user) return false;
  const required = permissionNav[section];
  if (required) return user.permissions?.includes(required) ?? false;
  const allowedRoles = roleNav[section] ?? [];
  return allowedRoles.includes("*") || user.roles.some((role) => allowedRoles.includes(role));
}
