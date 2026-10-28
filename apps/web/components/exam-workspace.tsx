"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { downloadCsv } from "../lib/csv";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
type Exam = {
  id: string;
  name: string;
  type: string;
  academicYearId: string;
  status: string;
  subjectCount?: number;
};
type Option = { id: string; name: string };
type Subject = {
  id: string;
  classId: string;
  subjectId: string;
  className?: string;
  subjectName?: string;
  fullMarks: number;
  passMarks: number;
};
type Result = {
  studentId: string;
  studentName: string;
  percentage: number;
  grade: string | null;
  gpa: number | null;
  rank: number | null;
  sectionRank?: number | null;
  passed: boolean;
};
type Student = { id: string; fullName?: string; studentId?: string };
export function ExamWorkspace({ canManage = true }: { canManage?: boolean }) {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [exams, setExams] = useState<Exam[]>([]);
  const [years, setYears] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [examSubjects, setExamSubjects] = useState<Subject[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [marksSubject, setMarksSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [showExamForm, setShowExamForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() {
    try {
      const [e, y, c, s] = await Promise.all([
        api.get<{ data: Exam[] }>("/exams"),
        api.get<{ data: Option[] }>("/academics/years"),
        api.get<{ data: Option[] }>("/academics/classes"),
        api.get<{ data: Option[] }>("/academics/subjects"),
      ]);
      setExams(e.data);
      setYears(y.data);
      setClasses(c.data);
      setSubjects(s.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load examinations",
      );
    }
  }
  useEffect(() => {
    // Initial data load synchronizes the workspace with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []); // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  async function openExam(exam: Exam) {
    setSelected(exam);
    setMarksSubject(null);
    try {
      const [s, r] = await Promise.all([
        api.get<{ data: Subject[] }>(`/exams/${exam.id}/subjects`),
        api.get<{ data: Result[] }>(`/exams/results?examId=${exam.id}`),
      ]);
      setExamSubjects(s.data);
      setResults(r.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load examination details",
      );
    }
  }
  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api.post("/exams", {
        name: form.get("name"),
        type: form.get("type"),
        academicYearId: form.get("academicYearId"),
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
        status: "draft",
      });
      setShowExamForm(false);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create examination",
      );
    } finally {
      setSaving(false);
    }
  }
  async function addSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api.post(`/exams/${selected.id}/subjects`, {
        classId: form.get("classId"),
        subjectId: form.get("subjectId"),
        fullMarks: Number(form.get("fullMarks")),
        passMarks: Number(form.get("passMarks")),
      });
      setShowSubjectForm(false);
      event.currentTarget.reset();
      await openExam(selected);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add exam subject",
      );
    } finally {
      setSaving(false);
    }
  }
  async function enterMarks(subject: Subject) {
    setMarksSubject(subject);
    try {
      const [s, m] = await Promise.all([
        api.get<{ data: Student[] }>(
          `/students?page=1&pageSize=200&classId=${subject.classId}`,
        ),
        api.get<{
          data: Array<{ studentId: string; marksObtained: number | null }>;
        }>(`/exams/marks/${subject.id}`),
      ]);
      setStudents(s.data);
      setMarks(
        Object.fromEntries(
          m.data.map((item) => [
            item.studentId,
            item.marksObtained == null ? "" : String(item.marksObtained),
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load marks");
    }
  }
  async function publishExam() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/exams/${selected.id}/publish`, {});
      const updated = { ...selected, status: "published" };
      setSelected(updated);
      await load();
      await openExam(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to publish results",
      );
    } finally {
      setSaving(false);
    }
  }
  async function openReportCard(studentId: string) {
    if (!selected) return;
    setError("");
    const win = window.open("", "_blank");
    if (!win) {
      setError("Allow pop-ups to open the report card");
      return;
    }
    try {
      const token = localStorage.getItem("edu_access_token");
      const base =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const response = await fetch(
        `${base}/exams/${selected.id}/report-card/${studentId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!response.ok) throw new Error("Unable to open the report card");
      const html = await response.text();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      win.close();
      setError(
        err instanceof Error ? err.message : "Unable to open the report card",
      );
    }
  }
  async function downloadTranscript(studentId: string) {
    try {
      const token = localStorage.getItem("edu_access_token");
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const response = await fetch(`${base}/exams/transcript/${studentId}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Unable to export transcript");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transcript-${studentId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export transcript");
    }
  }
  async function saveMarks(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!marksSubject) return;
    setSaving(true);
    try {
      await api.post("/exams/marks", {
        examSubjectId: marksSubject.id,
        marks: students.map((student) => ({
          studentId: student.id,
          marksObtained: marks[student.id] ? Number(marks[student.id]) : null,
        })),
      });
      if (selected) await openExam(selected);
      setMarksSubject(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save marks");
    } finally {
      setSaving(false);
    }
  }
  const visible = useMemo(
    () =>
      exams.filter(
        (exam) =>
          `${exam.name} ${exam.type}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "all" || exam.status === status),
      ),
    [exams, search, status],
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Assessment workspace
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Exams & results
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Configure examinations, allocate subjects, enter marks and review
            results.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowExamForm(!showExamForm)}>
            <Plus size={16} />
            {showExamForm ? "Close" : "Create exam"}
          </Button>
        )}
      </header>
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {canManage && showExamForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create examination</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createExam} className="grid gap-4 sm:grid-cols-2">
              <Input name="name" placeholder="Exam name" required />
              <select
                name="type"
                defaultValue="term"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="unit_test">Unit test</option>
                <option value="mid_term">Mid-term</option>
                <option value="term">Term exam</option>
                <option value="final">Final exam</option>
              </select>
              <select
                name="academicYearId"
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Academic year</option>
                {years.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Input name="startDate" type="date" />
              <Input name="endDate" type="date" />
              <Button disabled={saving}>
                {saving ? "Saving..." : "Create examination"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Examinations</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-3 text-slate-400"
                  size={15}
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search exams"
                  className="pl-9"
                />
              </div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="completed">Completed</option>
              </select>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "exams.csv",
                    ["Name", "Type", "Status", "Subjects"],
                    visible.map((exam) => [
                      exam.name,
                      exam.type,
                      exam.status,
                      exam.subjectCount ?? 0,
                    ]),
                  )
                }
              >
                <Download size={15} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Examination</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((exam) => (
                    <tr
                      key={exam.id}
                      onClick={() => void openExam(exam)}
                      className={`cursor-pointer hover:bg-slate-50 ${selected?.id === exam.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium">
                        {exam.name}
                        <span className="block text-xs font-normal text-slate-400">
                          {exam.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge>{exam.status}</Badge>
                      </td>
                      <td className="px-5 py-4">{exam.subjectCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No examinations found.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selected ? `${selected.name} results` : "Select an examination"}
            </CardTitle>
            {selected && canManage && (
              <div className="flex flex-wrap gap-2">
                {selected.status !== "published" && (
                  <Button
                    size="sm"
                    onClick={() => void publishExam()}
                    disabled={saving}
                  >
                    {saving ? "Publishing..." : "Publish results"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSubjectForm(!showSubjectForm)}
                >
                  <Plus size={15} />
                  Subject
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {selected ? (
              <>
                <div className="mb-5 space-y-2 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Configured subjects
                  </p>
                  {examSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"
                    >
                      <span>
                        {subject.subjectName ?? subject.subjectId} ·{" "}
                        {subject.className ?? subject.classId}{" "}
                        <span className="text-slate-400">
                          ({subject.passMarks}/{subject.fullMarks})
                        </span>
                      </span>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void enterMarks(subject)}
                        >
                          Enter marks
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {canManage && showSubjectForm && (
                  <form
                    onSubmit={addSubject}
                    className="mb-5 grid gap-3 rounded-2xl bg-blue-50/40 p-4 sm:grid-cols-2"
                  >
                    <select
                      name="classId"
                      required
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
                      name="subjectId"
                      required
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">Subject</option>
                      {subjects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      name="fullMarks"
                      type="number"
                      min="1"
                      defaultValue="100"
                    />
                    <Input
                      name="passMarks"
                      type="number"
                      min="1"
                      defaultValue="35"
                    />
                    <Button disabled={saving}>Add subject</Button>
                  </form>
                )}
                {canManage && marksSubject ? (
                  <form onSubmit={saveMarks} className="space-y-3">
                    <div className="flex justify-between">
                      <p className="font-medium">
                        Marks:{" "}
                        {marksSubject.subjectName ?? marksSubject.subjectId}
                      </p>
                      <Button disabled={saving}>
                        {saving ? "Saving..." : "Save marks"}
                      </Button>
                    </div>
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm">
                          {student.fullName ?? student.studentId}
                        </span>
                        <Input
                          className="w-28"
                          type="number"
                          min="0"
                          max={marksSubject.fullMarks}
                          value={marks[student.id] ?? ""}
                          onChange={(event) =>
                            setMarks({
                              ...marks,
                              [student.id]: event.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </form>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-400">
                      <tr>
                        <th className="py-2">Student</th>
                        <th className="py-2">Percentage</th>
                        <th className="py-2">Grade</th>
                        <th className="py-2">GPA</th>
                        <th className="py-2">Rank</th>
                        <th className="py-2">Result</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((result) => (
                        <tr key={result.studentId}>
                          <td className="py-3">{result.studentName}</td>
                          <td className="py-3">{result.percentage}%</td>
                          <td className="py-3">{result.grade ?? "—"}</td>
                          <td className="py-3">
                            {result.gpa === null ? "—" : result.gpa.toFixed(2)}
                          </td>
                          <td className="py-3">{result.rank ?? "—"}</td>
                          <td className="py-3">
                            <Badge>{result.passed ? "Passed" : "Failed"}</Badge>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void openReportCard(result.studentId)}>Report card</Button><Button size="sm" variant="ghost" onClick={() => void downloadTranscript(result.studentId)}>Transcript</Button></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                Select an examination to review results.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <GradingScalePanel canManage={canManage} />
    </div>
  );
}

type ScaleBand = {
  id: string;
  minPercent: number | string;
  maxPercent: number | string;
  grade: string;
  gpa: number | string;
};
type GradingScale = {
  id: string;
  name: string;
  isDefault: boolean;
  bands: ScaleBand[];
};

function GradingScalePanel({ canManage }: { canManage: boolean }) {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const result = await api.get<{ data: GradingScale[] }>(
        "/exams/grading-scales",
      );
      setScales(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load grading scales",
      );
    }
  }
  async function makeDefault(id: string) {
    setSaving(true);
    setError("");
    try {
      await api.post(`/exams/grading-scales/${id}/default`, {});
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to set the default scale",
      );
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    // Initial data load synchronizes the workspace with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []); // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  if (!scales.length && !error) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grading scale</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Grades, GPA and report cards use the default scale.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {scales.map((scale) => (
          <div
            key={scale.id}
            className="rounded-2xl border border-slate-100 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{scale.name}</p>
                {scale.isDefault && <Badge>Default</Badge>}
              </div>
              {canManage && !scale.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void makeDefault(scale.id)}
                >
                  Use as default
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...scale.bands]
                .sort((a, b) => Number(b.minPercent) - Number(a.minPercent))
                .map((band) => (
                  <span
                    key={band.id}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {band.grade} · {Number(band.minPercent)}–
                    {Number(band.maxPercent)}% · GPA{" "}
                    {Number(band.gpa).toFixed(2)}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
