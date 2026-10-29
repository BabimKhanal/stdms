"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  Download,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Alert } from "./ui/alert";
import { downloadCsv } from "../lib/csv";
import { formatNpr } from "../lib/utils";

type Overview = {
  students: number;
  employees: number;
  attendanceRecords: number;
  invoicesTotal: number;
  invoicesPaid: number;
  paymentsTotal: number;
  exams: number;
};

type AttendanceRow = { status: string; count: number };
type FeeRow = { status: string; count: number; total: number; paid: number };
type ExamOption = { id: string; name: string };
type ResultRow = { average: number; count: number };

const attendanceTones: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  late: "bg-amber-500",
  leave: "bg-sky-500",
  excused: "bg-slate-400",
};

const feeTones: Record<string, string> = {
  paid: "bg-emerald-500",
  partial: "bg-amber-500",
  unpaid: "bg-rose-500",
  overdue: "bg-rose-600",
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

export function ReportsWorkspace() {
  const api = useMemo(
    () => new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")),
    [],
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examId, setExamId] = useState("");
  const [results, setResults] = useState<ResultRow | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultsError, setResultsError] = useState("");

  async function loadAttendance(rangeFrom = from, rangeTo = to) {
    const params = new URLSearchParams();
    if (rangeFrom) params.set("from", rangeFrom);
    if (rangeTo) params.set("to", rangeTo);
    const query = params.size ? `?${params}` : "";
    setAttendance(await api.get<AttendanceRow[]>(`/reports/attendance${query}`));
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, feeResult, examResult] = await Promise.all([
        api.get<Overview>("/reports/overview"),
        api.get<FeeRow[]>("/reports/fees"),
        api.get<{ data: ExamOption[] }>("/exams"),
      ]);
      setOverview(overviewResult);
      setFees(feeResult);
      setExams(examResult.data);
      if (!examId && examResult.data[0]) setExamId(examResult.data[0].id);
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!examId) {
      setResults(null);
      return;
    }
    let active = true;
    setResultsLoading(true);
    setResultsError("");
    void api
      .get<ResultRow[]>(`/reports/results?examId=${encodeURIComponent(examId)}`)
      .then((rows) => {
        if (active) setResults(rows[0] ?? null);
      })
      .catch((err: unknown) => {
        if (active) setResultsError(err instanceof Error ? err.message : "Unable to load results");
      })
      .finally(() => {
        if (active) setResultsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, examId]);

  const attendanceTotal = attendance.reduce((sum, row) => sum + Number(row.count), 0);
  const present = attendance
    .filter((row) => ["present", "late"].includes(row.status))
    .reduce((sum, row) => sum + Number(row.count), 0);
  const collectionRate = overview ? percent(overview.invoicesPaid, overview.invoicesTotal) : 0;
  const attendanceRate = percent(present, attendanceTotal);
  const outstanding = overview ? overview.invoicesTotal - overview.invoicesPaid : 0;

  const kpis = [
    { label: "Students", value: overview?.students ?? 0, icon: Users, tone: "text-blue-600 bg-blue-50" },
    { label: "Staff members", value: overview?.employees ?? 0, icon: GraduationCap, tone: "text-violet-600 bg-violet-50" },
    { label: "Attendance rate", value: `${attendanceRate}%`, icon: CalendarCheck, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Fee collection", value: `${collectionRate}%`, icon: CreditCard, tone: "text-amber-600 bg-amber-50" },
  ];

  function exportReport() {
    if (!overview) return;
    downloadCsv("institution-report.csv", ["Metric", "Value"], [
      ["Students", overview.students],
      ["Employees", overview.employees],
      ["Attendance records", overview.attendanceRecords],
      ["Attendance rate", `${attendanceRate}%`],
      ["Invoices total", overview.invoicesTotal],
      ["Invoices paid", overview.invoicesPaid],
      ["Outstanding", outstanding],
      ["Payment total", overview.paymentsTotal],
      ["Examinations", overview.exams],
      ["Exam average", results ? `${results.average}%` : "Not selected"],
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Institution intelligence</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Reports & analytics</h2>
          <p className="mt-2 text-sm text-slate-500">
            A clear read on enrolment, attendance, fees and assessment performance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button onClick={exportReport} disabled={!overview}>
            <Download size={15} />
            Export summary
          </Button>
        </div>
      </div>

      {error && <Alert tone="error" title="Reports" onDismiss={() => setError("")}>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
                  <Icon size={17} />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {loading ? "—" : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-blue-600" />
              Attendance breakdown
            </CardTitle>
            <p className="text-sm text-slate-500">
              Filter by date to inspect a term, month or week.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void loadAttendance().catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Unable to load attendance"),
                );
              }}
            >
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="To date"
              />
              <Button variant="outline">Apply range</Button>
            </form>

            {attendance.length ? (
              <div className="space-y-4">
                {attendance.map((row) => {
                  const total = Number(row.count);
                  const share = percent(total, attendanceTotal);
                  return (
                    <div key={row.status}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize text-slate-700">{row.status}</span>
                        <span className="text-slate-500">
                          {total} · {share}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${attendanceTones[row.status] ?? "bg-blue-500"}`}
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Attendance rate counts present and late records as attended.
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No attendance records in this range.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={18} className="text-amber-600" />
              Fee collection
            </CardTitle>
            <p className="text-sm text-slate-500">
              Invoice status distribution across the institution.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                Outstanding balance
              </p>
              <p className="mt-2 text-3xl font-semibold">{formatNpr(outstanding)}</p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${Math.min(collectionRate, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {collectionRate}% of billed fees collected
              </p>
            </div>
            {fees.length ? (
              fees.map((row) => {
                const total = fees.reduce((sum, item) => sum + Number(item.total), 0);
                const share = percent(Number(row.total), total);
                return (
                  <div key={row.status}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium capitalize text-slate-700">
                        {row.status}
                        <Badge tone={row.status === "paid" ? "green" : row.status === "overdue" ? "rose" : "amber"}>
                          {row.count}
                        </Badge>
                      </span>
                      <span className="text-slate-500">
                        {formatNpr(row.paid)} / {formatNpr(row.total)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${feeTones[row.status] ?? "bg-blue-500"}`}
                        style={{ width: `${Math.min(share, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No invoices have been issued yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-600" />
              Assessment performance
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Average marks for a selected examination.
            </p>
          </div>
          <select
            value={examId}
            onChange={(event) => setExamId(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            aria-label="Select examination"
          >
            <option value="">Select examination</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {resultsError && (
            <Alert tone="error" title="Exam results" onDismiss={() => setResultsError("")}>{resultsError}</Alert>
          )}
          {resultsLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading results…</p>
          ) : results && results.count > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-5">
                <p className="text-sm text-slate-500">Average score</p>
                <p className="mt-2 text-3xl font-semibold">{results.average}%</p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.min(results.average, 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 p-5">
                <p className="text-sm text-slate-500">Mark entries</p>
                <p className="mt-2 text-3xl font-semibold">{results.count}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <BarChart3 size={14} />
                  Records captured for this examination
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {examId ? "No marks have been recorded for this examination yet." : "Select an examination to see performance."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
