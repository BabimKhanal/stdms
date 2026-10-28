"use client";

import { useEffect, useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type Structure = { id: string; name: string; className?: string; totalAmount?: number };

export function FeeRunPanel({ onComplete }: { onComplete: () => Promise<void> }) {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [structures, setStructures] = useState<Structure[]>([]);
  const [structureId, setStructureId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; invoiceIds: string[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.get<{ data: Structure[] }>("/fees/structures").then((response) => setStructures(response.data)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await api.post<{ created: number; skipped: number; invoiceIds: string[] }>("/fees/invoices/generate", {
        feeStructureId: structureId,
        dueDate,
        ...(sectionId ? { sectionId } : {}),
      });
      setResult(response);
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate invoices");
    } finally {
      setSaving(false);
    }
  }

  async function openReceipt(invoiceId: string) {
    const token = localStorage.getItem("edu_access_token");
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    const response = await fetch(`${base}/fees/invoices/${invoiceId}/receipt`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error("Unable to open receipt");
    const windowRef = window.open("", "_blank");
    if (!windowRef) throw new Error("Allow pop-ups to open the receipt");
    windowRef.document.write(await response.text());
    windowRef.document.close();
  }

  return <Card className="border-blue-200"><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18} className="text-blue-600" />Bulk invoice run</CardTitle><p className="text-sm text-slate-500">Generate one invoice per enrolled student from a class fee structure. Repeating the same run is safe.</p></CardHeader><CardContent><form onSubmit={generate} className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]"><select value={structureId} onChange={(event) => setStructureId(event.target.value)} required className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select fee structure</option>{structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}{structure.className ? ` · ${structure.className}` : ""}</option>)}</select><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required aria-label="Invoice due date" /><Input value={sectionId} onChange={(event) => setSectionId(event.target.value)} placeholder="Section ID (optional)" aria-label="Section ID" /><Button disabled={saving}>{saving ? "Generating..." : "Generate invoices"}</Button></form>{error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}{result && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Generated {result.created} invoice{result.created === 1 ? "" : "s"}; skipped {result.skipped} existing.</p>{result.invoiceIds.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{result.invoiceIds.slice(0, 10).map((invoiceId) => <Button key={invoiceId} size="sm" variant="outline" onClick={() => void openReceipt(invoiceId)}><Receipt size={14} />Open receipt</Button>)}</div>}</div>}</CardContent></Card>;
}
