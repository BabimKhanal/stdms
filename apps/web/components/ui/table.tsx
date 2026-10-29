import * as React from "react";
import { cn } from "../../lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  stack?: boolean;
};

export function Table({ className, stack = false, ...props }: TableProps) {
  return (
    <div className="table-scroll relative overflow-x-auto">
      <table
        className={cn(
          "w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm",
          stack && "max-md:min-w-0 max-md:[&_thead]:hidden",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "divide-y divide-slate-100 max-md:block max-md:space-y-3 max-md:divide-y-0 max-md:p-3",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-slate-50/70 max-md:block max-md:rounded-2xl max-md:border max-md:border-slate-200 max-md:bg-white max-md:p-4 max-md:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-5 py-3 font-semibold", className)} {...props} />;
}

export function TableCell({
  className,
  label,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return (
    <td
      data-label={label}
      className={cn(
        "px-5 py-4 align-middle text-slate-700",
        label &&
          "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4 max-md:px-0 max-md:py-1.5 max-md:text-right max-md:before:min-w-24 max-md:before:shrink-0 max-md:before:text-left max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-wide max-md:before:text-slate-400 max-md:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t border-slate-100 bg-slate-50/50", className)} {...props} />;
}

export function TableEmpty({ children, colSpan = 12 }: { children?: React.ReactNode; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500">
        {children ?? "No records found."}
      </td>
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="max-md:block max-md:rounded-2xl max-md:border max-md:border-slate-200 max-md:bg-white max-md:p-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-5 py-4 max-md:px-0 max-md:py-1.5">
              <span className="block h-4 animate-pulse rounded-full bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TablePagination({
  page,
  totalPages,
  onChange,
  summary,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  summary?: React.ReactNode;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">{summary ?? `Page ${page} of ${totalPages}`}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-slate-900 px-2 text-sm font-semibold text-white">
          {page}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
