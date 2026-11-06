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
import { Calendar as RNCalendar, type CalendarProps, type DateData } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BS_WEEKDAYS_EN,
  BS_WEEKDAYS_NE,
  SCHOOL_EVENT_COLORS,
  addBsMonths,
  addCalendarDays,
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

type CalendarEventItem = Omit<CalendarEvent, "imageUrl" | "eventType"> & {
  imageUrl?: string | null;
  eventType?: CalendarEvent["eventType"];
  source?: "school" | "trisambat";
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

type DayComponentProps = {
  date?: import("react-native-calendars").DateData;
  state?: string;
  marking?: { selected?: boolean; dots?: { key?: string; color: string }[]; disableTouchEvent?: boolean };
  onPress?: (date: import("react-native-calendars").DateData) => void;
};

function MobileCalendarDay({ date, state, marking, onPress }: DayComponentProps) {
  if (!date) return null;
  const selected = state === "selected" || Boolean(marking?.selected);
  const isToday = state === "today";
  const dots = marking?.dots ?? [];
  const isHoliday = dots.some((dot) => dot.color === SCHOOL_EVENT_COLORS.holiday);
  const label = `${date.dateString}${isHoliday ? ", public holiday" : dots.length ? `, ${dots.length} events` : ""}`;

  return (
    <View style={styles.dayWrap}>
      <Pressable
        onPress={() => onPress?.(date)}
        disabled={state === "disabled" || marking?.disableTouchEvent}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={[
          styles.dayCell,
          selected && styles.dayCellSelected,
          !selected && isHoliday && styles.dayCellHoliday,
          !selected && isToday && styles.dayCellToday,
        ]}
      >
        <Text style={[
          styles.dayNumber,
          selected && styles.dayNumberSelected,
          !selected && isHoliday && styles.dayNumberHoliday,
          !selected && isToday && styles.dayNumberToday,
        ]}>
          {date.day}
        </Text>
        {dots.length ? (
          <View style={styles.dayDots}>
            {dots.slice(0, 3).map((dot, index) => (
              <View
                key={dot.key ?? index}
                style={[styles.dayDot, { backgroundColor: selected ? "#ffffff" : dot.color }]}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function Calendar() {
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(localDateKey());
  const [system, setSystem] = useState<"ad" | "bs">("ad");
  const [visibleBs, setVisibleBs] = useState(() => {
    const bs = adToBs(localDateKey());
    return { year: bs?.year ?? 2083, month: bs?.month ?? 1 };
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
      setEvents(result.data ?? []);
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

  const filtered = useMemo(
    () => events.filter((event) => filter === "all" || (event.eventType ?? "event") === filter),
    [events, filter],
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
    for (const event of filtered) {
      const last = event.endDate && event.endDate >= event.startDate ? event.endDate : event.startDate;
      let day = event.startDate;
      let guard = 0;
      while (day <= last && guard < 400) {
        marks[day] ??= { dots: [] };
        const color = SCHOOL_EVENT_COLORS[event.eventType ?? "event"];
        if (!marks[day].dots.some((dot) => dot.key === event.id)) {
          marks[day].dots.push({ key: event.id, color });
        }
        day = addCalendarDays(day, 1);
        guard += 1;
      }
    }
    marks[selectedDay] = { ...(marks[selectedDay] ?? { dots: [] }), selected: true, selectedColor: palette.primary };
    return marks;
  }, [filtered, selectedDay]);

  const dayEvents = useMemo(() => eventsOnDay(filtered, selectedDay), [filtered, selectedDay]);
  const bsWeeks = useMemo(() => bsMonthGrid(visibleBs.year, visibleBs.month), [visibleBs.year, visibleBs.month]);
  const bsRange = bsMonthAdRange(visibleBs.year, visibleBs.month);
  const today = localDateKey();

  useEffect(() => {
    const bs = adToBs(selectedDay);
    if (bs) setVisibleBs({ year: bs.year, month: bs.month });
  }, [selectedDay]);

  useEffect(() => {
    if (locale === "ne") setSystem("bs");
  }, [locale]);

  function moveBsMonth(amount: number) {
    setVisibleBs((current) => addBsMonths(current.year, current.month, amount));
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
                  <View style={[styles.filterDot, { backgroundColor: SCHOOL_EVENT_COLORS[option.value as CalendarEvent["eventType"]] }]} />
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
                {(locale === "ne" ? BS_WEEKDAYS_NE : BS_WEEKDAYS_EN).map((weekday) => (
                  <Text key={weekday} style={styles.bsWeekday}>{weekday}</Text>
                ))}
              </View>

              {bsWeeks.map((week, weekIndex) => (
                <View key={`bs-week-${weekIndex}`} style={styles.bsWeekRow}>
                  {week.map((cell, dayIndex) => {
                    if (!cell) return <View key={`bs-blank-${weekIndex}-${dayIndex}`} style={styles.bsDayCell} />;
                    const items = eventsOnDay(filtered, cell.adDate);
                    const selected = cell.adDate === selectedDay;
                    return (
                      <Pressable
                        key={cell.adDate}
                        onPress={() => setSelectedDay(cell.adDate)}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatBsDate(cell.adDate, locale)}${items.length ? `, ${items.length} events` : ""}`}
                        accessibilityState={{ selected }}
                        style={[styles.bsDayCell, selected && styles.bsDayCellSelected, cell.adDate === today && !selected && styles.bsDayCellToday]}
                      >
                        <Text style={[styles.bsDayNumber, selected && styles.bsDayNumberSelected, cell.adDate === today && !selected && styles.bsDayNumberToday]}>
                          {cell.bsDate.date}
                        </Text>
                        <View style={styles.bsDots}>
                          {items.slice(0, 3).map((event) => (
                            <View key={event.id} style={[styles.bsDot, { backgroundColor: SCHOOL_EVENT_COLORS[event.eventType ?? "event"] }]} />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.calendarCard}>
              <RNCalendar
                current={selectedDay}
                onDayPress={(day: DateData) => setSelectedDay(day.dateString)}
                markedDates={markedDates}
                markingType="multi-dot"
                enableSwipeMonths
                theme={{
                  calendarBackground: "#ffffff",
                  textSectionTitleColor: palette.muted,
                  selectedDayBackgroundColor: palette.primary,
                  selectedDayTextColor: "#ffffff",
                  todayTextColor: palette.primary,
                  dayTextColor: palette.inkSoft,
                  textDisabledColor: "#cbd5e1",
                  arrowColor: palette.primary,
                  monthTextColor: palette.ink,
                  textMonthFontWeight: "700",
                  textDayFontSize: 13,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 11,
                  dotColor: palette.primary,
                  selectedDotColor: "#ffffff",
                }}
                style={styles.calendar}
              />
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
              const color = SCHOOL_EVENT_COLORS[event.eventType ?? "event"];
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
                        {event.source === "trisambat" ? <Text style={styles.publicHoliday}>Public holiday</Text> : null}
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
  container: { paddingHorizontal: 20 },
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
  calendarCard: { backgroundColor: "#ffffff", borderColor: palette.border, borderRadius: 22, borderWidth: 1, overflow: "hidden", paddingBottom: 6 },
  calendar: { paddingHorizontal: 4 },
  bsHeader: { alignItems: "center", borderBottomColor: "#f1f5f9", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  bsTitleBlock: { flex: 1 },
  bsTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  bsRange: { color: palette.muted, fontSize: 10, marginTop: 2 },
  bsNav: { alignItems: "center", flexDirection: "row", gap: 4 },
  bsNavButton: { alignItems: "center", borderColor: palette.border, borderRadius: 9, borderWidth: 1, height: 30, justifyContent: "center", width: 30 },
  bsTodayButton: { backgroundColor: palette.primarySoft, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  bsTodayText: { color: palette.primary, fontSize: 10, fontWeight: "800" },
  bsWeekRow: { flexDirection: "row", paddingHorizontal: 6 },
  bsWeekday: { color: "#94a3b8", flex: 1, fontSize: 9, fontWeight: "800", paddingVertical: 7, textAlign: "center", textTransform: "uppercase" },
  bsDayCell: { alignItems: "center", borderColor: "transparent", borderRadius: 10, borderWidth: 1, flex: 1, height: 42, justifyContent: "center", margin: 1 },
  bsDayCellSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  bsDayCellToday: { borderColor: palette.primary },
  bsDayNumber: { color: palette.inkSoft, fontSize: 12, fontWeight: "600" },
  bsDayNumberSelected: { color: "#ffffff", fontWeight: "800" },
  bsDayNumberToday: { color: palette.primary, fontWeight: "800" },
  bsDots: { flexDirection: "row", gap: 2, height: 5, marginTop: 2 },
  bsDot: { borderRadius: 2, height: 4, width: 4 },
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
  // AD calendar custom day component styles
  dayWrap: { alignItems: "center", flex: 1, paddingVertical: 2 },
  dayCell: { alignItems: "center", borderColor: "transparent", borderRadius: 20, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  dayCellSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  dayCellHoliday: { backgroundColor: "#fef2f2" },
  dayCellToday: { borderColor: palette.primary },
  dayNumber: { color: palette.inkSoft, fontSize: 13, fontWeight: "600" },
  dayNumberSelected: { color: "#ffffff", fontWeight: "800" },
  dayNumberHoliday: { color: "#b91c1c" },
  dayNumberToday: { color: palette.primary, fontWeight: "800" },
  dayDots: { flexDirection: "row", gap: 2, height: 5, marginTop: 2 },
  dayDot: { borderRadius: 2, height: 4, width: 4 },
});
