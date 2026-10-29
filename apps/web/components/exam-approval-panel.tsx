"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert } from "./ui/alert";
import { useToast } from "./ui/toast";

type Exam = { id: string; name: string; status: string };

export function ExamApprovalPanel() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try { const result = await api.get<{ data: Exam[] }>("/exams"); setExams(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load exam workflow"); }
  }
  // Initial data load synchronizes this screen with the API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function approve(id: string) { try { await api.post(`/exams/${id}/approve`, {}); await load(); toast.success("Examination approved", "Marks are now locked for editing."); } catch (err) { const message = err instanceof Error ? err.message : "Unable to approve examination"; setError(message); toast.error("Could not approve examination", message); } }
  async function publish(id: string) { try { await api.post(`/exams/${id}/publish`, {}); await load(); toast.success("Results published", "Learners and guardians can now view results."); } catch (err) { const message = err instanceof Error ? err.message : "Unable to publish examination"; setError(message); toast.error("Could not publish results", message); } }

  return <Card><CardHeader><CardTitle>Approval and publishing workflow</CardTitle><p className="text-sm text-slate-500">Approve completed mark entry to lock changes, then publish results to learners and guardians.</p></CardHeader><CardContent className="space-y-3">{error && <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>}{exams.length === 0 ? <p className="text-sm text-slate-500">No examinations available.</p> : exams.map((exam) => <div key={exam.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center"><div><p className="font-medium">{exam.name}</p><p className="text-xs uppercase tracking-wide text-slate-400">{exam.status}</p></div><div className="flex gap-2">{exam.status !== "completed" && exam.status !== "published" && <Button size="sm" variant="outline" onClick={() => void approve(exam.id)}>Approve & lock</Button>}{exam.status === "completed" && <Button size="sm" onClick={() => void publish(exam.id)}>Publish results</Button>}</div></div>)}</CardContent></Card>;
}
