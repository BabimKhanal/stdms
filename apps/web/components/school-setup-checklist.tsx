"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight, Check, GraduationCap, RefreshCw } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import type { AcademicWorkspaceTarget, SchoolSetupStatus, SchoolSetupTarget } from "@edu/shared";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

function useSchoolSetup(version: number) {
  const [data, setData] = useState<SchoolSetupStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError("");
      try {
        const result = await new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")).get<SchoolSetupStatus>("/dashboard/setup");
        if (active) setData(result);
      } catch (error) {
        if (active) { setData(null); setError(error instanceof Error ? error.message : "Unable to check school setup"); }
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [version, retry]);
  return { data, error, loading, refresh: () => setRetry((value) => value + 1) };
}

function canAct(target: SchoolSetupTarget, permissions: string[]) {
  const canChange = permissions.includes("academic.create") || (["years", "assignments"].includes(target) && permissions.includes("academic.edit"));
  return canChange && (target !== "assignments" || permissions.includes("user.view"));
}

export function SchoolSetupChecklist({ onNavigate, permissions, refreshVersion = 0 }: { onNavigate: (section: string) => void; permissions: string[]; refreshVersion?: number }) {
  const { data, error, loading, refresh } = useSchoolSetup(refreshVersion);
  const titleId = useId();
  if (error) return <Alert tone="warning" title="School setup could not be checked" action={<Button size="sm" variant="outline" onClick={refresh}>Retry</Button>}>{error} Your setup progress has not been changed.</Alert>;
  if (!data) return <Card><CardContent className="flex items-center gap-3 p-5"><RefreshCw size={18} className="animate-spin text-blue-600" aria-hidden="true" /><p role="status" className="text-sm text-slate-500">Checking your school setup…</p></CardContent></Card>;
  const next = data.steps.find((step) => step.target === data.nextTarget);
  return <section aria-labelledby={titleId} aria-busy={loading} className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${data.ready ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}><GraduationCap size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Getting started</p><h3 id={titleId} className="mt-1 text-lg font-semibold text-slate-950">{data.ready ? "Academic setup ready" : "Let’s set up your school"}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{data.ready ? "Your academic foundation is configured. You can now move on to enrolment, timetables and daily teaching workflows." : "Complete these five steps to prepare your school for enrolment, attendance and learning. Progress comes from your saved records."}</p></div></div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Check progress</Button>
      </div>
      <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium text-slate-700">{data.completedSteps} of {data.totalSteps} steps complete</span><span className="text-slate-500">{data.currentYear ? `Current year: ${data.currentYear.name}` : "No single current year selected"}</span></div><div role="progressbar" aria-label="School setup progress" aria-valuemin={0} aria-valuemax={data.totalSteps} aria-valuenow={data.completedSteps} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] ${data.ready ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${data.completedSteps / data.totalSteps * 100}%` }} /></div></div>
      {next && <div className="flex flex-col justify-between gap-3 rounded-xl bg-blue-50 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-blue-950">Next: {next.title}</p><p className="mt-1 text-sm leading-6 text-blue-800">{next.detail}</p>{!canAct(next.target, permissions) && <p className="mt-2 text-xs text-blue-800">Ask an administrator with academic setup{next.target === "assignments" ? " and user-management" : ""} permissions to complete this step.</p>}</div><Button disabled={loading || !canAct(next.target, permissions)} onClick={() => onNavigate(`academics/${next.target}`)}>Continue setup<ArrowRight size={16} /></Button></div>}
      <details open={!data.ready} className="group"><summary className="cursor-pointer rounded-lg py-1 text-sm font-medium text-slate-700">{data.ready ? "Review completed setup steps" : "Setup checklist"}</summary><ol className="mt-3 divide-y divide-slate-100">{data.steps.map((step, index) => <li key={step.target} className="flex min-w-0 flex-wrap items-start gap-3 py-4"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${step.complete ? "bg-emerald-50 text-emerald-700" : step.target === data.nextTarget ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`} aria-hidden="true">{step.complete ? <Check size={16} /> : <span className="text-xs font-semibold">{index + 1}</span>}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{step.title}<span className={`ml-2 text-xs font-medium ${step.complete ? "text-emerald-700" : "text-slate-500"}`}>{step.complete ? "Complete" : step.target === data.nextTarget ? "Next step" : "To do"}</span></p><p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p><p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p></div><Button size="sm" variant="outline" disabled={loading || !canAct(step.target, permissions)} onClick={() => onNavigate(`academics/${step.target}`)}>{step.complete ? "Review" : "Set up"}<ArrowRight size={14} /></Button></li>)}</ol></details>
    </div>
  </section>;
}

export function AcademicSetupGuide({ target, permissions, onNavigate, version, onSaved }: { target: AcademicWorkspaceTarget; permissions: string[]; onNavigate: (section: string) => void; version: number; onSaved: () => void }) {
  const { data, error, loading, refresh } = useSchoolSetup(version);
  const [selectedYear, setSelectedYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const yearId = useId();
  async function chooseCurrentYear() {
    if (!selectedYear || saving) return;
    setSaving(true); setSaveError("");
    try {
      await new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")).put(`/academics/years/${selectedYear}`, { isCurrent: true });
      onSaved();
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to select the current year"); }
    finally { setSaving(false); }
  }
  if (error) return <Alert tone="warning" title="Setup guidance unavailable" action={<Button size="sm" variant="outline" onClick={refresh}>Retry</Button>}>{error}</Alert>;
  if (!data) return <p role="status" className="text-sm text-slate-500">Checking setup prerequisites…</p>;
  const step = data.steps.find((item) => item.target === target);
  const index = data.steps.findIndex((item) => item.target === target);
  const prerequisite = data.steps.slice(0, Math.max(0, index)).find((item) => !item.complete);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{step ? `School setup · step ${index + 1} of ${data.totalSteps}` : "School setup"}</p><h2 className="mt-1 font-semibold text-blue-950">{step?.title ?? "Prepare your weekly timetable"}</h2><p className="mt-1 text-sm leading-6 text-blue-800">{step?.detail ?? "Configure your periods, subjects and teacher assignments before scheduling lessons."}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={loading || saving} onClick={() => onNavigate("dashboard")}>Back to setup checklist</Button>{step?.complete && data.nextTarget && canAct(data.nextTarget, permissions) && <Button size="sm" onClick={() => onNavigate(`academics/${data.nextTarget}`)}>Next setup step<ArrowRight size={14} /></Button>}</div></div>
    {prerequisite && <Alert tone="info" title="An earlier setup step needs attention" action={<Button size="sm" variant="outline" onClick={() => onNavigate(`academics/${prerequisite.target}`)}>Open step {data.steps.indexOf(prerequisite) + 1}</Button>}>{prerequisite.detail}</Alert>}
    {target === "years" && data.years.length > 0 && permissions.includes("academic.edit") && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label htmlFor={yearId} className="mb-2 block text-sm font-medium text-slate-700">Choose the current academic year</label><select id={yearId} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} disabled={saving || loading} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select a year</option>{data.years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (current)" : ""}</option>)}</select></div><Button disabled={!selectedYear || saving || loading} onClick={() => void chooseCurrentYear()}>{saving ? "Updating…" : "Use selected year"}</Button></div>}
    {saveError && <Alert tone="error" onDismiss={() => setSaveError("")}>{saveError}</Alert>}
    {target === "assignments" && data.teacherAccounts === 0 && <Alert tone="info" title="Set up teacher access first"><p>A teaching assignment needs an active staff profile linked to an active user with the Teacher or Class Teacher role.</p><div className="mt-3 flex flex-wrap gap-2">{permissions.includes("employee.view") && <Button size="sm" variant="outline" onClick={() => onNavigate("employees")}>Open staff profiles</Button>}{permissions.includes("user.view") && <Button size="sm" variant="outline" onClick={() => onNavigate("users")}>Open user management</Button>}</div></Alert>}
  </div>;
}

export function SchoolSetupPrerequisiteNotice({ onNavigate, permissions }: { onNavigate: (section: string) => void; permissions: string[] }) {
  const { data, error, refresh } = useSchoolSetup(0);
  if (error) return <Alert tone="warning" title="Academic prerequisites could not be checked" action={<Button size="sm" variant="outline" onClick={refresh}>Retry</Button>}>{error}</Alert>;
  const missing = data?.steps.find((step) => ["years", "classes", "sections"].includes(step.target) && !step.complete);
  if (!missing) return null;
  return <Alert tone="info" title="Finish your academic setup" action={<Button size="sm" variant="outline" disabled={!canAct(missing.target, permissions)} onClick={() => onNavigate(`academics/${missing.target}`)}>Set up academics</Button>}>{missing.detail} Configure your academic year, classes and sections before placing students or marking a class register.</Alert>;
}
