"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import type { EventClickInfo, EventInput } from "@fullcalendar/react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import {
  SCHOOL_EVENT_COLORS,
  SCHOOL_EVENT_TYPES,
  calendarEventRange,
  eventsOnDay,
  localDateKey,
  type CalendarEvent,
} from "@edu/shared";
import { Card, CardContent } from "./ui/card";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { formatAppDate, getAppLocale } from "../lib/locale";
import { BsCalendarGrid } from "./bs-calendar-grid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

export type SchoolCalendarEvent = {
  id: string;
  title: string;
  eventType?: CalendarEvent["eventType"];
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  imageUrl?: string | null;
  audiences?: string[];
  source?: "school" | "trisambat";
};

type EventFilter = "all" | CalendarEvent["eventType"];

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...SCHOOL_EVENT_TYPES.map((type) => ({
    value: type as EventFilter,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  })),
];

function labelFor(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function timeRange(event: SchoolCalendarEvent) {
  if (!event.startTime) return "All day";
  return `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`;
}

export function SchoolCalendar({
  events,
  onDelete,
  canDelete = false,
}: {
  events: SchoolCalendarEvent[];
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [system, setSystem] = useState<"ad" | "bs">("ad");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [selectedDay, setSelectedDay] = useState(localDateKey());
  const [selected, setSelected] = useState<SchoolCalendarEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    if (getAppLocale() === "ne") setSystem("bs");
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((event) => filter === "all" || (event.eventType ?? "event") === filter),
    [events, filter],
  );

  const todayEvents = useMemo(() => eventsOnDay(visibleEvents, localDateKey()), [visibleEvents]);

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      visibleEvents.map((event) => {
        const range = calendarEventRange(event);
        const color = SCHOOL_EVENT_COLORS[event.eventType ?? "event"];
        return {
          id: event.id,
          title: event.title,
          start: range.start,
          end: range.end,
          allDay: range.allDay,
          backgroundColor: event.source === "trisambat" ? `${color}1a` : color,
          borderColor: event.source === "trisambat" ? color : undefined,
          textColor: event.source === "trisambat" ? color : "#ffffff",
          extendedProps: { eventId: event.id },
        };
      }),
    [visibleEvents],
  );

  function handleEventClick(info: EventClickInfo) {
    const event = events.find((item) => item.id === info.event.id);
    if (event) setSelected(event);
  }

  function closeDetail() {
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto" role="group" aria-label="Filter calendar events">
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.value)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.value !== "all" && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SCHOOL_EVENT_COLORS[option.value as CalendarEvent["eventType"]] }}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Calendar system">
            <button
              type="button"
              aria-pressed={system === "ad"}
              onClick={() => setSystem("ad")}
              className={`min-h-8 rounded-lg px-2.5 text-[11px] font-bold transition ${system === "ad" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              A.D.
            </button>
            <button
              type="button"
              aria-pressed={system === "bs"}
              onClick={() => setSystem("bs")}
              className={`min-h-8 rounded-lg px-2.5 text-[11px] font-bold transition ${system === "bs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              B.S.
            </button>
          </div>
          <p className="shrink-0 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{todayEvents.length}</span> {todayEvents.length === 1 ? "item" : "items"} today
            <span className="mx-1.5 text-slate-300">|</span>
            {visibleEvents.length} on the calendar
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="school-calendar p-2 sm:p-4">
          {system === "bs" ? (
            <BsCalendarGrid
              events={visibleEvents}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onSelectEvent={setSelected}
            />
          ) : mounted ? (
            <FullCalendar
              plugins={[dayGridPlugin, listPlugin, classicThemePlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,listWeek",
              }}
              height="auto"
              contentHeight="auto"
              dayMaxEvents={3}
              weekends
              fixedWeekCount={false}
              events={calendarEvents}
              eventClick={handleEventClick}
              eventDisplay="block"
              displayEventTime={false}
              noEventsText="No school events in this period"
              aria-label="School calendar"
            />
          ) : (
            <div className="grid min-h-96 place-items-center text-sm text-slate-400">
              <CalendarDays className="mb-2" size={26} />
              Loading calendar...
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={closeDetail}
        title={selected?.title ?? "Calendar event"}
        description={selected ? `${labelFor(selected.eventType ?? "event")}${selected.source === "trisambat" ? " | Public holiday" : ""}` : undefined}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {selected && canDelete && selected.source !== "trisambat" && onDelete && (
              <Button
                variant="ghost"
                onClick={() => {
                  onDelete(selected.id);
                  closeDetail();
                }}
              >
                Delete event
              </Button>
            )}
            <Button onClick={closeDetail}>Close</Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                <CalendarDays size={14} />
                {formatAppDate(selected.startDate)}
                {selected.endDate && selected.endDate !== selected.startDate ? ` - ${formatAppDate(selected.endDate)}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                <Clock size={14} />
                {timeRange(selected)}
              </span>
              {selected.venue && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <MapPin size={14} />
                  {selected.venue}
                </span>
              )}
              {(selected.audiences?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <Users size={14} />
                  {selected.audiences?.map(labelFor).join(", ")}
                </span>
              )}
            </div>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
              {selected.description || "No additional details have been published for this event."}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
