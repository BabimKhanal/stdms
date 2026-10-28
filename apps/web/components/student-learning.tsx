"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  Link2,
  Paperclip,
  Star,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CloudinaryUpload } from "./cloudinary-upload";
import { FilePreview } from "./file-preview";

type Homework = {
  id: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  description: string | null;
  assignedDate: string;
  submissionDate: string | null;
  attachmentUrl?: string | null;
  attachmentUrls?: string[];
  link: string | null;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  maxMarks: number | null;
};

type Submission = {
  id: string;
  content: string | null;
  fileUrl: string | null;
  status: string;
  marks: number | null;
  feedback: string | null;
  submittedAt: string | null;
};

function attachmentsFor(item: Homework) {
  if (item.attachmentUrls?.length) return item.attachmentUrls;
  if (!item.attachmentUrl) return [];
  try {
    const parsed = JSON.parse(item.attachmentUrl);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [item.attachmentUrl];
  } catch {
    return [item.attachmentUrl];
  }
}

function dueMeta(value: string | null) {
  if (!value) return { label: "No due date", tone: "slate" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil(
    (new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000,
  );
  if (days < 0) return { label: "Past due", tone: "rose" };
  if (days === 0) return { label: "Due today", tone: "amber" };
  if (days === 1) return { label: "Due tomorrow", tone: "amber" };
  return { label: `${days} days left`, tone: "green" };
}

function dueClass(tone: string) {
  if (tone === "rose") return "bg-rose-50 text-rose-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

export function StudentLearning() {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .get<{ data: Homework[] }>("/homework")
      .then((result) => setItems(result.data))
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Unable to load your homework",
        ),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-200 sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-300">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/20">
              <BookOpen size={16} />
            </span>
            My learning
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Homework, resources and feedback.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Read the instructions, attach your work and keep an eye on the due
            date. Everything your teacher posts lands here.
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-14 text-center text-sm text-slate-500">
          Loading assignments...
        </p>
      ) : items.length ? (
        <div className="space-y-4">
          {items.map((item) => (
            <StudentAssignment key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={28} />
            <p className="mt-3 font-medium text-slate-900">
              You&apos;re all caught up
            </p>
            <p className="mt-1 text-sm text-slate-500">
              New homework will appear here when your teacher posts it.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StudentAssignment({ item }: { item: Homework }) {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .get<{ data: Submission[] }>(`/homework/${item.id}/submissions`)
      .then((result) => {
        const own = result.data[0];
        if (!active || !own) return;
        setSubmission(own);
        setContent(own.content ?? "");
        setFileUrl(own.fileUrl ?? "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const due = dueMeta(item.submissionDate);
  const files = attachmentsFor(item);

  async function submit() {
    if (!content.trim() && !fileUrl) {
      setError("Write an answer or attach a file before submitting.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.post<Submission>(
        `/homework/${item.id}/submissions`,
        { content: content.trim() || null, fileUrl: fileUrl || null },
      );
      setSubmission(saved);
      setMessage("✓ Submission saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{item.title}</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            {item.subjectName ?? "Subject"} · {item.className ?? "Class"}
            {item.sectionName ? ` · ${item.sectionName}` : ""}
          </p>
        </div>
        <span
          className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${dueClass(due.tone)}`}
        >
          {due.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.description && (
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
            {item.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} />
            Due {item.submissionDate ?? "not set"}
          </span>
          {item.maxMarks !== null && (
            <span className="inline-flex items-center gap-1.5">
              <Star size={14} />
              {item.maxMarks} marks
            </span>
          )}
          {files.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Paperclip size={14} />
              {files.length} resource{files.length === 1 ? "" : "s"}
            </span>
          )}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              <Link2 size={14} />
              Open link
            </a>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <FileText size={13} />
                Resource {index + 1}
              </a>
            ))}
          </div>
        )}

        {submission && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              {submission.marks === null ? (
                <CheckCircle2 size={14} />
              ) : (
                <Star size={14} />
              )}
              {submission.marks === null
                ? "Submitted — waiting for grading"
                : `Graded · ${submission.marks}${item.maxMarks ? ` / ${item.maxMarks}` : ""}`}
            </p>
            {submission.feedback && (
              <p className="mt-2 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-700">
                  Teacher feedback:
                </span>{" "}
                {submission.feedback}
              </p>
            )}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide my answer" : submission ? "Update my answer" : "Submit my work"}
        </Button>

        {open && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Type your answer here..."
              maxLength={3000}
              className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6"
            />
            <CloudinaryUpload
              folder="assignments"
              accept="image/*,.pdf"
              value={fileUrl}
              onChange={setFileUrl}
              label={fileUrl ? "Replace attachment" : "Attach image or PDF"}
            />
            {fileUrl && <FilePreview url={fileUrl} label="Your attachment" />}
            {error && <p className="text-xs text-rose-700">{error}</p>}
            {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
            <Button disabled={saving} onClick={() => void submit()}>
              {saving ? "Saving..." : submission ? "Update submission" : "Submit assignment"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
