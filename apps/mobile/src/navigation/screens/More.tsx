import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth";

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

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function More() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const canViewFees = Boolean(
    user?.isPlatformAdmin ||
    user?.permissions?.some(
      (item) => item === "invoice.view" || item === "fee.view",
    ),
  );
  const canViewResults = Boolean(
    user?.isPlatformAdmin || user?.permissions?.includes("result.view"),
  );
  const canRequestLeave = Boolean(
    user?.studentId &&
      (user?.isPlatformAdmin || user?.permissions?.includes("leave.create")),
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.eyebrow}>{user?.orgName ?? "Nucleus"}</Text>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>
        Your account, results, and school tools.
      </Text>

      {/* Profile hero card */}
      <Pressable
        onPress={() =>
          navigation.navigate("Profile", { user: user?.name ?? "user" })
        }
        style={({ pressed }) => [
          styles.profileCard,
          pressed && styles.pressedProfile,
        ]}
      >
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>
            {user?.name?.charAt(0) ?? "U"}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{user?.name ?? "User"}</Text>
          <Text style={styles.profileMeta}>
            {user?.roles?.join(" · ") ?? "Member"}
          </Text>
        </View>
        <View style={styles.profileChevron}>
          <MaterialCommunityIcons name="chevron-right" color="#fff" size={18} />
        </View>
      </Pressable>

      {/* School tools */}
      <SectionLabel>School tools</SectionLabel>
      <View style={styles.list}>
        <Action
          icon="bell-outline"
          tint="#7c3aed"
          bg="#f5f3ff"
          title="Updates"
          description="Notices, grades, and live school activity"
          onPress={() => navigation.navigate("Updates")}
        />
        {canViewResults ? (
          <Action
            icon="chart-line"
            tint="#2563eb"
            bg="#eff6ff"
            title="Results"
            description="Examinations and published scores"
            onPress={() => navigation.navigate("Results")}
          />
        ) : null}
        {canViewFees ? (
          <Action
            icon="wallet-outline"
            tint="#d97706"
            bg="#fffbeb"
            title="Fees"
            description="Invoices and outstanding balances"
            onPress={() => navigation.navigate("Fees")}
          />
        ) : null}
        {canRequestLeave ? (
          <Action
            icon="calendar-remove-outline"
            tint="#db2777"
            bg="#fdf2f8"
            title="Leave requests"
            description="Apply for leave and track approvals"
            onPress={() => navigation.navigate("Leave")}
          />
        ) : null}
        <Action
          icon="account-circle-outline"
          tint="#059669"
          bg="#ecfdf5"
          title="Profile"
          description="Personal details and family contacts"
          onPress={() =>
            navigation.navigate("Profile", { user: user?.name ?? "user" })
          }
        />
        <Action
          icon="cog-outline"
          tint="#0891b2"
          bg="#ecfeff"
          title="Settings"
          description="Session and app preferences"
          onPress={() => navigation.navigate("Settings")}
        />
      </View>

      {/* Account */}
      <SectionLabel>Account</SectionLabel>
      <View style={styles.list}>
        <Action
          icon="logout"
          tint={palette.danger}
          bg={palette.dangerSoft}
          title="Sign out"
          description="End this mobile session"
          danger
          onPress={() => void signOut()}
        />
      </View>
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Action({
  icon,
  tint = palette.primary,
  bg = palette.primarySoft,
  title,
  description,
  onPress,
  danger = false,
}: {
  icon: IconName;
  tint?: string;
  bg?: string;
  title: string;
  description: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed && (danger ? styles.pressedDanger : styles.pressed),
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} color={tint} size={22} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && { color: palette.danger }]}>
          {title}
        </Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" color="#cbd5e1" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.bg, padding: 20, paddingBottom: 80 },

  eyebrow: {
    color: "#5b21b6",
    fontSize: 13,
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

  // Profile hero
  profileCard: {
    alignItems: "center",
    backgroundColor: "#5b21b6",
    borderRadius: 22,
    flexDirection: "row",
    marginTop: 22,
    overflow: "hidden",
    padding: 16,
    shadowColor: "#5b21b6",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { height: 6, width: 0 },
    elevation: 4,
  },
  pressedProfile: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  profileAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  profileInitial: { color: "#fff", fontSize: 20, fontWeight: "800" },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  profileMeta: {
    color: "#ddd6fe",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  profileChevron: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },

  // Sections
  sectionLabel: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 26,
    textTransform: "uppercase",
  },
  list: { gap: 10 },

  // Action rows
  action: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 62,
    padding: 14,
    shadowColor: palette.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { height: 3, width: 0 },
    elevation: 1,
  },
  pressed: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    transform: [{ scale: 0.99 }],
  },
  pressedDanger: {
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    transform: [{ scale: 0.99 }],
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  actionCopy: { flex: 1, marginLeft: 13 },
  actionTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  actionDescription: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: "500",
  },

});
