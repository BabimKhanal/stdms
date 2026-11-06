"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BS_WEEKDAYS_EN,
  BS_WEEKDAYS_NE,
  SCHOOL_EVENT_COLORS,
  addBsMonths,
  adToBs,
  bsMonthAdRange,
  bsMonthGrid,
  eventsOnDay,
  formatBsDate,
  formatBsMonth,
  localDateKey,
} from "@edu/shared";
import { formatAppDate, getAppLocale } from "../lib/locale";
import type { SchoolCalendarEvent } from "./school-calendar";

export function BsCalendarGrid({
  events,
  selectedDay,
  onSelectDay,
  onSelectEvent,
}: {
  events: SchoolCalendarEvent[];
  selectedDay: string;
  onSelectDay: (adDate: string) => void;
  onSelectEvent: (event: SchoolCalendarEvent) => void;
}) {
  const locale = getAppLocale();
  const selectedBs = adToBs(selectedDay) ?? adToBs(localDateKey());
  const [visible, setVisible] = useState(() => ({
    year: selectedBs?.year ?? 2083,
    month: selectedBs?.month ?? 1,
  }));

  useEffect(() => {
    const bs = adToBs(selectedDay);
    if (bs && (bs.year !== visible.year || bs.month !== visible.month)) {
      setVisible({ year: bs.year, month: bs.month });
    }
  }, [selectedDay, visible.year, visible.month]);

  const weeks = useMemo(() => bsMonthGrid(visible.year, visible.month), [visible.year, visible.month]);
  const range = bsMonthAdRange(visible.year, visible.month);
  const dayEvents = eventsOnDay(events, selectedDay);
  const today = localDateKey();

  function move(amount: number) {
    setVisible((current) => addBsMonths(current.year, current.month, amount));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{formatBsMonth(visible.year, visible.month, locale)}</p>
            {range && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatAppDate(range.start)} - {formatAppDate(range.end)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(-1)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Previous Bikram Sambat month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const bs = adToBs(today);
                if (bs) setVisible({ year: bs.year, month: bs.month });
                onSelectDay(today);
              }}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Next Bikram Sambat month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1" role="grid" aria-label="Bikram Sambat month calendar">
          {(locale === "ne" ? BS_WEEKDAYS_NE : BS_WEEKDAYS_EN).map((weekday) => (
            <div key={weekday} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400" role="columnheader">
              {weekday}
            </div>
          ))}
          {weeks.flatMap((week, weekIndex) =>
            week.map((cell, dayIndex) => {
              if (!cell) return <div key={`blank-${weekIndex}-${dayIndex}`} aria-hidden="true" />;
              const items = eventsOnDay(events, cell.adDate);
              const isSelected = cell.adDate === selectedDay;
              const isToday = cell.adDate === today;
              return (
                <button
                  key={cell.adDate}
                  type="button"
                  onClick={() => onSelectDay(cell.adDate)}
                  aria-label={`${formatBsDate(cell.adDate, locale)}${items.length ? `, ${items.length} events` : ""}`}
                  aria-pressed={isSelected}
                  className={`flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition sm:min-h-20 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-1">
                    <span className={`text-sm font-semibold ${isToday && !isSelected ? "text-blue-600" : "text-slate-800"}`}>
                      {cell.bsDate.date}
                    </span>
                    <span className="text-[9px] tabular-nums text-slate-400">{cell.adDate.slice(8, 10)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-0.5">
                    {items.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: SCHOOL_EVENT_COLORS[event.eventType ?? "event"] }}
                      />
                    ))}
                    {items.length > 3 && <span className="text-[9px] font-semibold text-slate-400">+{items.length - 3}</span>}
                  </span>
                  <span className="mt-auto hidden truncate text-[10px] leading-4 text-slate-500 sm:block">
                    {items[0]?.title ?? ""}
                    {items.length > 1 ? ` +${items.length - 1}` : ""}
                  </span>
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
          <p className="text-sm font-semibold text-slate-900">
            {formatAppDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="text-xs text-slate-500">
            {formatBsDate(selectedDay, locale)} B.S. | {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
          </p>
        </div>
        {dayEvents.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {dayEvents.map((event) => {
              const color = SCHOOL_EVENT_COLORS[event.eventType ?? "event"];
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm"
                >
                  <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{event.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {(event.eventType ?? "event").replaceAll("_", " ")}
                      {event.startTime ? ` | ${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}` : " | All day"}
                      {event.venue ? ` | ${event.venue}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No school events on this Bikram Sambat date.
          </p>
        )}
      </div>
    </div>
  );
}
