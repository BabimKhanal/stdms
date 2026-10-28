import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Text } from "@react-navigation/elements";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EduApiClient } from "@edu/api-client";
import { mobileToken, useAuth } from "../../auth";
import { API_URL } from "../../config";
import { NotificationBell } from "../components/NotificationBell";

type Notice = {
  id: string;
  title: string;
  body?: string | null;
  priority?: string;
  publishAt?: string;
  authorName?: string | null;
};
type CalendarEvent = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string | null;
  startTime?: string | null;
  venue?: string | null;
};
type Dashboard = {
  students?: number;
  employees?: number;
  attendancePercentage?: number;
  fees?: { outstanding?: number };
  recentNotices?: Notice[];
  upcomingEvents?: CalendarEvent[];
};
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function greetingFor(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", options).format(date);
}

export function Home() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isLearner = Boolean(user?.studentId) && !user?.isPlatformAdmin;
  const isGuardian =
    !isLearner &&
    Boolean(
      user?.roles?.some((role) => role === "parent" || role === "guardian"),
    );
  // Guardians get the personal tiles, not the school-wide dashboard.
  const canViewDashboard =
    !isLearner &&
    !isGuardian &&
    (user?.isPlatformAdmin || user?.permissions.includes("organisation.view"));
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = await mobileToken();
    if (!token) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const api = new EduApiClient(API_URL, () => token);
    setError("");
    const [stats, noticeResult, eventResult] = await Promise.allSettled([
      canViewDashboard
        ? api.get<Dashboard>("/dashboard")
        : Promise.resolve(null),
      api.get<{ data?: Notice[] }>("/notices"),
      api.get<{ data?: CalendarEvent[] }>("/events"),
    ]);
    if (stats.status === "fulfilled" && stats.value) {
      setDashboard(stats.value);
      if (stats.value.recentNotices) setNotices(stats.value.recentNotices);
    }
    if (noticeResult.status === "fulfilled")
      setNotices((noticeResult.value.data ?? []).slice(0, 3));
    if (eventResult.status === "fulfilled")
      setEvents((eventResult.value.data ?? []).slice(0, 3));
    if (
      stats.status === "rejected" &&
      noticeResult.status === "rejected" &&
      eventResult.status === "rejected"
    ) {
      setError("Unable to load your dashboard. Pull down to try again.");
    }
    setLoading(false);
    setRefreshing(false);
  }, [canViewDashboard]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await mobileToken();
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const now = new Date();
  const roleName = isLearner
    ? "STUDENT"
    : (user?.roles?.[0] ?? "STAFF").replaceAll("_", " ").toUpperCase();
  const permissions = user?.permissions ?? [];
  const can = (...required: string[]) =>
    Boolean(
      user?.isPlatformAdmin ||
      required.some((permission) => permissions.includes(permission)),
    );

  // Student quick actions - only routes that actually exist
  type QuickTile = {
    label: string;
    icon: IconName;
    color: string;
    bg: string;
    onPress: () => void;
  };
  const studentQuickActions: QuickTile[] = [
    can("homework.view") && {
      label: "Homework",
      icon: "book-open-page-variant-outline" as IconName,
      color: "#7c3aed",
      bg: "#f5f3ff",
      onPress: () => navigation.navigate("Learning"),
    },
    can("attendance.view") && {
      label: "Attendance",
      icon: "calendar-check-outline" as IconName,
      color: "#059669",
      bg: "#ecfdf5",
      onPress: () => navigation.navigate("Attendance"),
    },
    can("result.view", "exam.view") && {
      label: "Results",
      icon: "chart-line" as IconName,
      color: "#2563eb",
      bg: "#eff6ff",
      onPress: () => navigation.navigate("Results"),
    },
    can("invoice.view", "fee.view") && {
      label: "Fees",
      icon: "wallet-outline" as IconName,
      color: "#d97706",
      bg: "#fffbeb",
      onPress: () => navigation.navigate("Fees"),
    },
    Boolean(user?.studentId) && can("leave.create") && {
      label: "Leave",
      icon: "calendar-remove-outline" as IconName,
      color: "#db2777",
      bg: "#fdf2f8",
      onPress: () => navigation.navigate("Leave"),
    },
  ].filter((action): action is QuickTile => Boolean(action));

  const workflowActions: {
    label: string;
    description: string;
    icon: IconName;
    onPress: () => void;
  }[] = [
    can("attendance.create", "attendance.edit")
      ? {
          label: "Take attendance",
          description: "Open today's register",
          icon: "calendar-check-outline" as IconName,
          onPress: () => navigation.navigate("Attendance"),
        }
      : null,
    can("homework.view", "homework.create", "homework.edit")
      ? {
          label: "Review learning",
          description: "Check assignments and work",
          icon: "book-open-outline" as IconName,
          onPress: () => navigation.navigate("Learning"),
        }
      : null,
    can("result.view", "result.create")
      ? {
          label: "Review results",
          description: "Open exams and scores",
          icon: "chart-box-outline" as IconName,
          onPress: () => navigation.navigate("Results"),
        }
      : null,
    can("fee.view", "invoice.view")
      ? {
          label: "Check fees",
          description: "View balances and invoices",
          icon: "cash-multiple" as IconName,
          onPress: () => navigation.navigate("Fees"),
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          colors={["#7c3aed"]}
          tintColor="#7c3aed"
        />
      }
    >
      {/* Top bar - friendly & clean */}
      <View style={styles.topline}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="school" color="#fff" size={20} />
          </View>
          <View>
            <Text style={styles.eyebrow}>{user?.orgName ?? "YOUR SCHOOL"}</Text>
            <Text style={styles.date}>
              {formatDate(now.toISOString(), {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <NotificationBell onPress={() => navigation.navigate("Updates")} />
          <Pressable
            accessibilityLabel="Open profile"
            onPress={() =>
              navigation.navigate("Profile", { user: user?.name ?? "user" })
            }
            style={({ pressed }) => [
              styles.avatar,
              pressed && styles.pressedSoft,
            ]}
          >
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) ?? "U"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Hero greeting - warm & welcoming */}
      <View style={styles.hero}>
        <View style={styles.heroBlob} />
        <View style={styles.heroBlobSmall} />
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name={isLearner ? "emoticon-happy-outline" : "briefcase-outline"}
              color="#fff"
              size={13}
            />
            <Text style={styles.heroBadgeText}>{roleName}</Text>
          </View>
          <Text style={styles.greeting}>{greetingFor(now.getHours())},</Text>
          <Text style={styles.greetingName}>{firstName}! 👋</Text>
          <Text style={styles.subtitle}>
            {isLearner
              ? "You're doing great. Let's keep the streak going."
              : "Here's what's happening across your school today."}
          </Text>
        </View>
      </View>

      {error ? (
        <Pressable
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={styles.errorBanner}
        >
          <MaterialCommunityIcons
            name="cloud-alert-outline"
            color="#be123c"
            size={20}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      {canViewDashboard ? (
        loading ? (
          <ActivityIndicator color="#7c3aed" style={styles.loader} />
        ) : (
          <>
            <SectionHeading
              title="At a glance"
              action="Open tools"
              onPress={() =>
                navigation.navigate("HomeTabs", { screen: "More" })
              }
            />
            <View style={styles.grid}>
              <Metric
                label="Students"
                value={dashboard.students ?? 0}
                icon="account-group-outline"
                tint="#7c3aed"
                bg="#f5f3ff"
              />
              <Metric
                label="Staff"
                value={dashboard.employees ?? 0}
                icon="briefcase-outline"
                tint="#2563eb"
                bg="#eff6ff"
              />
              <Metric
                label="Attendance"
                value={`${dashboard.attendancePercentage ?? 0}%`}
                icon="calendar-check-outline"
                tint="#059669"
                bg="#ecfdf5"
                onPress={() =>
                  navigation.navigate("HomeTabs", { screen: "Attendance" })
                }
              />
              <Metric
                label="Outstanding"
                value={`Rs ${Number(dashboard.fees?.outstanding ?? 0).toLocaleString()}`}
                icon="cash-multiple"
                tint="#d97706"
                bg="#fffbeb"
                onPress={() =>
                  navigation.navigate("HomeTabs", { screen: "More" })
                }
              />
            </View>
          </>
        )
      ) : (
        <>
          {/* STUDENT VIEW - big friendly tiles */}
          <SectionHeading
            title="Jump into"
            action="See all"
            onPress={() => navigation.navigate("HomeTabs", { screen: "More" })}
          />
          <View style={styles.tileGrid}>
            {studentQuickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && styles.pressedTile,
                ]}
              >
                <View style={[styles.tileIcon, { backgroundColor: action.bg }]}>
                  <MaterialCommunityIcons
                    name={action.icon}
                    color={action.color}
                    size={26}
                  />
                </View>
                <Text style={styles.tileLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Friendly reminder card */}
          <View style={styles.tip}>
            <View style={styles.tipIcon}>
              <MaterialCommunityIcons
                name="lightbulb-on"
                color="#d97706"
                size={22}
              />
            </View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipLabel}>Daily tip</Text>
              <Text style={styles.tipText}>
                Check your updates for new notices and graded work before class.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="arrow-top-right"
              color="#d97706"
              size={17}
            />
          </View>
        </>
      )}

      {canViewDashboard && workflowActions.length ? (
        <>
          <SectionHeading
            title="Today's workflow"
            action="Open tools"
            onPress={() => navigation.navigate("HomeTabs", { screen: "More" })}
          />
          <View style={styles.quickGrid}>
            {workflowActions.map((action) => (
              <QuickAction
                key={action.label}
                label={action.label}
                description={action.description}
                icon={action.icon}
                onPress={action.onPress}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* Notices - friendly cards */}
      <SectionHeading
        title="Latest notices"
        action="See all"
        onPress={() => navigation.navigate("Updates")}
      />
      {notices.length ? (
        notices.map((notice) => (
          <Pressable
            key={notice.id}
            onPress={() => navigation.navigate("Updates")}
            style={({ pressed }) => [
              styles.noticeCard,
              notice.priority === "urgent" && styles.noticeUrgent,
              pressed && styles.pressedSoft,
            ]}
          >
            <View style={styles.noticeTop}>
              <View
                style={[
                  styles.noticeDot,
                  notice.priority === "urgent"
                    ? styles.dotRose
                    : notice.priority === "high"
                      ? styles.dotAmber
                      : styles.dotViolet,
                ]}
              />
              <Text style={styles.noticeDate}>
                {notice.publishAt
                  ? formatDate(notice.publishAt, {
                      day: "numeric",
                      month: "short",
                    })
                  : "Notice"}
              </Text>
              {notice.priority === "urgent" && (
                <View style={styles.urgentTag}>
                  <Text style={styles.urgentTagText}>URGENT</Text>
                </View>
              )}
            </View>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            {notice.body ? (
              <Text numberOfLines={2} style={styles.noticeBody}>
                {notice.body}
              </Text>
            ) : null}
          </Pressable>
        ))
      ) : !loading ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="bullhorn-outline"
            color="#a78bfa"
            size={22}
          />
          <Text style={styles.emptyText}>No notices yet. Check back soon!</Text>
        </View>
      ) : null}

      {/* Events - friendly row */}
      <SectionHeading
        title="Coming up"
        action="Calendar"
        onPress={() => navigation.navigate("Updates")}
      />
      {events.length ? (
        events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => navigation.navigate("Updates")}
            style={({ pressed }) => [
              styles.eventRow,
              pressed && styles.pressedSoft,
            ]}
          >
            <View style={styles.eventDate}>
              <Text style={styles.eventDay}>
                {event.startDate
                  ? formatDate(event.startDate, { day: "numeric" })
                  : "—"}
              </Text>
              <Text style={styles.eventMonth}>
                {event.startDate
                  ? formatDate(event.startDate, {
                      month: "short",
                    }).toUpperCase()
                  : ""}
              </Text>
            </View>
            <View style={styles.eventCopy}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.eventMetaRow}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  color="#94a3b8"
                  size={12}
                />
                <Text style={styles.eventMeta}>
                  {event.startTime ?? "All day"}{" "}
                  {event.venue ? `· ${event.venue}` : ""}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              color="#cbd5e1"
              size={20}
            />
          </Pressable>
        ))
      ) : !loading ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            color="#a78bfa"
            size={22}
          />
          <Text style={styles.emptyText}>
            Nothing scheduled. Enjoy the calm! ☀️
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.sectionAction}>{action} →</Text>
      </Pressable>
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  onPress,
  tint = "#7c3aed",
  bg = "#f5f3ff",
}: {
  label: string;
  value: string | number;
  icon: IconName;
  onPress?: () => void;
  tint?: string;
  bg?: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressedSoft]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: bg }]}>
          <MaterialCommunityIcons name={icon} color={tint} size={20} />
        </View>
        {onPress && (
          <MaterialCommunityIcons
            name="arrow-top-right"
            color="#cbd5e1"
            size={15}
          />
        )}
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </Pressable>
  );
}

