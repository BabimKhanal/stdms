import { cn } from "../../lib/utils";

type Tone = "slate" | "blue" | "green" | "amber" | "rose" | "violet" | "sky";

const tones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200/60",
  blue: "bg-blue-50 text-blue-700 ring-blue-200/60",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/60",
  rose: "bg-rose-50 text-rose-700 ring-rose-200/60",
  violet: "bg-violet-50 text-violet-700 ring-violet-200/60",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/60",
};

export function Badge({
  className,
  tone = "slate",
  children,
}: {
  className?: string;
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize leading-none ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
