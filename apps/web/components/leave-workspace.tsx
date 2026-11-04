"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, RefreshCw, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function review(id: string, status: "approved" | "rejected") {
    setReviewing(id);
    setError("");
    setMessage("");
    try {
      await api.put(`/leave/${id}/review`, { status });
      setMessage(`Leave request ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review leave request");
    } finally {
      setReviewing(null);
    }
  }

  const pending = rows.filter((row) => row.status === "pending");

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
              <div className="space-y-3">
                {pending.map((row) => (
                  <LeaveRow
                    key={row.id}
                    row={row}
                    reviewing={reviewing === row.id}
                    onReview={review}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Request history</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading leave requests...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No leave requests found.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <LeaveRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveRow({
  row,
  reviewing = false,
  onReview,
}: {
  row: LeaveRequest;
  reviewing?: boolean;
  onReview?: (id: string, status: "approved" | "rejected") => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{row.applicantName ?? "Leave applicant"}</p>
          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
        </div>
        <p className="mt-1 text-sm font-medium capitalize text-slate-700">
          {leaveLabel(row)} · {row.fromDate} to {row.toDate}
        </p>
        <p className="mt-1 text-sm text-slate-500">{row.reason}</p>
        {row.reviewComment && <p className="mt-1 text-xs text-slate-500">Review note: {row.reviewComment}</p>}
      </div>
      {row.status === "pending" && onReview && (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" disabled={reviewing} onClick={() => void onReview(row.id, "approved")}>
            <Check size={15} /> Approve
          </Button>
          <Button size="sm" variant="outline" disabled={reviewing} onClick={() => void onReview(row.id, "rejected")}>
            <X size={15} /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}
