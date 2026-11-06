"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Download, FileText, Plus, Receipt, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { EduApiClient, getApiBaseUrl } from "@edu/api-client";
import { downloadCsv } from "../lib/csv";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Alert } from "./ui/alert";
import { Modal } from "./ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "./ui/toast";
import { FeeRunPanel } from "./fee-run-panel";
import { CloudinaryUpload } from "./cloudinary-upload";
import { FilePreview } from "./file-preview";

type Student = { id: string; fullName?: string; studentId?: string };
type Invoice = { id: string; invoiceNumber: string; studentId: string; studentName?: string; issueDate: string; dueDate: string | null; status: string; displayStatus?: string; total: number; paid: number; balance: number };
type ManualMethod = { id: string; method: string; label: string; enabled: number; instructions: string | null; bankName: string | null; accountName: string | null; accountNumber: string | null; branch: string | null; qrImageUrl: string | null };
type Submission = { submission: { id: string; amount: string; status: string; reference: string | null; proofUrl: string | null }; invoiceNumber: string; studentName: string; methodLabel: string };
const client = () => new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
const money = (value: number) => `Rs ${Number(value).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const selectClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm";
const canPay = (invoice: Invoice) => invoice.status !== "cancelled" && Number(invoice.balance) > 0;

function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children) ? children : null;
  const id = control?.props.id ?? generatedId;
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>{control ? cloneElement(control, { id }) : children}</div>;
}

function LoadingFees() {
  return <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" aria-hidden="true" />Loading invoices…</p>;
}

function InvoiceList({ invoices, actions, empty = "No invoices have been issued yet." }: { invoices: Invoice[]; actions?: (invoice: Invoice) => ReactNode; empty?: string }) {
  if (!invoices.length) return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{empty}</p>;
  return <div className="divide-y divide-slate-100">{invoices.map((invoice) => (
    <article key={invoice.id} className="flex min-w-0 flex-col gap-4 py-5 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-all text-sm font-semibold text-slate-950">{invoice.invoiceNumber}</h3><Badge>{invoice.displayStatus ?? invoice.status}</Badge></div>{invoice.studentName && <p className="mt-1 text-sm text-slate-600">{invoice.studentName}</p>}<p className="mt-1 text-xs leading-5 text-slate-500">Issued {invoice.issueDate} · Due {invoice.dueDate ?? "not set"}</p></div>
      <div className="flex shrink-0 flex-col gap-3 md:items-end"><div><p className="text-lg font-semibold tabular-nums">{money(invoice.status === "cancelled" ? 0 : invoice.balance)}<span className="ml-1 text-xs font-normal text-slate-500">due</span></p><p className="text-xs text-slate-500">{money(invoice.paid)} paid of {money(invoice.total)}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions(invoice)}</div>}</div>
    </article>
  ))}</div>;
}

function ExistingFeeWorkspace({ canCreate, canRecord, canExport }: { canCreate: boolean; canRecord: boolean; canExport: boolean }) {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentLoadVersion, setStudentLoadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await client().get<{ data: Invoice[] }>("/fees/invoices");
      setInvoices(result.data);
    } catch (error) { setError(message(error, "Unable to load invoices")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    if (!showForm) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setStudentsLoading(true); setStudentError("");
      try { const result = await client().get<{ data: Student[] }>("/students?page=1&pageSize=200"); if (active) setStudents(result.data); }
      catch (error) { if (active) setStudentError(message(error, "Unable to load students")); }
      finally { if (active) setStudentsLoading(false); }
    });
    return () => { active = false; };
  }, [showForm, studentLoadVersion]);
  const totals = invoices.filter((invoice) => invoice.status !== "cancelled").reduce((sum, invoice) => ({ total: sum.total + Number(invoice.total), paid: sum.paid + Number(invoice.paid), outstanding: sum.outstanding + Number(invoice.balance) }), { total: 0, paid: 0, outstanding: 0 });
  const visible = useMemo(() => invoices.filter((invoice) => `${invoice.invoiceNumber} ${invoice.studentName ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()) && (statusFilter === "all" || (invoice.displayStatus ?? invoice.status) === statusFilter)), [invoices, search, statusFilter]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setFormError("");
    try {
      await client().post("/fees/invoices", { studentId: form.get("studentId"), issueDate: form.get("issueDate"), dueDate: form.get("dueDate") || null, items: [{ name: form.get("itemName"), amount: Number(form.get("amount")), dueDate: form.get("dueDate") || null }], discount: Number(form.get("discount") || 0), fine: Number(form.get("fine") || 0) });
      setShowForm(false); toast.success("Invoice created", "The invoice has been issued to the student."); await load();
    } catch (error) { setFormError(message(error, "Unable to create invoice")); }
    finally { setSaving(false); }
  }
  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!paying || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setFormError("");
    try {
      await client().post("/fees/payments", { invoiceId: paying.id, amount: Number(form.get("amount")), method: form.get("method"), reference: form.get("reference") || null, notes: form.get("notes") || null });
      setPaying(null); toast.success("Payment recorded", "The invoice balance has been updated."); await load();
    } catch (error) { setFormError(message(error, "Unable to record payment")); }
    finally { setSaving(false); }
  }
  async function openReceipt(invoice: Invoice) {
    const receipt = window.open("", "_blank");
    if (!receipt) { setError("Allow pop-ups to view and print the receipt."); return; }
    receipt.opener = null;
    receipt.document.body.textContent = "Loading receipt…";
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base}/fees/invoices/${invoice.id}/receipt`, { headers: { Authorization: `Bearer ${localStorage.getItem("edu_access_token")}` } });
      if (!response.ok) throw new Error("Unable to load receipt. Please try again.");
      const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/html" }));
      receipt.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { receipt.close(); setError(message(error, "Unable to load receipt")); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-blue-600">Finance workspace</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Fees & invoices</h2><p className="mt-2 text-sm text-slate-500">Issue invoices, track balances and record payments.</p></div>{canCreate && <Button onClick={() => { setFormError(""); setShowForm(true); }}><Plus size={16} />Create invoice</Button>}</div>
    {error && <Alert tone="error" title="Couldn't load finance data" action={<Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>Retry</Button>}>{error}</Alert>}
    <div className="grid gap-4 sm:grid-cols-3">{[["Billed", totals.total], ["Collected", totals.paid], ["Outstanding", totals.outstanding]].map(([label, amount]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-semibold">{loading || error ? "—" : money(Number(amount))}</p></CardContent></Card>)}</div>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Invoices</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} />Refresh</Button>{canExport && <Button size="sm" variant="outline" disabled={loading || !visible.length} onClick={() => downloadCsv("invoices.csv", ["Invoice", "Student", "Issue date", "Due date", "Status", "Total", "Paid", "Balance"], visible.map((invoice) => [invoice.invoiceNumber, invoice.studentName, invoice.issueDate, invoice.dueDate, invoice.displayStatus ?? invoice.status, invoice.total, invoice.paid, invoice.balance]))}><Download size={15} />Export</Button>}</div></div></CardHeader><CardContent className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><Input aria-label="Search invoices" placeholder="Search invoice or student…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter invoices by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${selectClass} sm:w-44`}>{["all", "unpaid", "partial", "paid", "overdue", "cancelled"].map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></div>
      {loading ? <LoadingFees /> : error ? <p className="py-6 text-sm text-slate-500">Invoice data is unavailable. Use Retry above to load it again.</p> : <><p role="status" className="text-xs text-slate-500">{visible.length} of {invoices.length} invoices</p><InvoiceList invoices={visible} empty={invoices.length ? "No invoices match your search or filters." : undefined} actions={(invoice) => <><Button size="sm" variant="outline" onClick={() => void openReceipt(invoice)}><Receipt size={15} />Receipt</Button>{canRecord && canPay(invoice) && <Button size="sm" onClick={() => { setFormError(""); setPaying(invoice); }}>Record payment</Button>}</>} />{!visible.length && invoices.length > 0 && <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</Button>}</>}
    </CardContent></Card>
    <Modal open={showForm} title="Create invoice" description="Issue a fee invoice to a student." onClose={() => { if (!saving) setShowForm(false); }} footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setShowForm(false)}>Cancel</Button><Button form="create-invoice" type="submit" disabled={saving || studentsLoading || Boolean(studentError) || !students.length}>{saving ? "Issuing…" : "Issue invoice"}</Button></div>}>
      <form id="create-invoice" onSubmit={createInvoice} className="space-y-4">{studentError && <Alert tone="error" action={<Button type="button" size="sm" variant="outline" onClick={() => setStudentLoadVersion((value) => value + 1)}>Retry</Button>}>{studentError}</Alert>}{formError && <Alert tone="error">{formError}</Alert>}<fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2"><Field label="Student"><select name="studentId" required disabled={studentsLoading || Boolean(studentError)} className={selectClass}><option value="">{studentsLoading ? "Loading students…" : students.length ? "Select student" : "No students available"}</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName ?? student.studentId}</option>)}</select></Field><Field label="Fee item"><Input name="itemName" maxLength={100} placeholder="e.g. Tuition" required /></Field><Field label="Amount (Rs)"><Input name="amount" type="number" min="0" step="0.01" required /></Field><Field label="Issue date"><Input name="issueDate" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} required /></Field><Field label="Due date (optional)"><Input name="dueDate" type="date" /></Field><Field label="Discount (Rs)"><Input name="discount" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Fine (Rs)"><Input name="fine" type="number" min="0" step="0.01" defaultValue="0" /></Field></fieldset></form>
    </Modal>
    <Modal open={Boolean(paying)} title="Record payment" description={paying ? `${paying.invoiceNumber} · Balance ${money(paying.balance)}` : undefined} onClose={() => { if (!saving) setPaying(null); }} footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setPaying(null)}>Cancel</Button><Button form="record-payment" type="submit" disabled={saving}>{saving ? "Recording…" : "Record payment"}</Button></div>}>
      {paying && <form id="record-payment" onSubmit={addPayment} className="space-y-4">{formError && <Alert tone="error">{formError}</Alert>}<fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2"><Field label="Amount (Rs)"><Input name="amount" type="number" min="0.01" max={Number(paying.balance)} step="0.01" defaultValue={Number(paying.balance)} required /></Field><Field label="Payment method"><select name="method" className={selectClass}><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></Field><Field label="Reference (optional)"><Input name="reference" maxLength={80} /></Field><Field label="Notes (optional)"><Input name="notes" maxLength={300} /></Field></fieldset></form>}
    </Modal>
  </div>;
}

