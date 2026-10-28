import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_URL } from "../../config";
import { mobileToken } from "../../auth";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#faf9ff",
  ink: "#1e1b4b",
  inkSoft: "#475569",
  muted: "#94a3b8",
  border: "#f1f0f9",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
};

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0)
    return new Date(value).toLocaleDateString();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });
}

export function Updates() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await mobileToken();
      if (!token)
        throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error("Unable to load your updates right now.");
      const payload = (await response.json()) as { data?: Notification[] };
      setItems(payload.data ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your updates right now.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let active = true;
    void (async () => {
      const token = await mobileToken();
      if (!active) return;
      await load();
      if (!token || !active) return;
      socket = new WebSocket(
        `${API_URL.replace(/^http/, "ws").replace(/\/api\/v1$/, "")}/ws/notifications?token=${encodeURIComponent(token)}`,
      );
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type: string;
            data?: Notification;
          };
          if (message.type === "notification" && message.data) {
            setItems((current) => [
              message.data!,
              ...current.filter((item) => item.id !== message.data!.id),
            ]);
          }
        } catch {
          // Ignore malformed socket frames.
        }
      };
      socket.onerror = () => undefined;
    })().catch(() => undefined);
    return () => {
      active = false;
      socket?.close();
    };
  }, [load]);

  async function read(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current || current.readAt) return;
    setItems((list) =>
      list.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    const token = await mobileToken();
    if (!token) return;
    const response = await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }).catch(() => null);
    if (!response || !response.ok) {
      setItems((list) =>
        list.map((item) => (item.id === id ? { ...item, readAt: null } : item)),
      );
      setError("That update could not be marked as read.");
    }
  }

  async function markAllRead() {
    const unread = items.filter((item) => !item.readAt);
    if (!unread.length || marking) return;
    setMarking(true);
    setError("");
    const token = await mobileToken();
    if (!token) {
      setMarking(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }
    const results = await Promise.all(
      unread.map((item) =>
        fetch(`${API_URL}/notifications/${item.id}/read`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
          .then((response) => response.ok)
          .catch(() => false),
      ),
    );
    if (results.every(Boolean)) {
      setItems((list) =>
        list.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    } else {
      setError(
        "Some updates could not be marked as read. Pull down to refresh.",
      );
    }
    setMarking(false);
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>INBOX</Text>
          <Text style={styles.title}>Updates</Text>
          <Text style={styles.subtitle}>
            {unreadCount
              ? `You have ${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}.`
              : "You are all caught up! New notices will appear here."}
          </Text>
        </View>
        {unreadCount ? (
          <Pressable
            accessibilityRole="button"
            disabled={marking}
            onPress={() => void markAllRead()}
            style={({ pressed }) => [
              styles.markAll,
              pressed && styles.pressedMarkAll,
            ]}
          >
            {marking ? (
              <ActivityIndicator color={palette.primary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="check-all"
                  color={palette.primary}
                  size={16}
                />
                <Text style={styles.markAllText}>Read all</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Pressable
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={styles.errorBox}
        >
          <MaterialCommunityIcons
            name="cloud-alert-outline"
            color={palette.danger}
            size={18}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <ActivityIndicator color={palette.primary} style={styles.loader} />
      ) : items.length ? (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void read(item.id)}
            style={({ pressed }) => [
              styles.card,
              !item.readAt && styles.unread,
              pressed && styles.pressedCard,
            ]}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                {!item.readAt ? <View style={styles.unreadDot} /> : null}
                <Text
                  style={[
                    styles.cardTitle,
                    !item.readAt && styles.cardTitleUnread,
                  ]}
                >
                  {item.title}
                </Text>
              </View>
              <Text style={styles.date}>{timeAgo(item.createdAt)}</Text>
            </View>
            {item.body ? (
              <Text style={[styles.body, !item.readAt && styles.bodyUnread]}>
                {item.body}
              </Text>
            ) : null}
            {!item.readAt ? (
              <View style={styles.tapHintRow}>
                <MaterialCommunityIcons
                  name="gesture-tap"
                  color={palette.primary}
                  size={13}
                />
                <Text style={styles.tapHint}>Tap to mark as read</Text>
              </View>
            ) : null}
          </Pressable>
        ))
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons
              name="bell-sleep-outline"
              color={palette.primary}
              size={28}
            />
          </View>
          <Text style={styles.emptyTitle}>Nothing new right now</Text>
          <Text style={styles.emptyText}>
            We&apos;ll let you know when there are new notices, grades, or school
            announcements.
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
    paddingBottom: 120,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 8,
  },
  subtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    fontWeight: "500",
  },
  markAll: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressedMarkAll: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  markAllText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  errorBox: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    color: palette.danger,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  loader: { marginTop: 44 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    padding: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
    elevation: 1,
  },
  unread: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    shadowOpacity: 0.08,
  },
  pressedCard: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 7,
  },
  unreadDot: {
    backgroundColor: palette.primary,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  cardTitle: {
    color: palette.inkSoft,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  cardTitleUnread: {
    color: palette.ink,
    fontWeight: "800",
  },
  date: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  body: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  bodyUnread: {
    color: palette.inkSoft,
  },
  tapHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
  },
  tapHint: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  // Empty
  empty: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    shadowColor: palette.primary,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 20,
    height: 60,
    justifyContent: "center",
    marginBottom: 14,
    width: 60,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
});
