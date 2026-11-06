"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert } from "./ui/alert";
import { useToast } from "./ui/toast";
import { ConfirmationDialog } from "./ui/confirmation-dialog";

type Exam = { id: string; name: string; status: string };

export function ExamApprovalPanel() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<{ exam: Exam; action: "approve" | "publish" } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { const result = await api.get<{ data: Exam[] }>("/exams"); setExams(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load exam workflow"); }
  }
  // Initial data load synchronizes this screen with the API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function confirmAction() {
    if (!confirming) return;
    setSaving(true);
    const { exam, action } = confirming;
    try {
      await api.post(`/exams/${exam.id}/${action}`, {});
      setConfirming(null);
      await load();
      if (action === "approve") toast.success("Examination approved", "Marks are now locked for editing.");
      else toast.success("Results published", "Learners and guardians can now view results.");
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to ${action} examination`;
      setError(message);
      toast.error(action === "approve" ? "Could not approve examination" : "Could not publish results", message);
    } finally { setSaving(false); }
  }

  return <><Card><CardHeader><CardTitle>Approval and publishing workflow</CardTitle><p className="text-sm text-slate-500">Approve completed mark entry to lock changes, then publish results to learners and guardians.</p></CardHeader><CardContent className="space-y-3">{error && <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>}{exams.length === 0 ? <p className="text-sm text-slate-500">No examinations available.</p> : exams.map((exam) => <div key={exam.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center"><div><p className="font-medium">{exam.name}</p><p className="text-xs uppercase tracking-wide text-slate-400">{exam.status}</p></div><div className="flex gap-2">{exam.status !== "completed" && exam.status !== "published" && <Button size="sm" variant="outline" onClick={() => setConfirming({ exam, action: "approve" })}>Approve & lock</Button>}{exam.status === "completed" && <Button size="sm" onClick={() => setConfirming({ exam, action: "publish" })}>Publish results</Button>}</div></div>)}</CardContent></Card><ConfirmationDialog open={Boolean(confirming)} title={confirming?.action === "approve" ? "Approve and lock marks?" : "Publish results now?"} description={confirming?.exam.name} consequence={confirming?.action === "approve" ? "Approval locks mark editing. Verify that all subject marks are complete and correct before continuing." : "Published results become visible to learners and guardians immediately and cannot currently be unpublished."} confirmLabel={confirming?.action === "approve" ? "Approve and lock" : "Publish results"} tone={confirming?.action === "publish" ? "danger" : "warning"} busy={saving} onClose={() => setConfirming(null)} onConfirm={() => void confirmAction()} /></>;
}
