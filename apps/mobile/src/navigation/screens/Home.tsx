import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Text } from "@react-navigation/elements";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { ProfileAvatar } from "../../components/ProfileAvatar";

/* ---------- types ---------- */
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

/* ---------- palette ---------- */
const palette = {
  primary: "#7c3aed",
  primaryDeep: "#6d28d9",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#faf9ff",
  ink: "#1e1b4b",
  inkSoft: "#475569",
  muted: "#94a3b8",
  border: "#f1f0f9",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
  warning: "#d97706",
  warningSoft: "#fffbeb",
  success: "#059669",
  successSoft: "#ecfdf5",
  info: "#2563eb",
  infoSoft: "#eff6ff",
};

/* ---------- helpers ---------- */
function greetingFor(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
function greetingIcon(hour: number): IconName {
  if (hour < 5) return "weather-night";
  if (hour < 12) return "weather-sunset-up";
  if (hour < 17) return "white-balance-sunny";
  return "weather-sunset-down";
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

function relativeDay(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `in ${diff}d`;
}

/* ---------- animated counter ---------- */
function useCountUp(target: number, duration = 700) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [target, duration, anim]);
  return display;
}

/* ---------- skeleton ---------- */
function Skeleton({ width, height, radius = 10, style }: any) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        {
          backgroundColor: "#ede9fe",
          borderRadius: radius,
          height,
          opacity: pulse,
          width,
        },
        style,
      ]}
    />
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={40} height={40} radius={12} />
      <Skeleton width="60%" height={12} style={{ marginTop: 14 }} />
      <Skeleton width="40%" height={22} radius={6} style={{ marginTop: 8 }} />
    </View>
  );
}

