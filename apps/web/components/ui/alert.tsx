"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type AlertTone = "info" | "success" | "warning" | "error";

const tones: Record<
  AlertTone,
  { icon: typeof Info; wrap: string; iconWrap: string; title: string; body: string }
> = {
  info: {
    icon: Info,
    wrap: "border-blue-200/70 bg-blue-50/80",
    iconWrap: "bg-blue-100 text-blue-700",
    title: "text-blue-950",
    body: "text-blue-800/80",
  },
  success: {
    icon: CheckCircle2,
    wrap: "border-emerald-200/70 bg-emerald-50/80",
    iconWrap: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-950",
    body: "text-emerald-800/80",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-amber-200/70 bg-amber-50/80",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-amber-950",
    body: "text-amber-800/80",
  },
  error: {
    icon: XCircle,
    wrap: "border-rose-200/70 bg-rose-50/80",
    iconWrap: "bg-rose-100 text-rose-700",
    title: "text-rose-950",
    body: "text-rose-800/80",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  onDismiss,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const style = tones[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-alert-in flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        style.wrap,
        className,
      )}
    >
      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", style.iconWrap)}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={cn("font-semibold", style.title)}>{title}</p>}
        {children && <div className={cn(title ? "mt-0.5" : "", style.body)}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded-lg p-1 text-slate-500/70 transition hover:bg-white/70 hover:text-slate-800"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
