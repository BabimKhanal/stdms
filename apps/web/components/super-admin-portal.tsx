"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

type PlatformUser = { name: string; email?: string | null };
type Organisation = {
  id: string;
  name: string;
  slug: string;
  academicType: string;
  status: "active" | "trial" | "suspended";
  plan: string;
  email?: string | null;
  country?: string;
  currency?: string;
  maxStudents: number;
  maxUsers: number;
  maxStorageMb: number;
  primaryColor: string;
  secondaryColor: string;
  createdAt: string;
  userCount: number;
  studentCount: number;
};
type PlatformStats = { organisations: number; users: number; students: number };
type PlatformHealth = {
  ok: boolean;
  checks: { database: "up" | "down"; redis: "up" | "down" };
  durationMs: number;
};
type PlatformAudit = {
  id: string;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  createdAt: string;
};
type FeatureFlag = { id: string; flag: string; enabled: boolean };
type TenantForm = {
  name: string;
  slug: string;
  academicType: string;
  status: Organisation["status"];
  plan: string;
  email: string;
  country: string;
  currency: string;
  maxStudents: string;
  maxUsers: string;
  maxStorageMb: string;
};
type Panel = "overview" | "tenants" | "monitoring" | "backups" | "provisioning";

const featureCatalog = [
  "students",
  "academics",
  "attendance",
  "fees",
  "exams",
  "library",
  "transport",
  "hostel",
  "hr",
  "admissions",
];

const emptyForm: TenantForm = {
  name: "",
  slug: "",
  academicType: "school",
  status: "trial",
  plan: "starter",
  email: "",
  country: "Nepal",
  currency: "NPR",
  maxStudents: "500",
  maxUsers: "100",
  maxStorageMb: "5120",
};

