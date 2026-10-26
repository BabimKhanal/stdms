"use client";

import { Download, Filter, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function quoteCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadSelectedCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers.map(quoteCsv).join(","), ...rows.map((row) => row.map(quoteCsv).join(","))].join("\n");
  const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function TableToolbar({
  search,
  onSearch,
  placeholder = "Search...",
  children,
  onReset,
  hasFilters = false,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  onReset?: () => void;
  hasFilters?: boolean;
}) {
  return <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center">
    {onSearch && <Input value={search ?? ""} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} className="lg:max-w-xs" />}
    <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
    {hasFilters && onReset && <Button type="button" size="sm" variant="ghost" onClick={onReset}><X size={14} />Reset</Button>}
  </div>;
}

export function BulkBar({ count, onExport, onClear }: { count: number; onExport?: () => void; onClear: () => void }) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
    <strong>{count}</strong> selected
    {onExport && <Button type="button" size="sm" variant="outline" onClick={onExport}><Download size={14} />Export selected</Button>}
    <Button type="button" size="sm" variant="ghost" onClick={onClear}>Clear</Button>
  </div>;
}

export function BulkExportButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={disabled}><Download size={14} />Export filtered</Button>;
}

export function SelectAll({ checked, onChange, label = "Select all" }: { checked: boolean; onChange: () => void; label?: string }) {
  return <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><input aria-label={label} type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300 text-blue-600" /></label>;
}

export function FilterButton({ active, onClick }: { active?: boolean; onClick: () => void }) {
  return <Button type="button" size="sm" variant={active ? "secondary" : "outline"} onClick={onClick}><Filter size={14} />Filters</Button>;
}
