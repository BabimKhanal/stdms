import { getAppLocale } from "./locale";

type TrisambatHoliday = {
  ad: string;
  id: string;
  name: { ne: string; en: string };
  holiday: string | null;
};

type TrisambatToday = { bs: { year: number } };

export type CalendarFeedEvent = {
  id: string;
  title: string;
  startDate: string;
  eventType: "holiday";
  source: "trisambat";
};

export async function loadTrisambatHolidays(): Promise<CalendarFeedEvent[]> {
  try {
    const todayResponse = await fetch("https://trisambat.com/api/v1/today.json");
    if (!todayResponse.ok) return [];
    const today = (await todayResponse.json()) as TrisambatToday;
    const response = await fetch(`https://trisambat.com/api/v1/holidays/${today.bs.year}.json`);
    if (!response.ok) return [];
    const holidays = (await response.json()) as { events?: TrisambatHoliday[] };
    const locale = getAppLocale();
    return (holidays.events ?? []).map((event) => ({
      id: `trisambat:${event.id}:${event.ad}`,
      title: event.name[locale === "ne" ? "ne" : "en"],
      startDate: event.ad,
      eventType: "holiday",
      source: "trisambat",
    }));
  } catch {
    return [];
  }
}
