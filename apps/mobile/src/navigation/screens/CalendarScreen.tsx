/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  type CalendarEvent,
} from "@edu/shared";
import { EduApiClient } from "@edu/api-client";
import { mobileToken, refreshMobileSession } from "../../auth";
import { API_URL } from "../../config";
import { formatAppDate, useAppLocale } from "../../lib/locale";
import { loadTrisambatHolidays } from "../../lib/trisambat";

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
};

const calendarColors = {
  holiday: "#dc2626",
  holidaySoft: "#fff1f2",
  observance: "#ea580c",
  observanceSoft: "#fff7ed",
  selected: "#20833b",
  todaySoft: "#f0fdf4",
};

type CalendarEventItem = Omit<CalendarEvent, "imageUrl" | "eventType"> & {
  imageUrl?: string | null;
  eventType?: CalendarEvent["eventType"];
  source?: "school" | "trisambat";
  isPublicHoliday?: boolean;
};

type Filter = "all" | CalendarEvent["eventType"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "event", label: "Events" },
  { value: "holiday", label: "Holidays" },
  { value: "exam", label: "Exams" },
  { value: "deadline", label: "Deadlines" },
  { value: "meeting", label: "Meetings" },
];

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function timeRange(event: CalendarEventItem) {
  if (!event.startTime) return "All day";
  return `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`;
}

