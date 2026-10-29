"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

type ToastTone = "success" | "error" | "warning" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = ToastInput & {
  id: number;
  tone: ToastTone;
  duration: number;
};

type ToastApi = {
  show: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastTone, { icon: typeof CheckCircle2; iconClass: string; bar: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-emerald-600", bar: "bg-emerald-500" },
  error: { icon: XCircle, iconClass: "text-rose-600", bar: "bg-rose-500" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-600", bar: "bg-amber-500" },
  info: { icon: Info, iconClass: "text-blue-600", bar: "bg-blue-500" },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    ({ title, description, tone = "info", duration = 4500 }: ToastInput) => {
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        duration = Math.max(duration, 6000);
      }
      const id = nextId++;
      setItems((current) => [...current.slice(-3), { id, title, description, tone, duration }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, tone: "success" }),
      error: (title, description) => show({ title, description, tone: "error" }),
      warning: (title, description) => show({ title, description, tone: "warning" }),
      info: (title, description) => show({ title, description, tone: "info" }),
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:px-0 sm:pb-0"
      >
        {items.map((item) => {
          const { icon: Icon, iconClass, bar } = toneStyles[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              style={{ animationDuration: "260ms", "--toast-duration": `${item.duration}ms` } as React.CSSProperties}
              className="animate-toast-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur"
            >
              <div className="flex items-start gap-3 p-4 pr-10">
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-50", iconClass)}>
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
              </button>
              <span className={cn("toast-progress absolute inset-x-0 bottom-0 h-0.5 origin-left", bar)} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

const fallback: ToastApi = {
  show: () => undefined,
  success: () => undefined,
  error: () => undefined,
  warning: () => undefined,
  info: () => undefined,
  dismiss: () => undefined,
};

export function useToast() {
  return useContext(ToastContext) ?? fallback;
}
