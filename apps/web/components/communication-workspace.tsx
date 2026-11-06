"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutList,
  Mail,
  Megaphone,
  MapPin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Badge } from "./ui/badge";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "./ui/toast";
import { formatAppDate, translate } from "../lib/locale";
import { loadTrisambatHolidays } from "../lib/trisambat";
import { SchoolCalendar } from "./school-calendar";

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
  eventType?: "event" | "holiday" | "exam" | "deadline" | "meeting" | "other";
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  audiences?: string[];
  source?: "school" | "trisambat";
};

const audiences = ["everyone", "students", "parents", "teachers", "staff"];
const priorities = ["low", "normal", "high", "urgent"] as const;
const eventTypes = ["event", "holiday", "exam", "deadline", "meeting", "other"] as const;

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
  return formatAppDate(value, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priorityTone(priority: string) {
  if (priority === "urgent") return "rose" as const;
  if (priority === "high") return "amber" as const;
  if (priority === "low") return "slate" as const;
  return "blue" as const;
}

export function CommunicationWorkspace() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const toast = useToast();
  const permissions = readPermissions();
  const canCreateNotice = permissions.includes("notice.create");
  const canDeleteNotice = permissions.includes("notice.delete");
  const canCreateEvent = permissions.includes("event.create");
  const canDeleteEvent = permissions.includes("event.delete");

  const [tab, setTab] = useState<"notices" | "events" | "bulk">("notices");
  const [eventView, setEventView] = useState<"list" | "calendar">("calendar");
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
      const [noticeResult, eventResult, holidayEvents] = await Promise.all([
        api.get<{ data: Notice[] }>("/notices"),
        api.get<{ data: CalendarEvent[] }>("/events"),
        loadTrisambatHolidays(),
      ]);
      setNotices(noticeResult.data);
      setEvents([...eventResult.data, ...holidayEvents]);
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
      toast.success("Notice published", "The selected audience can now see it.");
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
        eventType: form.get("eventType"),
        description: form.get("description") || null,
        startDate: form.get("startDate"),
        endDate: form.get("endDate") || null,
        startTime: form.get("startTime") || null,
        endTime: form.get("endTime") || null,
        venue: form.get("venue") || null,
        audiences: [form.get("audience")],
      });
      formElement.reset();
      setShowForm(false);
      setMessage("Event added to the school calendar.");
      toast.success("Event added", "The school calendar has been updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event");
    } finally {
      setSaving(false);
    }
  }

  async function sendBulkMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api.post<{ recipients: number }>("/messages/bulk", {
        subject: form.get("subject"),
        body: form.get("body"),
        audiences: [form.get("audience")],
      });
      formElement.reset();
      setShowForm(false);
      setMessage(`Message sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}.`);
      toast.success("Bulk message sent", `${result.recipients} recipient${result.recipients === 1 ? "" : "s"} received the broadcast.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send bulk message");
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
      toast.success("Notice deleted");
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
      toast.success("Event deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete event");
    }
  }

  const canCreate = tab === "notices" ? canCreateNotice : tab === "events" ? canCreateEvent : canCreateNotice;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">{translate("Community updates")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{translate("Community messaging")}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {translate("Share announcements, send targeted broadcasts, and keep the school calendar in one place.")}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setShowForm((value) => !value); setError(""); setMessage(""); }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close" : tab === "notices" ? "Publish notice" : tab === "events" ? "Add event" : "Send message"}
          </Button>
        )}
      </div>

      {error && <Alert tone="error" title="Notices & events" onDismiss={() => setError("")}>{error}</Alert>}
      {message && <Alert tone="success" onDismiss={() => setMessage("")}>{message}</Alert>}

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as "notices" | "events" | "bulk");
          setShowForm(false);
        }}
      >
        <TabsList ariaLabel="Community messaging">
           <TabsTrigger value="notices" icon={<Megaphone size={15} />} badge={notices.length}>{translate("Notices")}</TabsTrigger>
           <TabsTrigger value="events" icon={<CalendarDays size={15} />} badge={events.length}>{translate("Events")}</TabsTrigger>
           <TabsTrigger value="bulk" icon={<Mail size={15} />}>{translate("Bulk message")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "events" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{translate("Switch between a month view and a compact list.")}</p>
          <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Event view">
            <button
              type="button"
              aria-pressed={eventView === "calendar"}
              onClick={() => setEventView("calendar")}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${eventView === "calendar" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              <CalendarDays size={14} /> Calendar
            </button>
            <button
              type="button"
              aria-pressed={eventView === "list"}
              onClick={() => setEventView("list")}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${eventView === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              <LayoutList size={14} /> List
            </button>
          </div>
        </div>
      )}

      {showForm && tab === "bulk" && canCreateNotice && (
        <Card className="border-blue-200">
          <CardHeader>
             <CardTitle>{translate("Send a targeted broadcast")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendBulkMessage} className="grid gap-4 sm:grid-cols-2">
               <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">{translate("Email subject")}</span><Input name="subject" placeholder={translate("Email subject")} required minLength={3} maxLength={200} /></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Message</span><textarea
                name="body"
                placeholder="Write your message"
                required
                minLength={1}
                maxLength={10000}
                className="min-h-36 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
              /></label>
               <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{translate("Audience")}</span><select name="audience" defaultValue="everyone" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {audiences.map((audience) => (
                   <option key={audience} value={audience} className="capitalize">{translate(audience)}</option>
                ))}
              </select></label>
              <p className="self-center text-xs leading-5 text-slate-500">The broadcast creates an in-app notification and sends email when a production mail provider is configured.</p>
              <div className="sm:col-span-2">
                <Button disabled={saving}>{saving ? "Sending..." : "Send broadcast"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showForm && tab === "notices" && canCreateNotice && (
        <Card className="border-blue-200">
          <CardHeader>
             <CardTitle>{translate("Publish a notice")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNotice} className="grid gap-4 sm:grid-cols-2">
               <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">{translate("Notice title")}</span><Input name="title" placeholder={translate("Notice title")} required minLength={3} /></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Notice message</span><textarea
                name="body"
                placeholder="What should the school community know?"
                required
                minLength={3}
                className="min-h-28 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
              /></label>
               <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{translate("Priority")}</span><select name="priority" defaultValue="normal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {priorities.map((priority) => (
                  <option key={priority} value={priority} className="capitalize">
                    {priority}
                  </option>
                ))}
              </select></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Audience</span><select name="audience" defaultValue="everyone" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {audiences.map((audience) => (
                  <option key={audience} value={audience} className="capitalize">
                    {audience}
                  </option>
                ))}
              </select></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Publish date and time <span className="font-normal text-slate-400">(optional)</span></span><Input name="publishAt" type="datetime-local" /></label>
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
              <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Event title</span><Input name="title" placeholder="Event title" required minLength={3} /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Calendar type</span><select name="eventType" defaultValue="event" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{eventTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Audience</span><select name="audience" defaultValue="everyone" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{audiences.map((audience) => <option key={audience} value={audience} className="capitalize">{audience}</option>)}</select></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></span><textarea
                name="description"
                placeholder="Short description (optional)"
                className="min-h-24 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
              /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Start date</span><Input name="startDate" type="date" required /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">End date <span className="font-normal text-slate-400">(optional)</span></span><Input name="endDate" type="date" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Start time <span className="font-normal text-slate-400">(optional)</span></span><Input name="startTime" type="time" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">End time <span className="font-normal text-slate-400">(optional)</span></span><Input name="endTime" type="time" /></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Venue <span className="font-normal text-slate-400">(optional)</span></span><Input name="venue" placeholder="Venue" /></label>
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
      ) : tab === "events" && eventView === "calendar" ? (
        <SchoolCalendar
          events={events}
          canDelete={canDeleteEvent}
          onDelete={(id) => void removeEvent(id)}
        />
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
      ) : tab === "events" && eventView === "list" && events.length ? (
        <div className="space-y-3">
          {events.some((event) => event.source === "trisambat") && (
            <p className="text-xs text-slate-500">{translate("Public holidays powered by Trisambat")}</p>
          )}
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
                         {(event.eventType ?? "event").replaceAll("_", " ")} · {formatDate(event.startDate)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{event.title}</h3>
                    </div>
                  </div>
                   {canDeleteEvent && event.source !== "trisambat" && (
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
        </div>
      ) : tab === "events" && eventView === "list" ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto text-slate-300" size={28} />
            <p className="mt-3 text-sm text-slate-500">No events are scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="mx-auto text-slate-300" size={28} />
            <p className="mt-3 text-sm text-slate-500">Use the composer above to send a targeted school broadcast.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
