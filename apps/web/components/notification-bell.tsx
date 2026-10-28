"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";

type Notification = { id: string; title: string; body: string | null; createdAt: string; readAt: string | null };

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return new Date(value).toLocaleString();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function client() {
  return new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    void client().get<{ data: Notification[] }>("/notifications")
      .then((result) => { if (active) setItems(result.data ?? []); })
      .catch(() => { if (active) setError("Could not load notifications."); })
      .finally(() => { if (active) setLoaded(true); });
    const token = localStorage.getItem("edu_access_token");
    if (token) {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      socket = new WebSocket(`${base.replace(/^http/, "ws").replace(/\/api\/v1$/, "")}/ws/notifications?token=${encodeURIComponent(token)}`);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type: string; data?: Notification };
          if (message.type === "notification" && message.data) {
            setItems((current) => [message.data!, ...current.filter((item) => item.id !== message.data!.id)]);
          }
        } catch {
          // Ignore malformed socket frames.
        }
      };
      socket.onerror = () => undefined;
    }
    return () => { active = false; socket?.close(); };
  }, []);

  const unread = items.filter((item) => !item.readAt).length;

  async function markRead(item: Notification) {
    if (item.readAt) return;
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
    try {
      await client().put(`/notifications/${item.id}/read`, {});
    } catch {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: null } : row));
      setError("Could not mark that notification as read.");
    }
  }

  async function markAllRead() {
    const pending = items.filter((item) => !item.readAt);
    if (!pending.length || marking) return;
    setMarking(true);
    setError("");
    const results = await Promise.all(pending.map((item) => client().put(`/notifications/${item.id}/read`, {}).then(() => item.id).catch(() => null)));
    const marked = new Set(results.filter((id): id is string => Boolean(id)));
    setItems((current) => current.map((row) => marked.has(row.id) ? { ...row, readAt: row.readAt ?? new Date().toISOString() } : row));
    if (marked.size !== pending.length) setError("Some notifications could not be marked as read.");
    setMarking(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-blue-600"
      >
        <Bell size={17} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">{unread ? `${unread} unread` : "You are up to date"}</p>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && <button type="button" disabled={marking} onClick={() => void markAllRead()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50" aria-label="Mark all as read" title="Mark all as read"><CheckCheck size={16} /></button>}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close notifications"><X size={16} /></button>
              </div>
            </div>
            {error && <p className="bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>}
            {!loaded ? <p className="px-4 py-8 text-center text-sm text-slate-500">Loading notifications…</p> : items.length ? (
              <div className="max-h-96 space-y-1 overflow-auto p-2">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => void markRead(item)} className={`w-full rounded-xl p-3 text-left transition hover:bg-slate-50 ${item.readAt ? "" : "bg-blue-50/70"}`}>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">{!item.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}{item.title}</p>
                        {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</p>}
                        <p className="mt-2 text-[11px] text-slate-400">{timeAgo(item.createdAt)}</p>
                      </div>
                      {!item.readAt && <Check size={14} className="mt-1 shrink-0 text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : <p className="px-4 py-8 text-center text-sm text-slate-500">You are all caught up.</p>}
          </div>
        </>
      )}
    </div>
  );
}