function client() {
  return new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function statusTone(status: Organisation["status"]) {
  if (status === "active")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "suspended") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function inputClass() {
  return "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
}

export function SuperAdminPortal({
  user,
  onLogout,
}: {
  user: PlatformUser;
  onLogout: () => void;
}) {
  const [panel, setPanel] = useState<Panel>("overview");
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    organisations: 0,
    users: 0,
    students: 0,
  });
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [activity, setActivity] = useState<PlatformAudit[]>([]);
  const [activityError, setActivityError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantDialog, setTenantDialog] = useState(false);
  const [editing, setEditing] = useState<Organisation | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [featureTenant, setFeatureTenant] = useState<Organisation | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [featureError, setFeatureError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      client().get<{ data: Organisation[] }>("/super/organisations"),
      client().get<PlatformStats>("/super/stats"),
      client().get<PlatformHealth>("/super/health"),
    ])
      .then(([organisationList, nextStats, nextHealth]) => {
        if (!active) return;
        setOrganisations(organisationList.data);
        setStats(nextStats);
        setHealth(nextHealth);
        setActivityError("");
        void client()
          .get<PlatformAudit[]>("/super/audit")
          .then((nextActivity) => {
            if (active) setActivity(nextActivity);
          })
          .catch((cause: unknown) => {
            if (active)
              setActivityError(
                cause instanceof Error
                  ? cause.message
                  : "Platform activity is unavailable",
              );
          });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load platform data",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!featureTenant) return;
    let active = true;
    setFeatureLoading(true);
    setFeatureError("");
    client()
      .get<FeatureFlag[]>(`/super/organisations/${featureTenant.id}/features`)
      .then((flags) => {
        if (active) setFeatureFlags(flags);
      })
      .catch((cause: unknown) => {
        if (active)
          setFeatureError(
            cause instanceof Error
              ? cause.message
              : "Unable to load feature access",
          );
      })
      .finally(() => {
        if (active) setFeatureLoading(false);
      });
    return () => {
      active = false;
    };
  }, [featureTenant]);

  const activeTenants = organisations.filter(
    (organisation) => organisation.status === "active",
  ).length;
  const trialTenants = organisations.filter(
    (organisation) => organisation.status === "trial",
  ).length;
  const suspendedTenants = organisations.filter(
    (organisation) => organisation.status === "suspended",
  ).length;
  const visibleOrganisations = organisations.filter((organisation) => {
    const matchesSearch =
      `${organisation.name} ${organisation.slug} ${organisation.email ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    return (
      matchesSearch &&
      (statusFilter === "all" || organisation.status === statusFilter)
    );
  });

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setTenantDialog(true);
  }

  function openEdit(organisation: Organisation) {
    setEditing(organisation);
    setForm({
      name: organisation.name,
      slug: organisation.slug,
      academicType: organisation.academicType,
      status: organisation.status,
      plan: organisation.plan,
      email: organisation.email ?? "",
      country: organisation.country ?? "Nepal",
      currency: organisation.currency ?? "NPR",
      maxStudents: String(organisation.maxStudents),
      maxUsers: String(organisation.maxUsers),
      maxStorageMb: String(organisation.maxStorageMb),
    });
    setTenantDialog(true);
  }

  async function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      academicType: form.academicType,
      status: form.status,
      plan: form.plan.trim(),
      email: form.email.trim(),
      country: form.country.trim(),
      currency: form.currency.trim().toUpperCase(),
      maxStudents: Number(form.maxStudents),
      maxUsers: Number(form.maxUsers),
      maxStorageMb: Number(form.maxStorageMb),
    };
    try {
      if (editing)
        await client().put(`/super/organisations/${editing.id}`, payload);
      else await client().post("/super/organisations", payload);
      setTenantDialog(false);
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save tenant",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeature(flag: string, enabled: boolean) {
    if (!featureTenant) return;
    setFeatureError("");
    try {
      const saved = await client().put<FeatureFlag>(
        `/super/organisations/${featureTenant.id}/features/${flag}`,
        { enabled },
      );
      setFeatureFlags((current) => [
        ...current.filter((item) => item.flag !== flag),
        saved,
      ]);
    } catch (cause) {
      setFeatureError(
        cause instanceof Error
          ? cause.message
          : "Unable to update feature access",
      );
    }
  }

  const navigation: { key: Panel; label: string; icon: typeof Activity }[] = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "tenants", label: "Tenants", icon: Building2 },
    { key: "monitoring", label: "Monitoring", icon: Server },
    { key: "backups", label: "Backups", icon: Archive },
    { key: "provisioning", label: "Provisioning", icon: SlidersHorizontal },
  ];
  const heading =
    navigation.find((item) => item.key === panel)?.label ?? "Overview";

  return (
    <div className="min-h-screen bg-[#f3f5f2] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-[#18211f] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#b8f34a] text-slate-950">
            <GraduationCap size={20} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-wide">NUCLEUS</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Platform console
            </p>
          </div>
        </div>
        <nav
          className="flex-1 space-y-1 px-3 py-6"
          aria-label="Platform navigation"
        >
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Control plane
          </p>
          {navigation.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPanel(key)}
              aria-current={panel === key ? "page" : undefined}
              className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${panel === key ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon
                size={17}
                className={panel === key ? "text-[#b8f34a]" : ""}
              />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 min-w-0 px-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-400">
              {user.email ?? "Platform administrator"}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f3f5f2]/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Platform operations
                </p>
                <h1 className="truncate text-lg font-semibold">{heading}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${health?.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${health?.ok ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                {health?.ok ? "Systems operational" : "Check system status"}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label="Refresh platform data"
                title="Refresh"
                onClick={refresh}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </Button>
              <button
                onClick={onLogout}
                aria-label="Sign out"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-rose-600 lg:hidden"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto border-t border-slate-200 px-3 py-2 lg:hidden"
            aria-label="Platform navigation"
          >
            {navigation.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPanel(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${panel === key ? "bg-[#18211f] text-white" : "text-slate-600 hover:bg-white"}`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-370 space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">{error}</div>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}

          {panel === "overview" && (
            <div className="space-y-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    SaaS operations
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Platform overview
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Tenant footprint and service health across the platform.
                  </p>
                </div>
                <Button onClick={openCreate}>
                  <Plus size={16} />
                  Add tenant
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Tenants",
                    value: stats.organisations,
                    detail: `${activeTenants} active · ${trialTenants} trial`,
                    icon: Building2,
                    accent: "text-emerald-800 bg-emerald-100",
                  },
                  {
                    label: "Tenant users",
                    value: stats.users,
                    detail: "Across all organisations",
                    icon: Users,
                    accent: "text-blue-800 bg-blue-100",
                  },
                  {
                    label: "Students",
                    value: stats.students,
                    detail: "Platform-wide records",
                    icon: GraduationCap,
                    accent: "text-orange-800 bg-orange-100",
                  },
                  {
                    label: "Dependencies",
                    value: health?.ok
                      ? "Healthy"
                      : loading
                        ? "Checking"
                        : "Attention",
                    detail: health
                      ? `${health.durationMs} ms readiness check`
                      : "Database and cache",
                    icon: Activity,
                    accent: health?.ok
                      ? "text-emerald-800 bg-emerald-100"
                      : "text-amber-800 bg-amber-100",
                  },
                ].map(({ label, value, detail, icon: Icon, accent }) => (
                  <Card key={label} className="rounded-lg shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                          <p className="mt-3 text-2xl font-semibold">
                            {loading
                              ? "—"
                              : typeof value === "number"
                                ? formatNumber(value)
                                : value}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {detail}
                          </p>
                        </div>
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-lg ${accent}`}
                        >
                          <Icon size={17} />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Tenant status</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Organisation lifecycle at a glance.
                      </p>
                    </div>
                    <button
                      onClick={() => setPanel("tenants")}
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:text-emerald-950"
                    >
                      All tenants
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Active",
                        value: activeTenants,
                        tone: "bg-emerald-500",
                      },
                      {
                        label: "Trial",
                        value: trialTenants,
                        tone: "bg-amber-500",
                      },
                      {
                        label: "Suspended",
                        value: suspendedTenants,
                        tone: "bg-rose-500",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between border-y border-slate-200 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2 w-2 rounded-full ${item.tone}`}
                          />
                          <span className="text-sm text-slate-600">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-xl font-semibold">
                          {formatNumber(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="border-l-0 border-slate-200 xl:border-l xl:pl-6">
                  <h3 className="text-base font-semibold">Infrastructure</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest dependency probe.
                  </p>
                  <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                    <HealthRow
                      label="API"
                      status="up"
                      detail="Platform API responded"
                    />
                    <HealthRow
                      label="PostgreSQL"
                      status={health?.checks.database ?? "down"}
                      detail="Primary application database"
                    />
                    <HealthRow
                      label="Redis"
                      status={health?.checks.redis ?? "down"}
                      detail="Cache and ephemeral state"
                    />
                  </div>
                  <button
                    onClick={() => setPanel("monitoring")}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-800"
                  >
                    Monitoring details
                    <ArrowUpRight size={14} />
                  </button>
                </section>
              </div>
              <section>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">Platform activity</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Recent tenant and module-access changes.
                  </p>
                </div>
                {activityError && (
                  <p role="status" className="mb-3 text-xs text-amber-800">
                    Activity feed unavailable: {activityError}
                  </p>
                )}
                {activity.length ? (
                  <div className="divide-y divide-slate-200 border-y border-slate-200">
                    {activity.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {entry.action.replaceAll(".", " ")}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {entry.entity}
                            {entry.entityId
                              ? ` · ${entry.entityId}`
                              : ""} · {entry.actorName ?? "Unknown operator"}
                          </p>
                        </div>
                        <time className="text-xs text-slate-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="border-y border-slate-200 py-6 text-sm text-slate-500">
                    No platform actions recorded yet.
                  </p>
                )}
              </section>
              <section>
                <div className="mb-3">
                  <h3 className="text-base font-semibold">
                    Recently added tenants
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Newest organisations on the platform.
                  </p>
                </div>
                <TenantRows
                  organisations={[...organisations]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .slice(0, 5)}
                  onEdit={openEdit}
                  onFeatures={setFeatureTenant}
                />
              </section>
            </div>
          )}

          {panel === "tenants" && (
            <section className="space-y-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    Customer organisations
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Tenant directory
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Manage tenant configuration, lifecycle, plans, and module
                    access.
                  </p>
                </div>
                <Button onClick={openCreate}>
                  <Plus size={16} />
                  Add tenant
                </Button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className={`${inputClass()} pl-9`}
                    aria-label="Search tenants"
                    placeholder="Search name, slug, or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <select
                  className={`${inputClass()} sm:w-44`}
                  aria-label="Filter tenants by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <TenantRows
                organisations={visibleOrganisations}
                onEdit={openEdit}
                onFeatures={setFeatureTenant}
                emptyLabel={
                  loading ? "Loading tenants…" : "No matching tenants."
                }
              />
              <p className="text-xs text-slate-500">
                Showing {visibleOrganisations.length} of {organisations.length}{" "}
                tenants · {suspendedTenants} suspended
              </p>
            </section>
          )}

          {panel === "monitoring" && (
            <section className="space-y-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    Runtime dependencies
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Service monitoring
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Live readiness for the API, database, and cache.
                  </p>
                </div>
                <Button variant="outline" onClick={refresh} disabled={loading}>
                  <RefreshCw
                    size={15}
                    className={loading ? "animate-spin" : ""}
                  />
                  Probe now
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <MonitorCard
                  icon={Server}
                  name="API"
                  state="up"
                  description="Authenticated platform API"
                />
                <MonitorCard
                  icon={Database}
                  name="PostgreSQL"
                  state={health?.checks.database ?? "down"}
                  description="Primary application data store"
                />
                <MonitorCard
                  icon={Activity}
                  name="Redis"
                  state={health?.checks.redis ?? "down"}
                  description="Cache dependency"
                />
              </div>
              <div className="border-y border-slate-200 py-4 text-sm text-slate-600">
                <span className="font-medium text-slate-900">
                  Probe duration:
                </span>{" "}
                {health ? `${health.durationMs} ms` : "Unavailable"}
                <span className="mx-3 text-slate-300">|</span>
                <span className="font-medium text-slate-900">
                  Overall:
                </span>{" "}
                {health?.ok ? "Ready" : "Degraded or unavailable"}
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <CircleHelp
                  size={17}
                  className="mt-0.5 shrink-0 text-slate-500"
                />
                <p>
                  This view reports dependency readiness, not historical uptime
                  or application error rates. Those require a metrics and
                  alerting provider.
                </p>
              </div>
            </section>
          )}

          {panel === "backups" && (
            <section className="space-y-6">
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Data protection
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  Backups and recovery
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Backup operations must be connected to the hosting provider
                  before they can be managed here.
                </p>
              </div>
              <div className="max-w-3xl border-y border-slate-200 py-7">
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                    <Archive size={20} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        Application backup integration
                      </h3>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Not configured
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      No backup provider, schedule, or restore-job API is
                      configured in this application. Backup and restore actions
                      are unavailable until an encrypted storage target,
                      retention policy, and recovery workflow are provisioned.
                    </p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <X size={15} className="text-amber-700" />
                        Scheduled snapshots
                      </p>
                      <p className="flex items-center gap-2">
                        <X size={15} className="text-amber-700" />
                        Verified restore history
                      </p>
                      <p className="flex items-center gap-2">
                        <X size={15} className="text-amber-700" />
                        Per-tenant exports
                      </p>
                      <p className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-emerald-700" />
                        Restore actions remain disabled
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {panel === "provisioning" && (
            <section className="space-y-6">
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Tenant lifecycle
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  Provisioning and seeding
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Create production tenants safely; keep demo data separate from
                  customer data.
                </p>
              </div>
              <div className="grid gap-8 border-y border-slate-200 py-6 lg:grid-cols-2">
                <div>
                  <div className="flex items-center gap-3">
                    <Building2 size={19} className="text-emerald-800" />
                    <h3 className="font-semibold">Tenant provisioning</h3>
                  </div>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                    Create a tenant with its academic profile, plan, limits, and
                    status. Set up the school administrator through the
                    institution’s secure account onboarding flow.
                  </p>
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus size={15} />
                    Create tenant
                  </Button>
                </div>
                <div className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={19} className="text-amber-700" />
                    <h3 className="font-semibold">Demo data seeding</h3>
                  </div>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                    The existing demo seed is a developer CLI operation that
                    wipes and recreates demo records. It is not exposed here and
                    must never run against customer production data.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    <ShieldCheck size={14} />
                    Production seeding disabled
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {tenantDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTenantDialog(false);
          }}
        >
          <form
            onSubmit={saveTenant}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            aria-labelledby="tenant-form-title"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Tenant profile
                </p>
                <h2
                  id="tenant-form-title"
                  className="mt-1 text-xl font-semibold"
                >
                  {editing ? "Edit tenant" : "Create tenant"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTenantDialog(false)}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <label className="space-y-1.5 text-sm font-medium">
                Organisation name
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  className={inputClass()}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Tenant slug
                <input
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  maxLength={80}
                  className={inputClass()}
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: event.target.value.toLowerCase() })
                  }
                />
                <span className="block text-xs font-normal text-slate-500">
                  Lowercase letters, numbers, and hyphens.
                </span>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Institution type
                <select
                  className={inputClass()}
                  value={form.academicType}
                  onChange={(event) =>
                    setForm({ ...form, academicType: event.target.value })
                  }
                >
                  <option value="school">School</option>
                  <option value="college">College</option>
                  <option value="academy">Academy</option>
                  <option value="university">University</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Status
                <select
                  className={inputClass()}
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as Organisation["status"],
                    })
                  }
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Plan
                <input
                  required
                  maxLength={60}
                  className={inputClass()}
                  value={form.plan}
                  onChange={(event) =>
                    setForm({ ...form, plan: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Contact email
                <input
                  type="email"
                  className={inputClass()}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Country
                <input
                  required
                  className={inputClass()}
                  value={form.country}
                  onChange={(event) =>
                    setForm({ ...form, country: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Currency code
                <input
                  required
                  minLength={3}
                  maxLength={3}
                  className={inputClass()}
                  value={form.currency}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Student limit
                <input
                  required
                  type="number"
                  min="0"
                  max="1000000"
                  className={inputClass()}
                  value={form.maxStudents}
                  onChange={(event) =>
                    setForm({ ...form, maxStudents: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                User limit
                <input
                  required
                  type="number"
                  min="0"
                  max="100000"
                  className={inputClass()}
                  value={form.maxUsers}
                  onChange={(event) =>
                    setForm({ ...form, maxUsers: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Storage limit (MB)
                <input
                  required
                  type="number"
                  min="0"
                  max="10000000"
                  className={inputClass()}
                  value={form.maxStorageMb}
                  onChange={(event) =>
                    setForm({ ...form, maxStorageMb: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTenantDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                {editing ? "Save changes" : "Create tenant"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {featureTenant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFeatureTenant(null);
          }}
        >
          <section
            className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="features-title"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Module access
                </p>
                <h2 id="features-title" className="mt-1 text-xl font-semibold">
                  {featureTenant.name}
                </h2>
              </div>
              <button
                onClick={() => setFeatureTenant(null)}
                aria-label="Close feature access"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            {featureError && (
              <p
                role="alert"
                className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
              >
                {featureError}
              </p>
            )}
            <div className="divide-y divide-slate-100 px-5 py-2">
              {featureLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Loading feature access…
                </p>
              ) : (
                featureCatalog.map((flag) => {
                  const configured = featureFlags.find(
                    (item) => item.flag === flag,
                  );
                  const enabled = configured?.enabled ?? true;
                  return (
                    <div
                      key={flag}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {flag.replaceAll("-", " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {configured ? "Tenant override" : "Default access"}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`${flag} module access`}
                        onClick={() => void toggleFeature(flag, !enabled)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-700" : "bg-slate-300"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-5.5" : "left-0.5"}`}
                        />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={() => setFeatureTenant(null)}>
                Done
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HealthRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: "up" | "down";
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status === "up" ? "text-emerald-800" : "text-rose-700"}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${status === "up" ? "bg-emerald-500" : "bg-rose-500"}`}
        />
        {status === "up" ? "Operational" : "Unavailable"}
      </span>
    </div>
  );
}

function MonitorCard({
  icon: Icon,
  name,
  state,
  description,
}: {
  icon: typeof Activity;
  name: string;
  state: "up" | "down";
  description: string;
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
            <Icon size={18} />
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${state === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
          >
            {state === "up" ? "Operational" : "Unavailable"}
          </span>
        </div>
        <h3 className="mt-5 font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function TenantRows({
  organisations,
  onEdit,
  onFeatures,
  emptyLabel = "No tenants have been created yet.",
}: {
  organisations: Organisation[];
  onEdit: (organisation: Organisation) => void;
  onFeatures: (organisation: Organisation) => void;
  emptyLabel?: string;
}) {
  if (!organisations.length)
    return (
      <div className="border-y border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  return (
    <div className="overflow-x-auto border-y border-slate-200">
      <table className="w-full min-w-190 border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Organisation</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Plan</th>
            <th className="px-3 py-3">Usage</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Created</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {organisations.map((organisation) => (
            <tr key={organisation.id} className="group hover:bg-white/70">
              <td className="px-3 py-3.5">
                <p className="font-medium">{organisation.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {organisation.slug}
                  {organisation.email ? ` · ${organisation.email}` : ""}
                </p>
              </td>
              <td className="px-3 py-3.5">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusTone(organisation.status)}`}
                >
                  {organisation.status}
                </span>
              </td>
              <td className="px-3 py-3.5 text-sm capitalize">
                {organisation.plan}
              </td>
              <td className="px-3 py-3.5 text-xs text-slate-600">
                {formatNumber(organisation.studentCount)} students ·{" "}
                {formatNumber(organisation.userCount)} users
              </td>
              <td className="px-3 py-3.5 text-sm capitalize">
                {organisation.academicType}
              </td>
              <td className="px-3 py-3.5 text-sm text-slate-600">
                {new Date(organisation.createdAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-3.5">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFeatures(organisation)}
                  >
                    <SlidersHorizontal size={14} />
                    Modules
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(organisation)}
                  >
                    Manage
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
