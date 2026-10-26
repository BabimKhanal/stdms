"use client";

import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { EduApiClient } from "@edu/api-client";

type Notification = { id: string; title: string; body: string | null; createdAt: string; readAt: string | null };

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
    void api.get<Notification[]>("/notifications").then(setItems).catch(() => undefined);
    const token = localStorage.getItem("edu_access_token");
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    const socket = new WebSocket(`${base.replace(/^http/, "ws").replace(/\/api\/v1$/, "")}/ws/notifications?token=${encodeURIComponent(token)}`);
    socket.onmessage = (event) => { const message = JSON.parse(event.data) as { type: string; data?: Notification }; if (message.type === "notification" && message.data) setItems((current) => [message.data!, ...current.filter((item) => item.id !== message.data!.id)]); };
    return () => socket.close();
  }, []);
  const unread = items.filter((item) => !item.readAt).length;
  async function markRead(item: Notification) { if (item.readAt) return; await new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")).put(`/notifications/${item.id}/read`, {}); setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); }
  return <div className="relative"><button onClick={() => setOpen((value) => !value)} className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-blue-600"><Bell size={17} />{unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}</button>{open && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><div className="flex items-center justify-between px-2 pb-2"><p className="font-semibold">Notifications</p><button onClick={() => setOpen(false)}><X size={15} /></button></div>{items.length ? <div className="max-h-80 space-y-1 overflow-auto">{items.map((item) => <button key={item.id} onClick={() => void markRead(item)} className={`w-full rounded-xl p-3 text-left ${item.readAt ? "" : "bg-blue-50"}`}><div className="flex gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p>{item.body && <p className="mt-1 text-xs text-slate-500">{item.body}</p>}<p className="mt-2 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></div>{!item.readAt && <Check size={14} className="mt-1 text-blue-600" />}</div></button>)}</div> : <p className="p-5 text-center text-sm text-slate-500">You are all caught up.</p>}</div>}</div>;
}
