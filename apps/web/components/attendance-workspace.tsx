"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Download, Search, Users } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { downloadCsv } from "../lib/csv";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type ClassOption = { id: string; name: string };
type SectionOption = { id: string; name: string; classId: string };
type SubjectOption = { id: string; name: string };
type PeriodOption = {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
};
type Student = {
  id: string;
  fullName?: string;
  studentId?: string;
  className?: string | null;
  sectionName?: string | null;
};
type Attendance = {
  id: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  classId?: string | null;
  sectionId?: string | null;
  date: string;
  periodId?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  periodName?: string | null;
  status: string;
  remarks?: string | null;
};
type Status = "present" | "absent" | "late" | "leave" | "excused" | "sick";
type AttendanceSetting = { minimumPercentage: number; countLateAsPresent: number; excludeLeave: number; excludeExcused: number; excludeSick: number };
type LowAttendance = { studentId: string; studentName?: string; percentage: number; threshold: number; total: number };
const statuses: Status[] = [
  "present",
  "absent",
  "late",
  "leave",
  "excused",
  "sick",
];
const today = new Date().toISOString().slice(0, 10);

export function AttendanceWorkspace() {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [records, setRecords] = useState<Attendance[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [markClassId, setMarkClassId] = useState("");
  const [markSectionId, setMarkSectionId] = useState("");
  const [markSubjectId, setMarkSubjectId] = useState("");
  const [markPeriodId, setMarkPeriodId] = useState("");
  const [markDate, setMarkDate] = useState(today);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attendanceSetting, setAttendanceSetting] = useState<AttendanceSetting>({ minimumPercentage: 75, countLateAsPresent: 1, excludeLeave: 1, excludeExcused: 1, excludeSick: 1 });
  const [lowAttendance, setLowAttendance] = useState<LowAttendance[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => {
    Promise.all([
      api.get<{ data: Attendance[] }>("/attendance"),
      api.get<{ data: ClassOption[] }>("/academics/classes"),
      api.get<{ data: SectionOption[] }>("/academics/sections"),
      api.get<{ data: SubjectOption[] }>("/academics/subjects"),
      api.get<{ data: PeriodOption[] }>("/timetable/periods"),
    ])
      .then(
        ([
          attendance,
          classResult,
          sectionResult,
          subjectResult,
          periodResult,
        ]) => {
          setRecords(attendance.data);
          setClasses(classResult.data);
          setSections(sectionResult.data);
          setSubjects(subjectResult.data);
          setPeriods(periodResult.data);
        },
      )
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Unable to load attendance",
        ),
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void api.get<AttendanceSetting>("/attendance/settings").then(setAttendanceSetting).catch(() => undefined);
    void api.get<{ data: LowAttendance[] }>("/attendance/low").then((result) => setLowAttendance(result.data)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleSections = sections.filter(
    (section) => !markClassId || section.classId === markClassId,
  );
  const visible = useMemo(
    () =>
      records.filter((record) => {
        const haystack =
          `${record.studentName ?? ""} ${record.studentCode ?? ""}`.toLowerCase();
        return (
          haystack.includes(search.toLowerCase()) &&
          (classId === "all" || record.classId === classId) &&
          (status === "all" || record.status === status) &&
          (!from || record.date >= from) &&
          (!to || record.date <= to)
        );
      }),
    [records, search, classId, status, from, to],
  );
  const studentsToMark = students.filter((student) =>
    `${student.fullName ?? ""} ${student.studentId ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const attendanceSummary = useMemo(() => {
    const total = records.length;
    const count = (value: string) =>
      records.filter((record) => record.status === value).length;
    return {
      total,
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      rate: total
        ? Math.round(((count("present") + count("late")) * 100) / total)
        : 0,
    };
  }, [records]);
  async function loadStudents() {
    if (!markClassId || !markSectionId) {
      setError("Choose a class and section first.");
      return;
    }
    setLoadingStudents(true);
    setError("");
    setMessage("");
    try {
      const result = await api.get<{ data: Student[] }>(
        `/students?page=1&pageSize=200&classId=${markClassId}&sectionId=${markSectionId}`,
      );
      setStudents(result.data);
      const existing = records.filter(
        (record) =>
          record.date === markDate &&
          record.sectionId === markSectionId &&
          (record.subjectId ?? null) === (markSubjectId || null) &&
          (record.periodId ?? null) === (markPeriodId || null),
      );
      setMarks(
        Object.fromEntries(
          result.data.map((student) => [
            student.id,
            (existing.find((record) => record.studentId === student.id)
              ?.status as Status | undefined) ?? "present",
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students");
    } finally {
      setLoadingStudents(false);
    }
  }
  async function saveAttendance() {
    if (!markSectionId || !students.length) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.post("/attendance/mark", {
        sectionId: markSectionId,
        date: markDate,
        periodId: markPeriodId || null,
        subjectId: markSubjectId || null,
        records: students.map((student) => ({
          studentId: student.id,
          status: marks[student.id] ?? "present",
          remarks: null,
        })),
      });
      setMessage("Attendance saved successfully.");
      const refreshed = await api.get<{ data: Attendance[] }>("/attendance");
      setRecords(refreshed.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save attendance",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSettings() {
    setSavingSettings(true);
    try {
      const saved = await api.put<AttendanceSetting>("/attendance/settings", attendanceSetting);
      setAttendanceSetting(saved);
      const low = await api.get<{ data: LowAttendance[] }>("/attendance/low");
      setLowAttendance(low.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attendance settings");
    } finally {
      setSavingSettings(false);
    }
  }
  function exportRecords() {
    downloadCsv(
      "attendance.csv",
      ["Date", "Student", "Student ID", "Class", "Subject", "Period", "Status", "Remarks"],
      visible.map((record) => [
        record.date,
        record.studentName,
        record.studentCode,
        classes.find((item) => item.id === record.classId)?.name ?? "-",
        record.subjectName ?? "Whole day",
        record.periodName ?? "-",
        record.status,
        record.remarks,
      ]),
    );
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Daily operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Attendance
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Mark today’s register, review history, and export records.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportRecords}
          disabled={!visible.length}
        >
          <Download size={15} />
          Export records
        </Button>
      </header>
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Overall attendance", `${attendanceSummary.rate}%`],
          ["Present records", attendanceSummary.present],
          ["Absent records", attendanceSummary.absent],
          ["Late records", attendanceSummary.late],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-blue-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check size={18} className="text-blue-600" />
            Mark class attendance
          </CardTitle>
          <p className="text-sm text-slate-500">
            Select a class, load its students, and save the complete register.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={markClassId}
              onChange={(event) => {
                setMarkClassId(event.target.value);
                setMarkSectionId("");
                setStudents([]);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={markSectionId}
              onChange={(event) => {
                setMarkSectionId(event.target.value);
                setStudents([]);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Section</option>
              {visibleSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select value={markSubjectId} onChange={(event) => { setMarkSubjectId(event.target.value); setStudents([]); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Whole day attendance</option>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={markPeriodId} onChange={(event) => { setMarkPeriodId(event.target.value); setStudents([]); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">No period / all day</option>
              {periods.map((item) => <option key={item.id} value={item.id}>{item.name}{item.startTime ? ` · ${item.startTime}` : ""}</option>)}
            </select>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute right-3 top-3 text-slate-400"
                size={15}
              />
              <Input
                type="date"
                value={markDate}
                onChange={(event) => setMarkDate(event.target.value)}
                aria-label="Attendance date"
              />
            </div>
            <Button
              disabled={loadingStudents}
              onClick={() => void loadStudents()}
            >
              <Users size={15} />
              {loadingStudents ? "Loading..." : "Load students"}
            </Button>
          </div>
          {students.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsToMark.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.fullName ?? "Student"}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {student.studentId ?? "-"}
                      </TableCell>
                      <TableCell>
                        <select
                          value={marks[student.id] ?? "present"}
                          onChange={(event) =>
                            setMarks((current) => ({
                              ...current,
                              [student.id]: event.target.value as Status,
                            }))
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm capitalize"
                        >
                          {statuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
                <p className="text-sm text-slate-500">
                  {students.length} students loaded for {markDate}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setMarks(
                        Object.fromEntries(
                          students.map((student) => [
                            student.id,
                            "present" as Status,
                          ]),
                        ),
                      )
                    }
                  >
                    Mark all present
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setMarks(
                        Object.fromEntries(
                          students.map((student) => [
                            student.id,
                            "absent" as Status,
                          ]),
                        ),
                      )
                    }
                  >
                    Mark all absent
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void saveAttendance()}
                  >
                    {saving ? "Saving..." : "Save attendance"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Attendance rules</CardTitle><p className="text-sm text-slate-500">Set how percentages and low-attendance alerts are calculated.</p></CardHeader>
          <CardContent className="space-y-3">
            <label className="grid gap-1 text-sm"><span className="font-medium">Minimum attendance percentage</span><Input type="number" min="0" max="100" value={attendanceSetting.minimumPercentage} onChange={(event) => setAttendanceSetting({ ...attendanceSetting, minimumPercentage: Number(event.target.value) })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(attendanceSetting.countLateAsPresent)} onChange={(event) => setAttendanceSetting({ ...attendanceSetting, countLateAsPresent: event.target.checked ? 1 : 0 })} /> Count late as present</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(attendanceSetting.excludeLeave)} onChange={(event) => setAttendanceSetting({ ...attendanceSetting, excludeLeave: event.target.checked ? 1 : 0 })} /> Exclude approved leave</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(attendanceSetting.excludeExcused)} onChange={(event) => setAttendanceSetting({ ...attendanceSetting, excludeExcused: event.target.checked ? 1 : 0 })} /> Exclude excused records</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(attendanceSetting.excludeSick)} onChange={(event) => setAttendanceSetting({ ...attendanceSetting, excludeSick: event.target.checked ? 1 : 0 })} /> Exclude sick records</label>
            <Button size="sm" disabled={savingSettings} onClick={() => void saveSettings()}>{savingSettings ? "Saving..." : "Save attendance rules"}</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Low-attendance students</CardTitle><p className="text-sm text-slate-500">Students below the configured {attendanceSetting.minimumPercentage}% threshold.</p></CardHeader>
          <CardContent>{lowAttendance.length ? <div className="divide-y divide-slate-100">{lowAttendance.map((row) => <div key={row.studentId} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{row.studentName ?? "Student"}</p><p className="text-xs text-slate-500">{row.total} attendance records</p></div><Badge tone="rose">{row.percentage}%</Badge></div>)}</div> : <p className="text-sm text-slate-500">No students are currently below the threshold.</p>}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={15}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or ID"
                className="pl-9"
              />
            </div>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
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
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject / period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="font-medium">
                      {record.studentName ?? "-"}
                    </TableCell>
                    <TableCell>{record.studentCode ?? "-"}</TableCell>
                    <TableCell>
                      {classes.find((item) => item.id === record.classId)
                        ?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{record.subjectName ?? "Whole day"}</span>
                      <span className="block text-xs text-slate-500">{record.periodName ?? "Daily register"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          record.status === "present"
                            ? "green"
                            : record.status === "absent"
                              ? "rose"
                              : record.status === "late"
                                ? "amber"
                                : "slate"
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.remarks ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!visible.length && (
              <p className="py-10 text-center text-sm text-slate-500">
                No attendance records match these filters.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
