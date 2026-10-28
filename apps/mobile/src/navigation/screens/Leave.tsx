import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EduApiClient } from "@edu/api-client";
import { mobileToken, useAuth } from "../../auth";
import { API_URL } from "../../config";

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#faf9ff",
  ink: "#1e1b4b",
  inkSoft: "#475569",
  muted: "#94a3b8",
  border: "#f1f0f9",
  success: "#059669",
  successSoft: "#ecfdf5",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
};

const LEAVE_TYPES = [
  "sick",
  "personal",
  "emergency",
  "annual",
  "casual",
  "custom",
] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

type LeaveRow = {
  id: string;
  type: LeaveType;
  customType: string | null;
  reason: string;
  fromDate: string;
  toDate: string;
  status: "pending" | "approved" | "rejected";
  reviewComment: string | null;
  createdAt: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function labelFor(type: LeaveType, customType: string | null) {
  if (type === "custom" && customType) return customType;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

const statusTone = {
  pending: { bg: palette.warnSoft, fg: palette.warn },
  approved: { bg: palette.successSoft, fg: palette.success },
  rejected: { bg: palette.dangerSoft, fg: palette.danger },
};

export function Leave() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [type, setType] = useState<LeaveType>("sick");
  const [customType, setCustomType] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const result = await new EduApiClient(API_URL, () => token).get<LeaveRow[]>("/leave");
      setRows(result);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load your leave requests",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit() {
    if (!user?.studentId) {
      setError("Only student accounts can request leave here.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please describe the reason in at least 3 characters.");
      return;
    }
    if (type === "custom" && customType.trim().length < 2) {
      setError("Please name the leave type.");
      return;
    }
    if (!fromDate || !toDate) {
      setError("Please choose both the start and end date.");
      return;
    }
    if (fromDate > toDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      await new EduApiClient(API_URL, () => token).post("/leave", {
        applicantType: "student",
        studentId: user.studentId,
        type,
        customType: type === "custom" ? customType.trim() : null,
        reason: reason.trim(),
        fromDate,
        toDate,
      });
      setMessage("✓ Leave request sent to your class teacher.");
      setReason("");
      setCustomType("");
      await load("refresh");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit your leave request",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load("refresh")}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name="calendar-remove-outline"
            color={palette.primary}
            size={24}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Leave requests</Text>
          <Text style={styles.heroText}>
            Tell the school when you cannot attend class.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apply for leave</Text>

        <Text style={styles.label}>Reason type</Text>
        <View style={styles.chips}>
          {LEAVE_TYPES.map((option) => {
            const active = type === option;
            return (
              <Pressable
                key={option}
                onPress={() => setType(option)}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                ]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {type === "custom" ? (
          <>
            <Text style={styles.label}>Leave name</Text>
            <TextInput
              value={customType}
              onChangeText={setCustomType}
              placeholder="e.g. Family function"
              placeholderTextColor={palette.muted}
              maxLength={60}
              style={styles.input}
            />
          </>
        ) : null}

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>From</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To</Text>
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Reason</Text>
        <TextInput
          multiline
          value={reason}
          onChangeText={setReason}
          placeholder="Explain briefly so your teacher can review it."
          placeholderTextColor={palette.muted}
          maxLength={500}
          style={[styles.input, styles.textarea]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable
          disabled={saving}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submit,
            (pressed || saving) && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <MaterialCommunityIcons name="send" color="#fff" size={17} />
          )}
          <Text style={styles.submitText}>
            {saving ? "Sending..." : "Send request"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Your requests</Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} />
      ) : rows.length ? (
        <View style={{ gap: 10 }}>
          {rows.map((row) => {
            const tone = statusTone[row.status] ?? statusTone.pending;
            return (
              <View key={row.id} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>
                    {labelFor(row.type, row.customType)}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.rowMeta}>
                  {formatDate(row.fromDate)} → {formatDate(row.toDate)}
                </Text>
                <Text style={styles.rowReason}>{row.reason}</Text>
                {row.reviewComment ? (
                  <Text style={styles.rowComment}>
                    School: {row.reviewComment}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="calendar-check-outline"
            color={palette.muted}
            size={26}
          />
          <Text style={styles.emptyTitle}>No leave requests</Text>
          <Text style={styles.emptyText}>
            Requests you send will appear here with their approval status.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bg,
    flexGrow: 1,
    padding: 20,
    paddingBottom: 60,
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroText: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
  },
  card: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  label: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 14,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#f8fafc",
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
  },
  chipText: { color: palette.inkSoft, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: palette.primary },
  input: {
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  textarea: { minHeight: 92, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", gap: 10 },
  error: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
  },
  success: {
    color: palette.success,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  submit: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { height: 4, width: 0 },
    elevation: 3,
  },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  sectionLabel: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 26,
    textTransform: "uppercase",
  },
  rowCard: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  rowMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
  },
  rowReason: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  rowComment: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 26,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
});
