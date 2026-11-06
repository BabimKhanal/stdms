"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "default",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "lg";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Native modal dialogs contain focus and make the background inert, including
    // when one dialog opens another. Keep this effect independent of onClose.
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="animate-overlay-in fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-end justify-center overflow-y-auto border-0 bg-slate-950/40 p-2 text-slate-950 backdrop:bg-transparent open:flex sm:items-center sm:p-6"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const dialog = event.currentTarget;
        if (event.target instanceof Element && event.target.closest("dialog") !== dialog) return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((control) => control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {open && (
      <section
        className={cn(
          "animate-modal-in relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:max-h-[90dvh]",
          size === "lg" ? "sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <header className="z-10 flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7">
          {children}
        </div>
        {footer && (
          <footer className="z-10 shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
            {footer}
          </footer>
        )}
      </section>
      )}
    </dialog>
  );
}
