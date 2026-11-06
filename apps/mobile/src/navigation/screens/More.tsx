import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import { ActionRow, ConfirmActionDialog } from "../../components";

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
};

export function More() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); }
    finally { setSigningOut(false); setConfirmSignOut(false); }
  }

  const canViewFees = Boolean(
    user?.isPlatformAdmin ||
      user?.permissions?.includes("invoice.view"),
  );
  const canViewResults = Boolean(
    user?.isPlatformAdmin ||
      (user?.permissions?.includes("result.view") &&
        user?.permissions?.includes("exam.view")),
  );
  const canRequestLeave = Boolean(
    user?.studentId &&
      (user?.isPlatformAdmin || user?.permissions?.includes("leave.create")),
  );
  const canViewCalendar = Boolean(
    user?.isPlatformAdmin || user?.permissions?.includes("event.view"),
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 12 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.eyebrow}>{user?.orgName ?? "Nucleus"}</Text>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>
        Find school tools, your profile, and help in one place.
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
          <ProfileAvatar name={user?.name} size={48} uri={user?.avatarUrl} style={styles.profileAvatar} />
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
      <SectionLabel>Learn and plan</SectionLabel>
      <View style={styles.list}>
        <ActionRow
          icon="bell-outline"
          tint="#7c3aed"
          background="#f5f3ff"
          title="Updates"
          description="Read messages and news from school"
          onPress={() => navigation.navigate("Updates")}
        />
        {canViewResults ? (
            <ActionRow
            icon="chart-line"
            tint="#2563eb"
              background="#eff6ff"
            title="Results"
              description="See your marks and teacher feedback"
            onPress={() => navigation.navigate("Results")}
          />
        ) : null}
        {canViewFees ? (
            <ActionRow
            icon="wallet-outline"
            tint="#d97706"
            background="#fffbeb"
            title="Fees"
              description="See payments and money still due"
            onPress={() => navigation.navigate("Fees")}
          />
        ) : null}
        {canRequestLeave ? (
            <ActionRow
            icon="calendar-remove-outline"
            tint="#db2777"
            background="#fdf2f8"
            title="Leave requests"
              description="Ask for time away from school"
            onPress={() => navigation.navigate("Leave")}
          />
        ) : null}
        {canViewCalendar ? (
            <ActionRow
            icon="calendar-month-outline"
            tint="#2563eb"
            background="#eff6ff"
            title="Calendar"
              description="See holidays, exams, and special days"
            onPress={() => navigation.navigate("Calendar")}
          />
        ) : null}
        {user?.studentId ? (
            <ActionRow
            icon="folder-account-outline"
            tint="#7c3aed"
            background="#f5f3ff"
            title="My documents"
              description="Open ID cards, reports, and certificates"
            onPress={() => navigation.navigate("Documents")}
          />
        ) : null}
        <ActionRow
          icon="account-circle-outline"
          tint="#059669"
          background="#ecfdf5"
          title="Profile"
          description="See your details and family contacts"
          onPress={() =>
            navigation.navigate("Profile", { user: user?.name ?? "user" })
          }
        />
        <ActionRow
          icon="cog-outline"
          tint="#0891b2"
          background="#ecfeff"
          title="Settings"
          description="Change language, notifications, and password"
          onPress={() => navigation.navigate("Settings")}
        />
      </View>

      {/* Account */}
      <SectionLabel>Account</SectionLabel>
      <View style={styles.list}>
        <ActionRow
          icon="logout"
          tint={palette.danger}
          background={palette.dangerSoft}
          title="Sign out"
          description="Leave your account safely"
          danger
           onPress={() => setConfirmSignOut(true)}
        />
      </View>
       <ConfirmActionDialog
         visible={confirmSignOut}
         title="Sign out?"
         message="You’ll need to sign in again to access your classes, assignments, and school updates."
         consequence="This ends the current mobile session and unregisters this device from account notifications."
         confirmLabel="Sign out"
         tone="danger"
         busy={signingOut}
         onCancel={() => setConfirmSignOut(false)}
         onConfirm={() => void handleSignOut()}
       />
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
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
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: "#fff", fontSize: 17, fontWeight: "800" },
  profileMeta: {
    color: "#ddd6fe",
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 26,
    textTransform: "uppercase",
  },
  list: { gap: 10 },
});
