"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Megaphone,
  MapPin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type Notice = {
  id: string;
  title: string;
  body: string;
  priority: string;
  publishAt: string;
  expireAt?: string | null;
  authorName?: string | null;
  audiences?: string[];
};

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  audiences?: string[];
};

const audiences = ["everyone", "students", "parents", "teachers", "staff"];
const priorities = ["low", "normal", "high", "urgent"] as const;

function readPermissions(): string[] {
  try {
    const user = JSON.parse(localStorage.getItem("edu_user") ?? "{}") as { permissions?: string[] };
    return user.permissions ?? [];
  } catch {
    return [];
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value));
}

function priorityTone(priority: string) {
  if (priority === "urgent") return "rose" as const;
  if (priority === "high") return "amber" as const;
  if (priority === "low") return "slate" as const;
  return "blue" as const;
}

export function CommunicationWorkspace() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const permissions = readPermissions();
  const canCreateNotice = permissions.includes("notice.create");
  const canDeleteNotice = permissions.includes("notice.delete");
  const canCreateEvent = permissions.includes("event.create");
  const canDeleteEvent = permissions.includes("event.delete");

  const [tab, setTab] = useState<"notices" | "events">("notices");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [noticeResult, eventResult] = await Promise.all([
        api.get<{ data: Notice[] }>("/notices"),
        api.get<{ data: CalendarEvent[] }>("/events"),
      ]);
      setNotices(noticeResult.data);
      setEvents(eventResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notices and events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.post("/notices", {
        title: form.get("title"),
        body: form.get("body"),
        priority: form.get("priority"),
        publishAt: form.get("publishAt") || undefined,
        audiences: [form.get("audience")],
      });
      formElement.reset();
      setShowForm(false);
      setMessage("Notice published to the selected audience.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish notice");
    } finally {
      setSaving(false);
    }
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.post("/events", {
        title: form.get("title"),
        description: form.get("description") || null,
        startDate: form.get("startDate"),
        endDate: form.get("endDate") || null,
        startTime: form.get("startTime") || null,
        endTime: form.get("endTime") || null,
        venue: form.get("venue") || null,
        audiences: ["everyone"],
      });
      formElement.reset();
      setShowForm(false);
      setMessage("Event added to the school calendar.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event");
    } finally {
      setSaving(false);
    }
  }

  async function removeNotice(id: string) {
    if (!window.confirm("Delete this notice?")) return;
    setError("");
    try {
      await api.delete(`/notices/${id}`);
      setMessage("Notice deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete notice");
    }
  }

  async function removeEvent(id: string) {
    if (!window.confirm("Delete this event?")) return;
    setError("");
    try {
      await api.delete(`/events/${id}`);
      setMessage("Event deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete event");
    }
  }

  const canCreate = tab === "notices" ? canCreateNotice : canCreateEvent;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Community updates</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Notices & events</h2>
          <p className="mt-2 text-sm text-slate-500">
            Share announcements and keep the school calendar in one place.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setShowForm((value) => !value); setError(""); setMessage(""); }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close" : tab === "notices" ? "Publish notice" : "Add event"}
          </Button>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "notices" ? "primary" : "outline"} onClick={() => { setTab("notices"); setShowForm(false); }}>
          <Megaphone size={15} />
          Notices
          <Badge tone="blue">{notices.length}</Badge>
        </Button>
        <Button variant={tab === "events" ? "primary" : "outline"} onClick={() => { setTab("events"); setShowForm(false); }}>
          <CalendarDays size={15} />
          Events
          <Badge tone="blue">{events.length}</Badge>
        </Button>
      </div>

      {showForm && tab === "notices" && canCreateNotice && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Publish a notice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNotice} className="grid gap-4 sm:grid-cols-2">
              <Input name="title" placeholder="Notice title" required minLength={3} className="sm:col-span-2" />
              <textarea
                name="body"
                placeholder="What should the school community know?"
                required
                minLength={3}
                className="min-h-28 rounded-xl border border-slate-200 px-3.5 py-3 text-sm sm:col-span-2"
              />
              <select name="priority" defaultValue="normal" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {priorities.map((priority) => (
                  <option key={priority} value={priority} className="capitalize">
                    {priority}
                  </option>
                ))}
              </select>
              <select name="audience" defaultValue="everyone" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {audiences.map((audience) => (
                  <option key={audience} value={audience} className="capitalize">
                    {audience}
                  </option>
                ))}
              </select>
              <Input name="publishAt" type="datetime-local" aria-label="Publish date" />
              <div className="sm:col-span-2">
                <Button disabled={saving}>{saving ? "Publishing..." : "Publish notice"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showForm && tab === "events" && canCreateEvent && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Add a calendar event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createEvent} className="grid gap-4 sm:grid-cols-2">
              <Input name="title" placeholder="Event title" required minLength={3} className="sm:col-span-2" />
              <textarea
                name="description"
                placeholder="Short description (optional)"
                className="min-h-24 rounded-xl border border-slate-200 px-3.5 py-3 text-sm sm:col-span-2"
              />
              <Input name="startDate" type="date" required aria-label="Start date" />
              <Input name="endDate" type="date" aria-label="End date" />
              <Input name="startTime" type="time" aria-label="Start time" />
              <Input name="endTime" type="time" aria-label="End time" />
              <Input name="venue" placeholder="Venue (optional)" className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <Button disabled={saving}>{saving ? "Saving..." : "Add event"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">Loading updates…</CardContent>
        </Card>
      ) : tab === "notices" ? (
        notices.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {notices.map((notice) => (
              <Card key={notice.id} className="h-full">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Megaphone size={16} />
                      </span>
                      <Badge tone={priorityTone(notice.priority)}>{notice.priority}</Badge>
                    </div>
                    {canDeleteNotice && (
                      <Button size="sm" variant="ghost" aria-label={`Delete ${notice.title}`} onClick={() => void removeNotice(notice.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{notice.title}</h3>
                  <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {notice.body}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>{formatDate(notice.publishAt)}</span>
                    {notice.authorName && <span>by {notice.authorName}</span>}
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Users size={13} />
                      {(notice.audiences ?? ["everyone"]).join(", ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="mx-auto text-slate-300" size={28} />
              <p className="mt-3 text-sm text-slate-500">No notices have been published yet.</p>
            </CardContent>
          </Card>
        )
      ) : events.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="h-full">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
                      <CalendarDays size={19} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                        {formatDate(event.startDate)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{event.title}</h3>
                    </div>
                  </div>
                  {canDeleteEvent && (
                    <Button size="sm" variant="ghost" aria-label={`Delete ${event.title}`} onClick={() => void removeEvent(event.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                {event.description && (
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{event.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {(event.startTime || event.endTime) && (
                    <span>
                      {event.startTime ?? "—"} – {event.endTime ?? "—"}
                    </span>
                  )}
                  {event.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} />
                      {event.venue}
                    </span>
                  )}
                  {event.endDate && event.endDate !== event.startDate && (
                    <span>Ends {formatDate(event.endDate)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto text-slate-300" size={28} />
            <p className="mt-3 text-sm text-slate-500">No events are scheduled yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