function FamilyFeeWorkspace({ student = false }: { student?: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [error, setError] = useState("");
  const [methodError, setMethodError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState("");
  const [manualInvoice, setManualInvoice] = useState<Invoice | null>(null);
  const [methodId, setMethodId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [formError, setFormError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError(""); setMethodError("");
    try { const result = await client().get<{ data: Invoice[] }>("/fees/invoices"); setInvoices(result.data); }
    catch (error) { setError(message(error, "Unable to load invoices")); }
    finally { setLoading(false); }
    if (!student) {
      try { const result = await client().get<{ data: ManualMethod[] }>("/fees/payment-methods"); setMethods(result.data.filter((method) => Boolean(method.enabled))); }
      catch { setMethodError("Payment methods are temporarily unavailable. Your invoices can still be viewed. Try Refresh or contact the finance office."); }
    }
  }, [student]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const manualMethods = methods.filter((method) => method.method !== "esewa");
  const selectedMethod = manualMethods.find((method) => method.id === methodId);
  const outstanding = invoices.filter((invoice) => invoice.status !== "cancelled").reduce((total, invoice) => total + Math.max(0, Number(invoice.balance)), 0);
  async function pay(invoice: Invoice) {
    if (paying) return;
    setPaying(invoice.id); setError(""); setSuccess("");
    try { const result = await client().post<{ checkoutUrl: string }>("/fees/payments/esewa", { invoiceId: invoice.id }); window.location.assign(result.checkoutUrl); }
    catch (error) { setError(message(error, "Unable to start payment")); setPaying(""); }
  }
  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!manualInvoice || paying || uploadingProof) return;
    const form = new FormData(event.currentTarget);
    setPaying(manualInvoice.id); setFormError("");
    try {
      await client().post("/fees/submissions", { invoiceId: manualInvoice.id, paymentMethodId: methodId, amount: Number(form.get("amount")), reference: form.get("reference") || null, proofUrl: proofUrl || null });
      setManualInvoice(null); setSuccess("Payment proof submitted successfully. The school will review it before updating your balance.");
    } catch (error) { setFormError(message(error, "Unable to submit payment proof")); }
    finally { setPaying(""); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-blue-600">{student ? "Student finance" : "Family finance"}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{student ? "My fees" : "Fees & invoices"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{student ? "Review your invoices and balances. Contact your parent or school finance office to arrange a payment." : "Review your learners’ balances and use the payment options enabled by your school."}</p></div><Button variant="outline" onClick={() => void load()} disabled={loading || Boolean(paying)}><RefreshCw size={16} />Refresh</Button></div>
    {error && <Alert tone="error" title="Finance request failed" onDismiss={() => setError("")}>{error}</Alert>}
    {methodError && <Alert tone="warning">{methodError}</Alert>}
    {success && <Alert tone="success" title="Submitted for review" onDismiss={() => setSuccess("")}>{success}</Alert>}
    <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Total outstanding</p><p className="mt-2 text-3xl font-semibold">{loading || error && !invoices.length ? "—" : money(outstanding)}</p><p className="mt-1 text-xs text-slate-500">{loading ? "Checking your invoices…" : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}</p></CardContent></Card>
    <Card><CardHeader><CardTitle>{student ? "My invoices" : "Invoices"}</CardTitle></CardHeader><CardContent>{loading ? <LoadingFees /> : error && !invoices.length ? <div className="py-8 text-center"><p className="mb-3 text-sm text-slate-500">We couldn’t load your invoices.</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div> : <InvoiceList invoices={invoices} actions={student ? undefined : (invoice) => canPay(invoice) ? <>{methods.some((method) => method.method === "esewa") && <Button size="sm" disabled={Boolean(paying)} onClick={() => void pay(invoice)}>{paying === invoice.id ? "Opening checkout…" : "Pay with eSewa"}</Button>}{manualMethods.length > 0 && <Button size="sm" variant="outline" disabled={Boolean(paying)} onClick={() => { setManualInvoice(invoice); setMethodId(manualMethods[0].id); setProofUrl(""); setFormError(""); }}>Bank / QR payment</Button>}{!methods.length && !methodError && <p className="text-xs text-slate-500">Contact the finance office to pay.</p>}</> : null} />}</CardContent></Card>
    <Modal open={Boolean(manualInvoice)} title="Submit bank / QR payment" description={manualInvoice ? `${manualInvoice.invoiceNumber} · ${manualInvoice.studentName ?? "Learner"}` : undefined} onClose={() => { if (!paying && !uploadingProof) setManualInvoice(null); }} footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={Boolean(paying) || uploadingProof} onClick={() => setManualInvoice(null)}>Cancel</Button><Button form="manual-payment" type="submit" disabled={Boolean(paying) || uploadingProof || !selectedMethod}>{uploadingProof ? "Uploading proof…" : paying ? "Submitting…" : "Submit for review"}</Button></div>}>
      {manualInvoice && <form id="manual-payment" onSubmit={submitManual} className="space-y-5">
        {formError && <Alert tone="error" title="Could not submit payment">{formError}</Alert>}
        <Alert tone="info">Complete the transfer using the details below, then submit the reference or payment proof. Your balance changes after school approval.</Alert>
        <fieldset disabled={Boolean(paying) || uploadingProof} className="space-y-4"><Field label="Payment method"><select className={selectClass} value={methodId} onChange={(event) => { setMethodId(event.target.value); setProofUrl(""); }} required>{manualMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></Field>
          {selectedMethod && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">{selectedMethod.instructions && <p className="whitespace-pre-wrap break-words text-sm leading-6">{selectedMethod.instructions}</p>}<dl className="space-y-2 text-sm">{[["Bank", selectedMethod.bankName], ["Account name", selectedMethod.accountName], ["Account number", selectedMethod.accountNumber], ["Branch", selectedMethod.branch]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-slate-500">{label}</dt><dd className="select-all break-all font-medium">{value}</dd></div>)}</dl>{selectedMethod.qrImageUrl && <FilePreview url={selectedMethod.qrImageUrl} label="Payment QR code" />}</div>}
          <Field label={`Amount (Rs) · maximum ${money(manualInvoice.balance)}`}><Input name="amount" type="number" min="0.01" max={Number(manualInvoice.balance)} step="0.01" defaultValue={Number(manualInvoice.balance)} required /></Field><Field label="Transaction reference (optional)"><Input name="reference" maxLength={120} placeholder="Reference from your bank or payment app" /></Field><div><p className="mb-2 text-sm font-medium text-slate-700">Payment proof (optional)</p><CloudinaryUpload value={proofUrl} onChange={setProofUrl} onUploadingChange={setUploadingProof} folder="payments" accept="image/*,application/pdf" label="Upload payment proof" /></div>
        </fieldset>
      </form>}
    </Modal>
  </div>;
}

function PaymentSubmissionReview() {
  const toast = useToast();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<{ row: Submission; status: "approved" | "rejected" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await client().get<{ data: Submission[] }>("/fees/submissions"); setRows(result.data.filter((row) => row.submission.status === "pending")); }
    catch (error) { setError(message(error, "Unable to load payment submissions")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reviewing || saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setReviewError("");
    try {
      await client().put(`/fees/submissions/${reviewing.row.submission.id}/review`, { status: reviewing.status, reviewNote: form.get("reviewNote") || null });
      toast.success(reviewing.status === "approved" ? "Payment approved" : "Payment rejected", reviewing.status === "approved" ? "The invoice balance has been updated." : "The review decision has been saved.");
      setReviewing(null); await load();
    } catch (error) { setReviewError(message(error, "Unable to review payment")); }
    finally { setSaving(false); }
  }
  return <><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Manual payment approvals</CardTitle><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={15} />Refresh</Button></div></CardHeader><CardContent>
    {error && <Alert tone="error">{error}</Alert>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading payment submissions…</p> : error ? <Button className="mt-4" variant="outline" onClick={() => void load()}>Try again</Button> : rows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No pending bank or QR payments.</p> : <div className="space-y-3">{rows.map((row) => <article key={row.submission.id} className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center"><div className="min-w-0"><p className="break-words font-semibold">{row.invoiceNumber} · {row.studentName}</p><p className="mt-1 break-words text-sm text-slate-500">{row.methodLabel} · {money(Number(row.submission.amount))}{row.submission.reference ? ` · Ref ${row.submission.reference}` : ""}</p>{row.submission.proofUrl && <a className="mt-2 inline-block rounded py-1 text-sm text-blue-600 underline" href={row.submission.proofUrl} target="_blank" rel="noreferrer">View payment proof</a>}</div><div className="flex shrink-0 gap-2"><Button size="sm" onClick={() => { setReviewError(""); setReviewing({ row, status: "approved" }); }}>Approve</Button><Button size="sm" variant="outline" onClick={() => { setReviewError(""); setReviewing({ row, status: "rejected" }); }}>Reject</Button></div></article>)}</div>}
  </CardContent></Card><Modal open={Boolean(reviewing)} title={reviewing?.status === "approved" ? "Approve payment?" : "Reject payment?"} description={reviewing ? `${reviewing.row.studentName} · ${money(Number(reviewing.row.submission.amount))}` : undefined} onClose={() => { if (!saving) setReviewing(null); }} footer={<div className="flex justify-end gap-2"><Button disabled={saving} variant="outline" onClick={() => setReviewing(null)}>Cancel</Button><Button disabled={saving} variant={reviewing?.status === "rejected" ? "danger" : "primary"} type="submit" form="review-payment">{saving ? "Saving…" : reviewing?.status === "approved" ? "Approve payment" : "Reject payment"}</Button></div>}>
    <form id="review-payment" onSubmit={review} className="space-y-4">{reviewError && <Alert tone="error">{reviewError}</Alert>}<p className="text-sm leading-6 text-slate-600">{reviewing?.status === "approved" ? "Confirm that the payment has reached the school account. Approval records the payment and updates the invoice balance." : "Rejecting this submission leaves the invoice balance unchanged."}</p><Field label="Review note (optional)"><Input name="reviewNote" maxLength={500} disabled={saving} placeholder="Add context for this decision" /></Field></form>
  </Modal></>;
}

export function FeeWorkspace({ canManage = true, role, permissions }: { canManage?: boolean; role?: string; permissions?: string[] }) {
  const allowed = (permission: string) => permissions ? permissions.includes(permission) : canManage;
  const canCreate = allowed("invoice.create");
  const canRecord = allowed("payment.edit");
  const canReview = allowed("payment.approve");
  if (!canManage && !canRecord && !canReview && (role === "student" || role === "parent" || role === "guardian")) return <FamilyFeeWorkspace student={role === "student"} />;
  return <Tabs defaultValue="invoices" className="space-y-5"><TabsList ariaLabel="Finance sections"><TabsTrigger value="invoices" icon={<Receipt size={15} />}>Invoices</TabsTrigger>{canCreate && <TabsTrigger value="runs" icon={<FileText size={15} />}>Bulk invoice run</TabsTrigger>}{canReview && <TabsTrigger value="approvals" icon={<ShieldCheck size={15} />}>Payment approvals</TabsTrigger>}</TabsList><TabsContent value="invoices" className="mt-0"><ExistingFeeWorkspace canCreate={canCreate} canRecord={canRecord} canExport={allowed("invoice.export")} /></TabsContent>{canCreate && <TabsContent value="runs" className="mt-0"><FeeRunPanel onComplete={async () => undefined} /></TabsContent>}{canReview && <TabsContent value="approvals" className="mt-0"><PaymentSubmissionReview /></TabsContent>}</Tabs>;
}