function QuickAction({
  label,
  description,
  icon,
  onPress,
}: {
  label: string;
  description?: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressedSoft]}
    >
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons name={icon} color="#7c3aed" size={22} />
      </View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickLabel}>{label}</Text>
        {description ? (
          <Text style={styles.quickDescription}>{description}</Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" color="#cbd5e1" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#faf9ff", padding: 18, paddingBottom: 48 },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#7c3aed",
    borderRadius: 13,
    height: 40,
    justifyContent: "center",
    width: 40,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
  },
  eyebrow: {
    color: "#7c3aed",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  date: { color: "#94a3b8", fontSize: 11, marginTop: 3, fontWeight: "600" },
  avatar: {
    alignItems: "center",
    backgroundColor: "#ede9fe",
    borderColor: "#ddd6fe",
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: { color: "#6d28d9", fontSize: 16, fontWeight: "800" },

  // Hero
  hero: {
    backgroundColor: "#5b21b6",
    borderRadius: 28,
    overflow: "hidden",
    padding: 24,
    shadowColor: "#5b21b6",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { height: 8, width: 0 },
    elevation: 6,
  },
  heroBlob: {
    backgroundColor: "#8b5cf6",
    borderRadius: 120,
    height: 220,
    opacity: 0.35,
    position: "absolute",
    right: -70,
    top: -80,
    width: 220,
  },
  heroBlobSmall: {
    backgroundColor: "#c4b5fd",
    borderRadius: 60,
    height: 100,
    opacity: 0.2,
    position: "absolute",
    right: 20,
    bottom: -30,
    width: 100,
  },
  heroContent: { position: "relative", zIndex: 1 },
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  greeting: {
    color: "#e9d5ff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 14,
  },
  greetingName: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    color: "#ddd6fe",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 280,
  },

  loader: { marginTop: 52 },

  errorBanner: {
    alignItems: "center",
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 18,
    padding: 14,
  },
  errorText: {
    color: "#be123c",
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  // Section heading
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 4,
  },
  sectionLabel: {
    color: "#1e1b4b",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionAction: { color: "#7c3aed", fontSize: 12, fontWeight: "800" },

  // Metrics grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 12 },
  card: {
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    padding: 15,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
  },
  cardValue: {
    color: "#1e1b4b",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.5,
  },

  // Student big tiles
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 12 },
  tile: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 100,
    paddingVertical: 18,
    paddingHorizontal: 10,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
    marginBottom: 10,
  },
  tileLabel: {
    color: "#1e1b4b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  // Tip
  tip: {
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 22,
    padding: 14,
  },
  tipIcon: {
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  tipCopy: { flex: 1, marginLeft: 11 },
  tipLabel: { color: "#b45309", fontSize: 12, fontWeight: "800" },
  tipText: {
    color: "#d97706",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: "500",
  },

  // Quick action rows (staff)
  quickGrid: { gap: 10, marginTop: 12 },
  quick: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    padding: 13,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
    elevation: 1,
  },
  quickIcon: {
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  quickCopy: { flex: 1, marginLeft: 12 },
  quickLabel: { color: "#1e1b4b", fontSize: 14, fontWeight: "800" },
  quickDescription: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  // Notices
  noticeCard: {
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    padding: 15,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
    elevation: 1,
  },
  noticeUrgent: { backgroundColor: "#fff7f8", borderColor: "#fecdd3" },
  noticeTop: { alignItems: "center", flexDirection: "row", gap: 7 },
  noticeDot: { borderRadius: 4, height: 8, width: 8 },
  dotViolet: { backgroundColor: "#7c3aed" },
  dotAmber: { backgroundColor: "#d97706" },
  dotRose: { backgroundColor: "#e11d48" },
  noticeDate: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  urgentTag: {
    backgroundColor: "#e11d48",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: "auto",
  },
  urgentTagText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  noticeTitle: {
    color: "#1e1b4b",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
    letterSpacing: -0.2,
  },
  noticeBody: { color: "#64748b", fontSize: 12, lineHeight: 18, marginTop: 5 },

  // Events
  eventRow: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 12,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
    elevation: 1,
  },
  eventDate: {
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  eventDay: {
    color: "#6d28d9",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  eventMonth: {
    color: "#8b5cf6",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  eventCopy: { flex: 1 },
  eventTitle: { color: "#1e1b4b", fontSize: 14, fontWeight: "800" },
  eventMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 5,
  },
  eventMeta: { color: "#64748b", fontSize: 11, fontWeight: "600" },

  // Empty
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#f1f0f9",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
    padding: 16,
  },
  emptyText: { color: "#94a3b8", flex: 1, fontSize: 12, fontWeight: "600" },

  // Press states
  pressedSoft: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  pressedTile: {
    backgroundColor: "#faf5ff",
    borderColor: "#ddd6fe",
    transform: [{ scale: 0.96 }],
  },
});
