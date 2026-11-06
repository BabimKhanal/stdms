import type { AppLocale } from "@edu/shared";

type TrisambatHoliday = {
  ad: string;
  id: string;
  name: { ne: string; en: string };
  holiday: string | null;
};

export type TrisambatCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: null;
  startTime: null;
  endTime: null;
  description: null;
  venue: null;
  audiences: string[];
  eventType: "holiday";
  source: "trisambat";
  isPublicHoliday: boolean;
};

const cache = new Map<string, TrisambatCalendarEvent[]>();

export async function loadTrisambatHolidays(
  bsYear: number,
  locale: AppLocale,
): Promise<TrisambatCalendarEvent[]> {
  const cacheKey = `${bsYear}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`https://trisambat.com/api/v1/holidays/${bsYear}.json`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { events?: TrisambatHoliday[] };
    const events = (payload.events ?? []).map((event) => ({
      id: `trisambat:${event.id}:${event.ad}`,
      title: event.name[locale === "ne" ? "ne" : "en"],
      startDate: event.ad,
      endDate: null,
      startTime: null,
      endTime: null,
      description: null,
      venue: null,
      audiences: ["everyone"],
      eventType: "holiday" as const,
      source: "trisambat" as const,
      isPublicHoliday: Boolean(event.holiday),
    }));
    cache.set(cacheKey, events);
    return events;
  } catch {
    return [];
  }
}