/* ---------- main ---------- */
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
  const [justRefreshed, setJustRefreshed] = useState(false);

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
  const can = useCallback(
    (...required: string[]) =>
      Boolean(
        user?.isPlatformAdmin ||
        required.some((permission) => permissions.includes(permission)),
      ),
    [user?.isPlatformAdmin, permissions],
  );

  const studentQuickActions = useMemo(() => {
    type QuickTile = {
      label: string;
      icon: IconName;
      color: string;
      bg: string;
      onPress: () => void;
    };
    return [
      can("homework.view") && {
        label: "Homework",
        icon: "book-open-page-variant-outline" as IconName,
        color: palette.primary,
        bg: palette.primarySoft,
        onPress: () => navigation.navigate("Learning"),
      },
      can("attendance.view") && {
        label: "Attendance",
        icon: "calendar-check-outline" as IconName,
        color: palette.success,
        bg: palette.successSoft,
        onPress: () => navigation.navigate("Attendance"),
      },
      can("result.view", "exam.view") && {
        label: "Results",
        icon: "chart-line" as IconName,
        color: palette.info,
        bg: palette.infoSoft,
        onPress: () => navigation.navigate("Results"),
      },
      can("invoice.view", "fee.view") && {
        label: "Fees",
        icon: "wallet-outline" as IconName,
        color: palette.warning,
        bg: palette.warningSoft,
        onPress: () => navigation.navigate("Fees"),
      },
      Boolean(user?.studentId) &&
        can("leave.create") && {
          label: "Leave",
          icon: "calendar-remove-outline" as IconName,
          color: "#db2777",
          bg: "#fdf2f8",
          onPress: () => navigation.navigate("Leave"),
        },
    ].filter((a): a is QuickTile => Boolean(a));
  }, [can, navigation, user?.studentId]);

  const workflowActions = useMemo(() => {
    type W = {
      label: string;
      description: string;
      icon: IconName;
      onPress: () => void;
    };
    return [
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
    ].filter((a): a is W => Boolean(a));
  }, [can, navigation]);

  const tipCopy = useMemo(() => {
    if (isLearner) {
      const h = now.getHours();
      if (h < 12)
        return "Check your updates for new notices before first period.";
      if (h < 17)
        return "Review graded work to prepare for tomorrow's classes.";
      return "Pack your bag for tomorrow and set an alarm to stay ahead.";
    }
    return "Keep attendance fresh — you can take the register from the tools tab.";
  }, [isLearner, now]);

  const onRefresh = () => {
    setRefreshing(true);
    void (async () => {
      await load();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1600);
    })();
  };

  /* Entrance stagger */
  const heroAnim = useRef(new Animated.Value(0)).current;
  const sectionsAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = (v: Animated.Value, delay: number) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    Animated.parallel([t(heroAnim, 0), t(sectionsAnim, 120)]).start();
  }, [heroAnim, sectionsAnim]);

  const heroStyle = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };
  const sectionsStyle = {
    opacity: sectionsAnim,
    transform: [
      {
        translateY: sectionsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 108, paddingTop: insets.top + 12 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      {/* Top bar */}
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
        <View style={styles.topActions}>
          {justRefreshed && (
            <View style={styles.refreshPill}>
              <MaterialCommunityIcons
                name="check-circle"
                color={palette.success}
                size={12}
              />
              <Text style={styles.refreshPillText}>Updated</Text>
            </View>
          )}
          <NotificationBell onPress={() => navigation.navigate("Updates")} />
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("Profile", { user: user?.name ?? "user" })
            }
            style={({ pressed }) => [
              styles.avatar,
              pressed && styles.pressedSoft,
            ]}
          >
            <ProfileAvatar name={user?.name} size={40} uri={user?.avatarUrl} />
          </Pressable>
        </View>
      </View>

      {/* Hero */}
      <Animated.View style={[styles.hero, heroStyle]}>
        <View style={styles.heroBlob} />
        <View style={styles.heroBlobSmall} />
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name={greetingIcon(now.getHours())}
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
      </Animated.View>

      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={styles.errorBanner}
        >
          <MaterialCommunityIcons
            name="cloud-alert-outline"
            color={palette.danger}
            size={20}
          />
          <Text style={styles.errorText}>{error}</Text>
          <MaterialCommunityIcons
            name="refresh"
            color={palette.danger}
            size={16}
          />
        </Pressable>
      ) : null}

      <Animated.View style={sectionsStyle}>
        {canViewDashboard ? (
          loading ? (
            <>
              <SectionHeading
                title="At a glance"
                action=""
                onPress={() => {}}
                disabled
              />
              <View style={styles.grid}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            </>
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
                  tint={palette.primary}
                  bg={palette.primarySoft}
                />
                <Metric
                  label="Staff"
                  value={dashboard.employees ?? 0}
                  icon="briefcase-outline"
                  tint={palette.info}
                  bg={palette.infoSoft}
                />
                <Metric
                  label="Attendance"
                  value={`${dashboard.attendancePercentage ?? 0}%`}
                  icon="calendar-check-outline"
                  tint={palette.success}
                  bg={palette.successSoft}
                  onPress={() =>
                    navigation.navigate("HomeTabs", { screen: "Attendance" })
                  }
                  ring
                />
                <Metric
                  label="Outstanding"
                  value={`Rs ${Number(dashboard.fees?.outstanding ?? 0).toLocaleString()}`}
                  icon="cash-multiple"
                  tint={palette.warning}
                  bg={palette.warningSoft}
                  onPress={() =>
                    navigation.navigate("HomeTabs", { screen: "More" })
                  }
                />
              </View>
            </>
          )
        ) : (
          <>
            <SectionHeading
              title="Jump into"
              action="See all"
              onPress={() =>
                navigation.navigate("HomeTabs", { screen: "More" })
              }
            />
            {loading ? (
              <View style={styles.tileGrid}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.tile}>
                    <Skeleton width={52} height={52} radius={16} />
                    <Skeleton
                      width="70%"
                      height={10}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.tileGrid}>
                {studentQuickActions.map((action) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.tile,
                      pressed && styles.pressedTile,
                    ]}
                  >
                    <View
                      style={[styles.tileIcon, { backgroundColor: action.bg }]}
                    >
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
            )}

            <Pressable
              onPress={() => navigation.navigate("Updates")}
              style={({ pressed }) => [
                styles.tip,
                pressed && styles.pressedSoft,
              ]}
            >
              <View style={styles.tipIcon}>
                <MaterialCommunityIcons
                  name="lightbulb-on"
                  color={palette.warning}
                  size={22}
                />
              </View>
              <View style={styles.tipCopy}>
                <Text style={styles.tipLabel}>Daily tip</Text>
                <Text style={styles.tipText}>{tipCopy}</Text>
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                color={palette.warning}
                size={17}
              />
            </Pressable>
          </>
        )}

        {canViewDashboard && workflowActions.length ? (
          <>
            <SectionHeading
              title="Today's workflow"
              action="Open tools"
              onPress={() =>
                navigation.navigate("HomeTabs", { screen: "More" })
              }
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

        {/* Notices */}
        <SectionHeading
          title="Latest notices"
          action="See all"
          onPress={() => navigation.navigate("Updates")}
        />
        {loading ? (
          <>
            <Skeleton
              width="100%"
              height={100}
              radius={18}
              style={{ marginTop: 10 }}
            />
            <Skeleton
              width="100%"
              height={100}
              radius={18}
              style={{ marginTop: 10 }}
            />
          </>
        ) : notices.length ? (
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
                  {notice.publishAt
                    ? ` · ${relativeDay(notice.publishAt)}`
                    : ""}
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
              {notice.authorName ? (
                <View style={styles.noticeAuthorRow}>
                  <MaterialCommunityIcons
                    name="account-circle-outline"
                    color={palette.muted}
                    size={12}
                  />
                  <Text style={styles.noticeAuthor}>{notice.authorName}</Text>
                </View>
              ) : null}
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="bullhorn-outline"
                color="#a78bfa"
                size={22}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No notices yet</Text>
              <Text style={styles.emptyText}>
                Check back soon for updates from school.
              </Text>
            </View>
          </View>
        )}

        {/* Events */}
        <SectionHeading
          title="Coming up"
          action="Calendar"
          onPress={() => navigation.navigate("Updates")}
        />
        {loading ? (
          <Skeleton
            width="100%"
            height={74}
            radius={18}
            style={{ marginTop: 10 }}
          />
        ) : events.length ? (
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
                    color={palette.muted}
                    size={12}
                  />
                  <Text style={styles.eventMeta}>
                    {relativeDay(event.startDate)} ·{" "}
                    {event.startTime ?? "All day"}
                    {event.venue ? ` · ${event.venue}` : ""}
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
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="calendar-blank-outline"
                color="#a78bfa"
                size={22}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.emptyText}>
                Enjoy the calm — you have no upcoming events. ☀️
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

/* ---------- subcomponents ---------- */
function SectionHeading({
  title,
  action,
  onPress,
  disabled,
}: {
  title: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {!disabled && action ? (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  onPress,
  tint = palette.primary,
  bg = palette.primarySoft,
  ring,
}: {
  label: string;
  value: string | number;
  icon: IconName;
  onPress?: () => void;
  tint?: string;
  bg?: string;
  ring?: boolean;
}) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^\d.]/g, "")) || 0;
  const animated = useCountUp(numeric);
  const display =
    typeof value === "number"
      ? animated
      : String(value).replace(/\d+/, String(animated));

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && styles.pressedSoft,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: bg }]}>
          {ring && typeof value === "string" && value.endsWith("%") ? (
            <View style={[styles.ring, { borderColor: bg }]}>
              <View
                style={[
                  styles.ringProgress,
                  {
                    borderColor: tint,
                    borderTopColor: numeric >= 25 ? tint : "transparent",
                    borderRightColor: numeric >= 50 ? tint : "transparent",
                    borderBottomColor: numeric >= 75 ? tint : "transparent",
                    borderLeftColor: numeric >= 100 ? tint : "transparent",
                  },
                ]}
              />
              <MaterialCommunityIcons name={icon} color={tint} size={16} />
            </View>
          ) : (
            <MaterialCommunityIcons name={icon} color={tint} size={20} />
          )}
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
      <Text style={styles.cardValue}>{display}</Text>
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
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      style={({ pressed }) => [styles.quick, pressed && styles.pressedSoft]}
    >
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons name={icon} color={palette.primary} size={22} />
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

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { backgroundColor: palette.bg, padding: 18, paddingBottom: 48 },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  brandMark: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 13,
    height: 40,
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 40,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  date: { color: palette.muted, fontSize: 11, fontWeight: "600", marginTop: 3 },
  topActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  avatar: {
    alignItems: "center",
    backgroundColor: "#ede9fe",
    borderColor: palette.primaryBorder,
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  refreshPill: {
    alignItems: "center",
    backgroundColor: palette.successSoft,
    borderRadius: 99,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshPillText: { color: palette.success, fontSize: 10, fontWeight: "800" },

  // Hero
  hero: {
    backgroundColor: "#9561e8",
    borderRadius: 24,
    overflow: "hidden",
    padding: 24,
    shadowColor: "#9561e8",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
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

  // Error
  errorBanner: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 18,
    padding: 14,
  },
  errorText: {
    color: palette.danger,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Section heading
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 26,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionAction: { color: palette.primary, fontSize: 12, fontWeight: "800" },

  // Metric grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 12 },
  card: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    padding: 15,
    shadowColor: palette.primary,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
  },
  cardValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  ring: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 3,
    height: 34,
    justifyContent: "center",
    position: "relative",
    width: 34,
  },
  ringProgress: {
    borderRadius: 20,
    borderWidth: 3,
    height: 34,
    position: "absolute",
    width: 34,
  },

  // Student tiles
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 12 },
  tile: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 100,
    paddingHorizontal: 10,
    paddingVertical: 18,
    shadowColor: palette.primary,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    marginBottom: 10,
    width: 52,
  },
  tileLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  // Tip
  tip: {
    alignItems: "center",
    backgroundColor: palette.warningSoft,
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
    color: palette.warning,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 3,
  },

  // Quick rows
  quickGrid: { gap: 10, marginTop: 12 },
  quick: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    padding: 13,
    shadowColor: palette.primary,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  quickIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  quickCopy: { flex: 1, marginLeft: 12 },
  quickLabel: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  quickDescription: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  // Notices
  noticeCard: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    padding: 15,
    shadowColor: palette.primary,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  noticeUrgent: { backgroundColor: "#fff7f8", borderColor: "#fecdd3" },
  noticeTop: { alignItems: "center", flexDirection: "row", gap: 7 },
  noticeDot: { borderRadius: 4, height: 8, width: 8 },
  dotViolet: { backgroundColor: palette.primary },
  dotAmber: { backgroundColor: palette.warning },
  dotRose: { backgroundColor: palette.danger },
  noticeDate: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  urgentTag: {
    backgroundColor: palette.danger,
    borderRadius: 6,
    marginLeft: "auto",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  urgentTagText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  noticeTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 9,
  },
  noticeBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  noticeAuthorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  noticeAuthor: { color: palette.muted, fontSize: 10, fontWeight: "700" },

  // Events
  eventRow: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 12,
    shadowColor: palette.primary,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  eventDate: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  eventDay: {
    color: palette.primaryDeep,
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
  eventTitle: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  eventMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 5,
  },
  eventMeta: { color: palette.muted, fontSize: 11, fontWeight: "600" },

  // Empty
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 16,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  emptyTitle: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  emptyText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },

  // Press
  pressedSoft: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  pressedTile: {
    backgroundColor: "#faf5ff",
    borderColor: palette.primaryBorder,
    transform: [{ scale: 0.96 }],
  },
});
