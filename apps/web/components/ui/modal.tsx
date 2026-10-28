"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, title, description, onClose, children, footer }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previous; };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} /><section className="relative z-10 max-h-[min(90vh,900px)] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><h2 id="modal-title" className="text-lg font-semibold text-slate-950">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></header><div className="p-5 sm:p-7">{children}</div>{footer && <footer className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">{footer}</footer>}</section></div>;
}
