import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

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

type DatePickerProps = {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  onClose: () => void;
  label?: string;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return undefined;
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function fmtYMD(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inRange(date: Date | undefined, min?: Date, max?: Date) {
  if (!date) return false;
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

export function DatePicker({
  visible,
  value,
  onChange,
  onClose,
  label = "Select date",
  min,
  max,
}: DatePickerProps) {
  const [selected, setSelected] = useState<Date | undefined>(parseDate(value));
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  useEffect(() => {
    const next = parseDate(value);
    const nextMin = parseDate(min);
    const nextMax = parseDate(max);
    const nextToday = new Date();
    nextToday.setUTCHours(0, 0, 0, 0);
    if (next && inRange(next, nextMin, nextMax)) {
      // Prop changes reset the temporary month selection used by the modal.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(next);
      return;
    }
    if (inRange(nextToday, nextMin, nextMax)) {
      setSelected(nextToday);
    }
  }, [value, min, max]);

  const displaySelected =
    selected && inRange(selected, minDate, maxDate)
      ? selected
      : inRange(today, minDate, maxDate)
        ? today
        : undefined;

  const year = displaySelected?.getUTCFullYear() ?? today.getUTCFullYear();
  const month = displaySelected?.getUTCMonth() ?? today.getUTCMonth();

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startOffset = firstOfMonth.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const isSameDay = (a: Date, b: Date | undefined) =>
    b !== undefined &&
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    const lastDay = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const currentDay = Math.min(displaySelected?.getUTCDate() ?? 1, lastDay);
    let candidate = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), currentDay),
    );
    if (minDate && candidate < minDate) candidate = minDate;
    if (maxDate && candidate > maxDate) candidate = maxDate;
    if (inRange(candidate, minDate, maxDate)) setSelected(candidate);
  };

  const selectDay = (day: number) => {
    const next = new Date(Date.UTC(year, month, day));
    if (!inRange(next, minDate, maxDate)) return;
    setSelected(next);
    onChange(fmtYMD(next));
  };

  const headerMonth = `${MONTHS[month]} ${year}`;

  const days: (null | number)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close date picker"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{label}</Text>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Previous month"
            onPress={() => changeMonth(-1)}
            style={styles.nav}
          >
            <MaterialCommunityIcons name="chevron-left" color={palette.primary} size={22} />
          </Pressable>
          <Text style={styles.month}>{headerMonth}</Text>
          <Pressable
            accessibilityLabel="Next month"
            onPress={() => changeMonth(1)}
            style={styles.nav}
          >
            <MaterialCommunityIcons name="chevron-right" color={palette.primary} size={22} />
          </Pressable>
        </View>
        <View style={styles.weekdays}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={styles.weekday}>{day}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((day, index) => (
            day === null ? (
              <View key={index} style={styles.dayEmpty} />
            ) : (
              <TouchableOpacity
                key={index}
                accessibilityLabel={String(day)}
                onPress={() => selectDay(day)}
                style={[
                  styles.day,
                  isSameDay(
                    new Date(Date.UTC(year, month, day)),
                    displaySelected,
                  )
                    ? styles.daySelected
                    : null,
                  isSameDay(new Date(Date.UTC(year, month, day)), today)
                    ? styles.dayToday
                    : null,
                  !inRange(
                    new Date(Date.UTC(year, month, day)),
                    minDate,
                    maxDate,
                  )
                    ? styles.dayDisabled
                    : null,
                ]}
              >
                  <Text style={[styles.dayText, isSameDay(new Date(Date.UTC(year, month, day)), displaySelected) && styles.daySelectedText]}>
                  {day}
                </Text>
              </TouchableOpacity>
            )
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Cancel" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm date"
             disabled={!displaySelected}
             onPress={() => {
               if (displaySelected) onChange(fmtYMD(displaySelected));
              onClose();
            }}
            style={styles.confirm}
          >
            <Text style={styles.confirmText}>Set</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { height: -4, width: 0 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    height: 5,
    marginVertical: 10,
    width: 40,
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  nav: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  month: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  weekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekday: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    width: 36,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  dayEmpty: { height: 52, width: 36 },
  day: {
    alignItems: "center",
    borderRadius: 12,
    height: 46,
    justifyContent: "center",
    width: 36,
  },
  daySelected: { backgroundColor: palette.primary },
  dayToday: { borderColor: palette.primary, borderWidth: 1.5 },
  dayDisabled: { opacity: 0.45 },
  dayText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  daySelectedText: { color: "#fff" },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  cancelText: { color: palette.inkSoft, fontSize: 15, fontWeight: "800" },
  confirm: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 10,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { height: 2, width: 0 },
    elevation: 3,
  },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
