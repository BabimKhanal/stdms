"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, RefreshCw, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ConfirmationDialog } from "./ui/confirmation-dialog";

type LeaveRequest = {
  id: string;
  applicantType: "student" | "employee";
  applicantName?: string;
  type: string;
  customType?: string | null;
  reason: string;
  fromDate: string;
  toDate: string;
  status: "pending" | "approved" | "rejected";
  reviewComment?: string | null;
};

function leaveLabel(row: LeaveRequest) {
  return row.type === "custom" && row.customType ? row.customType : row.type;
}

function statusTone(status: LeaveRequest["status"]) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "rose" as const;
  return "amber" as const;
}

export function LeaveWorkspace({ canApprove }: { canApprove: boolean }) {
  const api = new EduApiClient(undefined, () =>
    localStorage.getItem("edu_access_token"),
  );
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeaveRequest["status"] | "all">("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ row: LeaveRequest; status: "approved" | "rejected" } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<{ data: LeaveRequest[] }>("/leave");
      setRows(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function review(id: string, status: "approved" | "rejected") {
    setReviewing(id);
    setError("");
    setMessage("");
    try {
      await api.put(`/leave/${id}/review`, { status });
      setMessage(`Leave request ${status}.`);
      setReviewTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review leave request");
    } finally {
      setReviewing(null);
    }
  }

  const pending = rows.filter((row) => row.status === "pending");
  const filteredRows = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            Attendance & welfare
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Leave requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {canApprove
              ? "Review requests from learners in your assigned classes."
              : "Track leave requests and their approval status."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      {error && <Alert tone="error" title="Leave requests" onDismiss={() => setError("")}>{error}</Alert>}
      {message && <Alert tone="success" onDismiss={() => setMessage("")}>{message}</Alert>}

      {canApprove && (
        <Card className="border-amber-200/70 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 size={17} className="text-amber-600" />
              Pending approval
              <Badge tone="amber">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">No pending requests for your assigned learners.</p>
            ) : (
              <LeaveTable rows={pending} reviewing={reviewing} onReview={(row, status) => setReviewTarget({ row, status })} />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle>Request history</CardTitle>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as LeaveRequest["status"] | "all")}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            aria-label="Filter leave requests"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading leave requests...</p>
          ) : filteredRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No leave requests found.</p>
          ) : (
            <LeaveTable rows={filteredRows} />
          )}
        </CardContent>
      </Card>
      <ConfirmationDialog open={Boolean(reviewTarget)} title={`${reviewTarget?.status === "approved" ? "Approve" : "Reject"} leave request?`} description={reviewTarget?.row.applicantName ?? "Leave applicant"} consequence={reviewTarget?.status === "approved" ? "This records the leave as approved and communicates the decision to the applicant." : "This records the leave as rejected. Verify the dates and reason before finalizing the decision."} details={reviewTarget ? <div className="text-sm text-slate-700"><p><strong>Dates:</strong> {reviewTarget.row.fromDate} to {reviewTarget.row.toDate}</p><p className="mt-1"><strong>Reason:</strong> {reviewTarget.row.reason}</p></div> : undefined} confirmLabel={reviewTarget?.status === "approved" ? "Approve request" : "Reject request"} tone={reviewTarget?.status === "rejected" ? "danger" : "warning"} busy={Boolean(reviewing)} onClose={() => setReviewTarget(null)} onConfirm={() => reviewTarget && void review(reviewTarget.row.id, reviewTarget.status)} />
    </div>
  );
}

function LeaveTable({
  rows,
  reviewing,
  onReview,
}: {
  rows: LeaveRequest[];
  reviewing?: string | null;
  onReview?: (row: LeaveRequest, status: "approved" | "rejected") => void;
}) {
  return (
    <Table stack>
      <TableHeader>
        <TableRow>
          <TableHead>Applicant</TableHead>
          <TableHead>Leave type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell label="Applicant" className="font-semibold text-slate-900">
              {row.applicantName ?? "Leave applicant"}
            </TableCell>
            <TableCell label="Leave type" className="capitalize">{leaveLabel(row)}</TableCell>
            <TableCell label="Dates" className="whitespace-nowrap">{row.fromDate} to {row.toDate}</TableCell>
            <TableCell label="Reason" className="max-w-xs truncate">{row.reason}</TableCell>
            <TableCell label="Status"><Badge tone={statusTone(row.status)}>{row.status}</Badge></TableCell>
            <TableCell label="Actions" className="text-right">
              {row.status === "pending" && onReview ? (
                <span className="inline-flex gap-2">
                  <Button size="sm" disabled={reviewing === row.id} onClick={() => onReview(row, "approved")}>
                    <Check size={15} /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={reviewing === row.id} onClick={() => onReview(row, "rejected")}>
                    <X size={15} /> Reject
                  </Button>
                </span>
              ) : row.reviewComment ? (
                <span className="text-xs text-slate-500">{row.reviewComment}</span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
