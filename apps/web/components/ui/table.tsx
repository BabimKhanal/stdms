import * as React from "react";
import { cn } from "../../lib/utils";
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) { return <div className="overflow-x-auto"><table className={cn("w-full text-left text-sm", className)} {...props} /></div>; }
export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) { return <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400" {...props} />; }
export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) { return <tbody className="divide-y divide-slate-100" {...props} />; }
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn("transition hover:bg-slate-50/70", className)} {...props} />; }
export function TableHead(props: React.ThHTMLAttributes<HTMLTableCellElement>) { return <th className="px-5 py-3 font-semibold" {...props} />; }
export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) { return <td className="px-5 py-4 text-slate-700" {...props} />; }