type MonthCell = { adDate: string; primaryDate: string; secondaryDate: string } | null;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function adMonthGrid(year: number, month: number, locale: "en" | "ne"): MonthCell[][] {
  const length = new Date(year, month, 0).getDate();
  const leading = new Date(year, month - 1, 1, 12).getDay();
  const number = new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", { useGrouping: false });
  const cells: MonthCell[] = Array.from({ length: leading }, () => null);
  for (let date = 1; date <= length; date += 1) {
    const adDate = `${year}-${pad(month)}-${pad(date)}`;
    const bs = adToBs(adDate);
    cells.push({ adDate, primaryDate: number.format(date), secondaryDate: bs ? number.format(bs.date) : "" });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

function addAdMonths(year: number, month: number, amount: number) {
  const date = new Date(year, month - 1 + amount, 1, 12);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function dayTone(items: CalendarEventItem[]) {
  const officialHoliday = items.some((event) => event.eventType === "holiday" && (event.source !== "trisambat" || event.isPublicHoliday));
  const observance = items.some((event) => event.eventType === "holiday" && event.source === "trisambat" && !event.isPublicHoliday);
  return { officialHoliday, observance, primaryEvent: items.find((event) => event.eventType === "holiday") ?? items[0] };
}

function eventDisplayColor(event: CalendarEventItem) {
  if (event.eventType !== "holiday") return SCHOOL_EVENT_COLORS[event.eventType ?? "event"];
  return event.source === "trisambat" && !event.isPublicHoliday
    ? calendarColors.observance
    : calendarColors.holiday;
}

function CalendarMonthCell({
  cell,
  dayIndex,
  items,
  selected,
  today,
  onPress,
}: {
  cell: NonNullable<MonthCell>;
  dayIndex: number;
  items: CalendarEventItem[];
  selected: boolean;
  today: string;
  onPress: () => void;
}) {
  const { officialHoliday, observance, primaryEvent } = dayTone(items);
  const weekend = dayIndex === 0 || dayIndex === 6;
  const red = officialHoliday || weekend;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cell.adDate}${primaryEvent ? `, ${primaryEvent.title}` : ""}`}
      accessibilityState={{ selected }}
      style={[
        styles.monthDayCell,
        selected && styles.monthDayCellSelected,
        !selected && officialHoliday && styles.monthDayCellHoliday,
        !selected && !officialHoliday && observance && styles.monthDayCellObservance,
        cell.adDate === today && !selected && styles.monthDayCellToday,
      ]}
    >
      <Text style={[styles.monthSecondaryDate, !selected && red && styles.monthHolidayText, !selected && !red && observance && styles.monthObservanceText, selected && styles.monthSelectedText]}>{cell.secondaryDate}</Text>
      <Text style={[styles.monthPrimaryDate, !selected && red && styles.monthHolidayText, !selected && !red && observance && styles.monthObservanceText, cell.adDate === today && !selected && styles.monthTodayText, selected && styles.monthSelectedText]}>{cell.primaryDate}</Text>
      <Text numberOfLines={2} style={[styles.monthEventLabel, !selected && officialHoliday && styles.monthHolidayText, !selected && !officialHoliday && observance && styles.monthObservanceText, selected && styles.monthSelectedText]}>
        {primaryEvent ? `${primaryEvent.title}${items.length > 1 ? ` +${items.length - 1}` : ""}` : " "}
      </Text>
    </Pressable>
  );
}

export function Calendar() {
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const [schoolEvents, setSchoolEvents] = useState<CalendarEventItem[]>([]);
  const [holidayEvents, setHolidayEvents] = useState<CalendarEventItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(localDateKey());
  const [system, setSystem] = useState<"ad" | "bs">("bs");
  const [visibleBs, setVisibleBs] = useState(() => {
    const bs = adToBs(localDateKey());
    return { year: bs?.year ?? 2083, month: bs?.month ?? 1 };
  });
  const [visibleAd, setVisibleAd] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);

  const load = useCallback(async (mode: "initial" | "refresh" | "silent" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      let token = await mobileToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const fetchEvents = () => new EduApiClient(API_URL, () => token).get<{ data?: CalendarEventItem[] }>("/events");
      let result;
      try {
        result = await fetchEvents();
      } catch (error) {
        if (!(error instanceof Error) || !/unauthori[sz]ed|401|token|session/i.test(error.message)) throw error;
        token = await refreshMobileSession();
        if (!token) throw new Error("Session expired. Please sign in again.");
        result = await fetchEvents();
      }
      setSchoolEvents(result.data ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the school calendar.");
    } finally {
      hasLoaded.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoaded.current ? "silent" : "initial");
    }, [load]),
  );

  const events = useMemo(() => [...schoolEvents, ...holidayEvents], [schoolEvents, holidayEvents]);

  const filtered = useMemo(
    () => events.filter((event) => filter === "all" || (event.eventType ?? "event") === filter),
    [events, filter],
  );

  const dayEvents = useMemo(() => eventsOnDay(filtered, selectedDay), [filtered, selectedDay]);
  const bsWeeks = useMemo(() => bsMonthGrid(visibleBs.year, visibleBs.month), [visibleBs.year, visibleBs.month]);
  const adWeeks = useMemo(() => adMonthGrid(visibleAd.year, visibleAd.month, locale), [locale, visibleAd.month, visibleAd.year]);
  const bsRange = bsMonthAdRange(visibleBs.year, visibleBs.month);
  const today = localDateKey();

  useEffect(() => {
    const bs = adToBs(selectedDay);
    if (bs) setVisibleBs({ year: bs.year, month: bs.month });
    const [year, month] = selectedDay.split("-").map(Number);
    if (year && month) setVisibleAd({ year, month });
  }, [selectedDay]);

  useEffect(() => {
    if (locale === "ne") setSystem("bs");
  }, [locale]);

  useEffect(() => {
    let active = true;
    void loadTrisambatHolidays(visibleBs.year, locale).then((items) => {
      if (active) setHolidayEvents(items);
    });
    return () => {
      active = false;
    };
  }, [locale, visibleBs.year]);

  function moveBsMonth(amount: number) {
    setVisibleBs((current) => addBsMonths(current.year, current.month, amount));
  }

  function moveAdMonth(amount: number) {
    const next = addAdMonths(visibleAd.year, visibleAd.month, amount);
    setVisibleAd(next);
    setSelectedDay(`${next.year}-${pad(next.month)}-01`);
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 28, paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={palette.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>School calendar</Text>
      <Text style={styles.title}>What&apos;s coming up</Text>
      <Text style={styles.subtitle}>Events, holidays, exams, and important school dates.</Text>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load("initial")} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.systemRow}>
        <Text style={styles.systemLabel}>Calendar system</Text>
        <View style={styles.systemToggle}>
          <Pressable
            onPress={() => setSystem("ad")}
            accessibilityRole="button"
            accessibilityState={{ selected: system === "ad" }}
            style={[styles.systemOption, system === "ad" && styles.systemOptionActive]}
          >
            <Text style={[styles.systemText, system === "ad" && styles.systemTextActive]}>A.D.</Text>
          </Pressable>
          <Pressable
            onPress={() => setSystem("bs")}
            accessibilityRole="button"
            accessibilityState={{ selected: system === "bs" }}
            style={[styles.systemOption, system === "bs" && styles.systemOptionActive]}
          >
            <Text style={[styles.systemText, system === "bs" && styles.systemTextActive]}>B.S.</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setFilter(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                {option.value !== "all" ? (
                  <View style={[styles.filterDot, { backgroundColor: option.value === "holiday" ? calendarColors.holiday : SCHOOL_EVENT_COLORS[option.value as CalendarEvent["eventType"]] }]} />
                ) : null}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {selectedDay !== today ? (
          <Pressable onPress={() => setSelectedDay(today)} style={styles.todayButton} accessibilityRole="button">
            <MaterialCommunityIcons name="calendar-today" size={14} color={palette.primary} />
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      ) : (
        <>
          {system === "bs" ? (
            <View style={styles.calendarCard}>
              <View style={styles.bsHeader}>
                <View style={styles.bsTitleBlock}>
                  <Text style={styles.bsTitle}>{formatBsMonth(visibleBs.year, visibleBs.month, locale)}</Text>
                  {bsRange ? (
                    <Text style={styles.bsRange}>{formatAppDate(bsRange.start)} - {formatAppDate(bsRange.end)}</Text>
                  ) : null}
                </View>
                <View style={styles.bsNav}>
                  <Pressable onPress={() => moveBsMonth(-1)} style={styles.bsNavButton} accessibilityRole="button" accessibilityLabel="Previous Bikram Sambat month">
                    <MaterialCommunityIcons name="chevron-left" size={19} color={palette.inkSoft} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const bs = adToBs(today);
                      if (bs) setVisibleBs({ year: bs.year, month: bs.month });
                      setSelectedDay(today);
                    }}
                    style={styles.bsTodayButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.bsTodayText}>Today</Text>
                  </Pressable>
                  <Pressable onPress={() => moveBsMonth(1)} style={styles.bsNavButton} accessibilityRole="button" accessibilityLabel="Next Bikram Sambat month">
                    <MaterialCommunityIcons name="chevron-right" size={19} color={palette.inkSoft} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.bsWeekRow}>
                {(locale === "ne" ? BS_WEEKDAYS_NE : BS_WEEKDAYS_EN).map((weekday, index) => (
                  <Text key={weekday} style={[styles.bsWeekday, (index === 0 || index === 6) && styles.bsWeekdayHoliday]}>{weekday}</Text>
                ))}
              </View>

              {bsWeeks.map((week, weekIndex) => (
                <View key={`bs-week-${weekIndex}`} style={styles.bsWeekRow}>
                  {week.map((cell, dayIndex) => {
                    if (!cell) return <View key={`bs-blank-${weekIndex}-${dayIndex}`} style={styles.monthDayCell} />;
                    const items = eventsOnDay(filtered, cell.adDate);
                    return (
                      <CalendarMonthCell
                        key={cell.adDate}
                        cell={{
                          adDate: cell.adDate,
                          primaryDate: new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", { useGrouping: false }).format(cell.bsDate.date),
                          secondaryDate: String(Number(cell.adDate.slice(8, 10))),
                        }}
                        dayIndex={dayIndex}
                        items={items}
                        selected={cell.adDate === selectedDay}
                        today={today}
                        onPress={() => setSelectedDay(cell.adDate)}
                      />
                    );
                  })}
                </View>
              ))}
              <View style={styles.bsAttribution}>
                <MaterialCommunityIcons name="calendar-check-outline" size={12} color={palette.muted} />
                <Text style={styles.bsAttributionText}>Nepali festivals and holidays powered by Trisambat</Text>
              </View>
            </View>
          ) : (
            <View style={styles.calendarCard}>
              <View style={styles.bsHeader}>
                <View style={styles.bsTitleBlock}>
                  <Text style={styles.bsTitle}>{new Date(visibleAd.year, visibleAd.month - 1, 1).toLocaleDateString(locale === "ne" ? "ne-NP" : "en-US", { month: "long", year: "numeric" })}</Text>
                  <Text style={styles.bsRange}>{formatBsDate(`${visibleAd.year}-${pad(visibleAd.month)}-01`, locale)} B.S.</Text>
                </View>
                <View style={styles.bsNav}>
                  <Pressable onPress={() => moveAdMonth(-1)} style={styles.bsNavButton} accessibilityRole="button" accessibilityLabel="Previous month">
                    <MaterialCommunityIcons name="chevron-left" size={19} color={palette.inkSoft} />
                  </Pressable>
                  <Pressable onPress={() => setSelectedDay(today)} style={styles.bsTodayButton} accessibilityRole="button">
                    <Text style={styles.bsTodayText}>Today</Text>
                  </Pressable>
                  <Pressable onPress={() => moveAdMonth(1)} style={styles.bsNavButton} accessibilityRole="button" accessibilityLabel="Next month">
                    <MaterialCommunityIcons name="chevron-right" size={19} color={palette.inkSoft} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.bsWeekRow}>
                {(locale === "ne" ? BS_WEEKDAYS_NE : BS_WEEKDAYS_EN).map((weekday, index) => (
                  <Text key={weekday} style={[styles.bsWeekday, (index === 0 || index === 6) && styles.bsWeekdayHoliday]}>{weekday}</Text>
                ))}
              </View>
              {adWeeks.map((week, weekIndex) => (
                <View key={`ad-week-${weekIndex}`} style={styles.bsWeekRow}>
                  {week.map((cell, dayIndex) => cell ? (
                    <CalendarMonthCell key={cell.adDate} cell={cell} dayIndex={dayIndex} items={eventsOnDay(filtered, cell.adDate)} selected={cell.adDate === selectedDay} today={today} onPress={() => setSelectedDay(cell.adDate)} />
                  ) : <View key={`ad-blank-${weekIndex}-${dayIndex}`} style={styles.monthDayCell} />)}
                </View>
              ))}
              <View style={styles.bsAttribution}>
                <MaterialCommunityIcons name="palette-outline" size={12} color={calendarColors.observance} />
                <Text style={styles.bsAttributionText}>Red: holidays and weekends · Orange: festivals</Text>
              </View>
            </View>
          )}

          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{formatAppDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</Text>
            <Text style={styles.dayCount}>
              {formatBsDate(selectedDay, locale)} B.S. | {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
            </Text>
          </View>

          {dayEvents.length ? (
            dayEvents.map((event) => {
              const color = eventDisplayColor(event);
              return (
                <View key={event.id} style={[styles.eventCard, { borderLeftColor: color }]}>
                  <View style={styles.eventTop}>
                    <View style={[styles.eventIcon, { backgroundColor: `${color}18` }]}>
                      <MaterialCommunityIcons
                        name={event.eventType === "holiday" ? "beach" : event.eventType === "exam" ? "clipboard-text-outline" : event.eventType === "meeting" ? "account-group-outline" : "calendar-star"}
                        size={18}
                        color={color}
                      />
                    </View>
                    <View style={styles.eventCopy}>
                      <View style={styles.eventMetaRow}>
                        <Text style={[styles.eventType, { color }]}>{capitalize(event.eventType ?? "event")}</Text>
                        {event.source === "trisambat" ? <Text style={styles.publicHoliday}>{event.isPublicHoliday ? "Public holiday" : "Festival / observance"}</Text> : null}
                      </View>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                    </View>
                  </View>

                  <View style={styles.eventDetails}>
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color={palette.muted} />
                      <Text style={styles.detailText}>
                        {timeRange(event)}
                        {event.endDate && event.endDate !== event.startDate ? ` | until ${formatAppDate(event.endDate)}` : ""}
                      </Text>
                    </View>
                    {event.venue ? (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={14} color={palette.muted} />
                        <Text style={styles.detailText}>{event.venue}</Text>
                      </View>
                    ) : null}
                  </View>

                  {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={26} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.emptyText}>No events match this view on the selected day.</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14 },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  title: { color: palette.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginTop: 6 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  errorBox: { alignItems: "center", backgroundColor: "#fef2f2", borderColor: "#fecaca", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 12, padding: 12 },
  errorText: { color: "#991b1b", flex: 1, fontSize: 12, lineHeight: 18 },
  retryText: { color: "#b91c1c", fontSize: 12, fontWeight: "700" },
  systemRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  systemLabel: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  systemToggle: { backgroundColor: "#f1f5f9", borderRadius: 12, flexDirection: "row", padding: 2 },
  systemOption: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  systemOptionActive: { backgroundColor: "#ffffff", shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  systemText: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  systemTextActive: { color: palette.ink },
  filterRow: { alignItems: "center", flexDirection: "row", gap: 8, marginBottom: 12 },
  filterContent: { gap: 6, paddingRight: 8 },
  filterChip: { alignItems: "center", backgroundColor: "#ffffff", borderColor: palette.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 },
  filterChipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  filterDot: { borderRadius: 4, height: 7, width: 7 },
  filterText: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#ffffff" },
  todayButton: { alignItems: "center", backgroundColor: palette.primarySoft, borderRadius: 12, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  todayText: { color: palette.primary, fontSize: 11, fontWeight: "700" },
  loadingBox: { alignItems: "center", backgroundColor: "#ffffff", borderColor: palette.border, borderRadius: 22, borderWidth: 1, gap: 8, paddingVertical: 48 },
  loadingText: { color: palette.muted, fontSize: 12 },
  calendarCard: { backgroundColor: "#ffffff", borderColor: "#d9dee7", borderRadius: 16, borderWidth: 1, overflow: "hidden", paddingBottom: 0 },
  bsHeader: { alignItems: "center", backgroundColor: "#fffdf9", borderBottomColor: "#d9dee7", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  bsTitleBlock: { flex: 1 },
  bsTitle: { color: "#c62828", fontSize: 18, fontWeight: "900" },
  bsRange: { color: palette.muted, fontSize: 10, marginTop: 2 },
  bsNav: { alignItems: "center", flexDirection: "row", gap: 4 },
  bsNavButton: { alignItems: "center", borderColor: palette.border, borderRadius: 9, borderWidth: 1, height: 30, justifyContent: "center", width: 30 },
  bsTodayButton: { backgroundColor: palette.primarySoft, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  bsTodayText: { color: palette.primary, fontSize: 10, fontWeight: "800" },
  bsWeekRow: { flexDirection: "row" },
  bsWeekday: { backgroundColor: "#fff", borderBottomColor: "#d9dee7", borderBottomWidth: 1, color: "#475569", flex: 1, fontSize: 10, fontWeight: "900", paddingVertical: 9, textAlign: "center" },
  bsWeekdayHoliday: { color: "#dc2626" },
  monthDayCell: { alignItems: "center", borderBottomColor: "#d9dee7", borderBottomWidth: StyleSheet.hairlineWidth, borderRightColor: "#d9dee7", borderRightWidth: StyleSheet.hairlineWidth, flex: 1, height: 76, justifyContent: "flex-start", paddingHorizontal: 2, paddingTop: 4, position: "relative" },
  monthDayCellSelected: { backgroundColor: calendarColors.selected, borderColor: calendarColors.selected },
  monthDayCellHoliday: { backgroundColor: calendarColors.holidaySoft },
  monthDayCellObservance: { backgroundColor: calendarColors.observanceSoft },
  monthDayCellToday: { backgroundColor: calendarColors.todaySoft, borderColor: calendarColors.selected, borderWidth: 1.5 },
  monthSecondaryDate: { alignSelf: "flex-end", color: "#64748b", fontSize: 9, fontWeight: "700", lineHeight: 11, marginRight: 2 },
  monthPrimaryDate: { color: "#1f2937", fontSize: 19, fontWeight: "700", lineHeight: 24 },
  monthHolidayText: { color: calendarColors.holiday },
  monthObservanceText: { color: calendarColors.observance },
  monthTodayText: { color: calendarColors.selected, fontWeight: "900" },
  monthSelectedText: { color: "#ffffff", fontWeight: "800" },
  monthEventLabel: { color: "#64748b", fontSize: 8, fontWeight: "700", lineHeight: 9.5, marginTop: 1, minHeight: 19, paddingHorizontal: 1, textAlign: "center", width: "100%" },
  bsAttribution: { alignItems: "center", backgroundColor: "#f8fafc", flexDirection: "row", gap: 5, justifyContent: "center", paddingVertical: 7 },
  bsAttributionText: { color: palette.muted, fontSize: 9, fontWeight: "600" },
  dayHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 18 },
  dayTitle: { color: palette.ink, flex: 1, fontSize: 16, fontWeight: "800" },
  dayCount: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  eventCard: { backgroundColor: "#ffffff", borderColor: palette.border, borderLeftWidth: 4, borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 14 },
  eventTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  eventIcon: { alignItems: "center", borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  eventCopy: { flex: 1 },
  eventMetaRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  eventType: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  publicHoliday: { color: palette.muted, fontSize: 10, fontWeight: "600" },
  eventTitle: { color: palette.ink, fontSize: 15, fontWeight: "700", marginTop: 2 },
  eventDetails: { gap: 5, marginTop: 10 },
  detailRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  detailText: { color: palette.inkSoft, flex: 1, fontSize: 12 },
  eventDescription: { borderTopColor: "#f1f5f9", borderTopWidth: 1, color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 10, paddingTop: 10 },
  emptyCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: palette.border, borderRadius: 18, borderWidth: 1, gap: 4, paddingVertical: 34 },
  emptyTitle: { color: palette.inkSoft, fontSize: 14, fontWeight: "700", marginTop: 4 },
  emptyText: { color: palette.muted, fontSize: 12, paddingHorizontal: 24, textAlign: "center" },
});
