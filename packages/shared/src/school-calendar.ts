import type { CalendarEvent } from "./schemas/operations";

export const SCHOOL_EVENT_TYPES = ["event", "holiday", "exam", "deadline", "meeting", "other"] as const;
export const SCHOOL_EVENT_AUDIENCES = ["everyone", "students", "parents", "guardians", "teachers", "staff"] as const;
export const SCHOOL_EVENT_COLORS: Record<CalendarEvent["eventType"], string> = { event: "#2563eb", holiday: "#059669", exam: "#dc2626", deadline: "#d97706", meeting: "#7c3aed", other: "#64748b" };

/** Date-only school dates must not be parsed as UTC midnight in local calendars. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return localDateKey(new Date(year, month - 1, date + amount, 12));
}

export function eventsOnDay<T extends { startDate: string; endDate?: string | null; startTime?: string | null }>(events: T[], day: string): T[] {
  return events.filter((event) => event.startDate <= day && (event.endDate ?? event.startDate) >= day)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export function calendarEventRange(event: { startDate: string; endDate?: string | null; startTime?: string | null; endTime?: string | null }) {
  const lastDay = event.endDate ?? event.startDate;
  return {
    allDay: !event.startTime,
    start: event.startTime ? `${event.startDate}T${event.startTime}` : event.startDate,
    // FullCalendar end dates are exclusive; the school API's end date is inclusive.
    end: !event.startTime ? addCalendarDays(lastDay, 1) : event.endTime ? `${lastDay}T${event.endTime}` : event.endDate ? `${addCalendarDays(lastDay, 1)}T00:00` : undefined,
  };
}

export function calendarAudienceGroups(user: { roles: string[]; studentId?: string | null; employeeId?: string | null }): string[] {
  const groups = new Set<string>(["everyone"]);
  if (user.studentId || user.roles.includes("student")) groups.add("students");
  if (user.roles.some((role) => role === "parent" || role === "guardian")) { groups.add("parents"); groups.add("guardians"); }
  if (user.roles.some((role) => role === "teacher" || role === "class_teacher")) groups.add("teachers");
  if (user.employeeId || user.roles.some((role) => !["student", "parent", "guardian"].includes(role))) groups.add("staff");
  return [...groups];
}
