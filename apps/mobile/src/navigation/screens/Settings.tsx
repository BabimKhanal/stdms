import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EduApiClient } from "@edu/api-client";
import { mobileToken, useAuth } from "../../auth";
import { API_URL } from "../../config";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import {
  disablePushNotifications,
  enablePushNotifications,
  readPushPreference,
  type PushPreference,
} from "../../lib/push-notifications";
import { setAppLocale, useAppLocale } from "../../lib/locale";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const palette = {
  primary: "#7c3aed",
  primaryDeep: "#6d28d9",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
  success: "#059669",
  successSoft: "#ecfdf5",
};

/* ---------- Section wrapper ---------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/* ---------- Detail row ---------- */
function Detail({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detail, !last && styles.detailBordered]}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} color={palette.primary} size={18} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Tappable detail row ---------- */
function DetailAction({
  icon,
  label,
  value,
  onPress,
  tint = palette.primary,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.detail,
        styles.detailBordered,
        pressed && styles.detailPressed,
      ]}
    >
      <View style={[styles.detailIcon, { backgroundColor: `${tint}14` }]}>
        <MaterialCommunityIcons name={icon} color={tint} size={18} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" color={palette.muted} size={18} />
    </Pressable>
  );
}

export function Settings() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const roles = user?.roles?.length ? user.roles.join(" · ") : "Member";
  const [showPassword, setShowPassword] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [pushPreference, setPushPreference] = useState<PushPreference>({
    supported: Platform.OS === "ios" || Platform.OS === "android",
    enabled: false,
    permission: "not-determined",
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const locale = useAppLocale();

  useEffect(() => {
    let active = true;
    void readPushPreference().then((preference) => {
      if (active) setPushPreference(preference);
    });
    return () => {
      active = false;
    };
  }, []);

  async function setPushEnabled(enabled: boolean) {
    const token = await mobileToken();
    if (!token) {
      setPushError("Your session has expired. Please sign in again.");
      return;
    }
    setPushBusy(true);
    setPushError("");
    try {
      if (enabled) await enablePushNotifications(token);
      else await disablePushNotifications(token);
      setPushPreference(await readPushPreference());
    } catch (error) {
      setPushError(
        error instanceof Error
          ? error.message
          : "Unable to update notifications.",
      );
      setPushPreference(await readPushPreference());
    } finally {
      setPushBusy(false);
    }
  }

  function closePassword() {
    setShowPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  }

  async function changePassword() {
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      await new EduApiClient(API_URL, () => token).post(
        "/auth/change-password",
        { currentPassword, newPassword },
      );
      closePassword();
      if (Platform.OS === "web") {
        setShowSignOut(true);
      } else {
        Alert.alert(
          "Password changed",
          "For security, please sign in again with your new password.",
          [{ text: "OK", onPress: () => void signOut() }],
        );
      }
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to change your password",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function confirmSignOut() {
    if (Platform.OS === "web") {
      setShowSignOut(true);
      return;
    }
    Alert.alert(
      "Sign out?",
      "You'll need to sign in again to access your classes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ],
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 28, paddingTop: insets.top + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={styles.hero}>
        <View style={styles.heroBlob} />
        <View style={styles.heroBlobSmall} />
        <View style={styles.heroContent}>
          <ProfileAvatar name={user?.name} size={72} uri={user?.avatarUrl} style={styles.heroAvatar} />
          <Text style={styles.heroName}>{user?.name ?? "User"}</Text>
          <Text style={styles.heroOrg}>{user?.orgName ?? "Nucleus Education"}</Text>
          <View style={styles.heroRoleRow}>
            {user?.roles?.map((role) => (
              <View key={role} style={styles.heroRolePill}>
                <Text style={styles.heroRoleText}>{role}</Text>
              </View>
            )).slice(0, 3)}
          </View>
        </View>
      </View>

      {/* Security notice */}
      {user?.mustChangePassword ? (
        <Pressable
          onPress={() => setShowPassword(true)}
          style={({ pressed }) => [
            styles.noticeCard,
            pressed && styles.noticePressed,
          ]}
        >
          <View style={styles.noticeIcon}>
            <MaterialCommunityIcons name="shield-alert-outline" color={palette.warn} size={20} />
          </View>
          <Text style={styles.noticeText}>
            You&apos;re using a temporary password. Please change it now.
          </Text>
          <MaterialCommunityIcons name="chevron-right" color={palette.warn} size={18} />
        </Pressable>
      ) : null}

      {/* Preferences */}
      <Section title="Preferences">
        <View style={styles.detail}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons name="translate" color={palette.primary} size={18} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Date language</Text>
            <Text style={styles.detailValue}>
              {locale === "ne" ? "नेपाली calendar dates" : "English calendar dates"}
            </Text>
          </View>
        </View>
        <View style={styles.localeActions}>
          <Pressable
            onPress={() => void setAppLocale("en")}
            style={[styles.localeButton, locale === "en" && styles.localeButtonActive]}
          >
            <Text style={[styles.localeButtonText, locale === "en" && styles.localeButtonTextActive]}>English</Text>
          </Pressable>
          <Pressable
            onPress={() => void setAppLocale("ne")}
            style={[styles.localeButton, locale === "ne" && styles.localeButtonActive]}
          >
            <Text style={[styles.localeButtonText, locale === "ne" && styles.localeButtonTextActive]}>नेपाली</Text>
          </Pressable>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.notificationRow}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons name="bell-outline" color={palette.primary} size={18} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>School updates</Text>
            <Text style={styles.detailValue}>
              {!pushPreference.supported
                ? "Available in the iOS or Android app"
                : pushPreference.enabled
                  ? "Push notifications are on"
                  : pushPreference.permission === "denied"
                    ? "Allow notifications in device settings"
                    : "Notices, attendance, and results"}
            </Text>
          </View>
          {pushBusy ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <Switch
              accessibilityLabel="School push notifications"
              disabled={!pushPreference.supported}
              value={pushPreference.enabled}
              onValueChange={(enabled) => void setPushEnabled(enabled)}
              trackColor={{ false: "#94a3b8", true: palette.primary }}
              thumbColor="#ffffff"
            />
          )}
        </View>
        {pushPreference.permission === "denied" && !pushPreference.enabled ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={styles.openSettings}
          >
            <Text style={styles.openSettingsText}>Open device settings</Text>
            <MaterialCommunityIcons name="open-in-new" color={palette.primary} size={15} />
          </Pressable>
        ) : null}
        {pushError ? (
          <Text accessibilityRole="alert" style={styles.pushError}>{pushError}</Text>
        ) : null}
      </Section>

      {/* Account */}
      <Section title="Account">
        <Detail icon="account-outline" label="Name" value={user?.name ?? "Not available"} />
        <View style={styles.detailDivider} />
        <Detail icon="email-outline" label="Email" value={user?.email ?? "Not available"} />
        <View style={styles.detailDivider} />
        <Detail icon="shield-account-outline" label="Role" value={roles} />
        <View style={styles.detailDivider} />
        <Detail icon="school-outline" label="Institution" value={user?.orgName ?? "Not available"} />
        <View style={styles.detailDivider} />
        <DetailAction
          icon="lock-reset"
          label="Password"
          value="Change password"
          onPress={() => setShowPassword(true)}
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Detail icon="cellphone" label="Application" value="Nucleus Education" />
        <View style={styles.detailDivider} />
        <Detail icon="tag-outline" label="Version" value="1.0.0" last />
        <View style={styles.detailDivider} />
        <Detail
          icon="server-network-outline"
          label="Server"
          value={API_URL.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "")}
          last
        />
      </Section>

      {/* Sign out */}
      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}
      >
        <MaterialCommunityIcons name="logout" color={palette.danger} size={20} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footer}>Nucleus Education · Secure school management</Text>

      {/* Sign-out confirmation modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showSignOut}
        onRequestClose={() => setShowSignOut(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.signOutIconWrap}>
              <MaterialCommunityIcons name="logout" color={palette.danger} size={28} />
            </View>
            <Text style={styles.signOutModalTitle}>Sign out?</Text>
            <Text style={styles.signOutModalText}>
              You&apos;ll need to sign in again to access your classes, assignments, and school updates.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowSignOut(false)}
                style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSignOut(false);
                  void signOut();
                }}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonDanger,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.modalButtonDangerText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showPassword}
        onRequestClose={closePassword}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Change password</Text>
                <Text style={styles.modalText}>
                  Use at least 8 characters. You&apos;ll be signed out afterwards.
                </Text>
              </View>
              <Pressable onPress={closePassword} hitSlop={10}>
                <MaterialCommunityIcons name="close" color={palette.inkSoft} size={20} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Current password</Text>
            <TextInput
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={palette.muted}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>New password</Text>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={palette.muted}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>Confirm new password</Text>
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat the new password"
              placeholderTextColor={palette.muted}
              style={styles.modalInput}
            />

            {passwordError ? (
              <Text style={styles.modalError}>{passwordError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closePassword}
                style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={savingPassword}
                onPress={() => void changePassword()}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (pressed || savingPassword) && { opacity: 0.85 },
                ]}
              >
                {savingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bg,
    flexGrow: 1,
    paddingHorizontal: 20,
  },

  /* ---------- Profile header ---------- */
  hero: {
    alignItems: "center",
    backgroundColor: "#9561e8",
    borderRadius: 24,
    overflow: "hidden",
    paddingBottom: 22,
    paddingTop: 28,
    position: "relative",
    shadowColor: "#9561e8",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { height: 8, width: 0 },
    elevation: 6,
  },
  heroBlob: {
    backgroundColor: "#8b5cf6",
    borderRadius: 120,
    height: 200,
    opacity: 0.3,
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
  },
  heroBlobSmall: {
    backgroundColor: "#c4b5fd",
    borderRadius: 60,
    height: 100,
    opacity: 0.18,
    position: "absolute",
    left: -30,
    bottom: -30,
    width: 100,
  },
  heroContent: { alignItems: "center", position: "relative", zIndex: 1 },
  heroAvatar: {
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 36,
    borderWidth: 3,
    height: 72,
    width: 72,
  },
  heroName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 12,
    textAlign: "center",
  },
  heroOrg: {
    color: "#ddd6fe",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  heroRoleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
  },
  heroRolePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroRoleText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  /* ---------- Security notice ---------- */
  noticeCard: {
    alignItems: "center",
    backgroundColor: palette.warnSoft,
    borderColor: "#fde68a",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    padding: 14,
  },
  noticePressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  noticeIcon: {
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  noticeText: {
    color: "#92400e",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },

  /* ---------- Section ---------- */
  section: { marginTop: 26 },
  sectionLabel: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: palette.primary,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },

  /* ---------- Detail rows ---------- */
  detail: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    padding: 15,
  },
  detailBordered: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
  },
  detailPressed: { backgroundColor: palette.primarySoft },
  detailIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 11,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  detailDivider: {
    backgroundColor: palette.border,
    height: 1,
    marginLeft: 66,
  },

  /* ---------- Locale buttons ---------- */
  localeActions: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  localeButton: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  localeButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  localeButtonText: { color: palette.inkSoft, fontSize: 13, fontWeight: "700" },
  localeButtonTextActive: { color: "#fff" },

  /* ---------- Notification row ---------- */
  notificationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  pushError: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 17,
    paddingBottom: 14,
    paddingHorizontal: 15,
  },
  openSettings: {
    alignItems: "center",
    borderTopColor: palette.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end",
    padding: 14,
  },
  openSettingsText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  /* ---------- Sign out ---------- */
  signOutButton: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 32,
    minHeight: 54,
  },
  signOutPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  signOutText: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: "800",
  },

  /* ---------- Footer ---------- */
  footer: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 22,
    marginBottom: 4,
    textAlign: "center",
    fontWeight: "500",
  },

  /* ---------- Modal shared ---------- */
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    maxWidth: 460,
    padding: 22,
    width: "100%",
  },

  /* ---------- Sign-out modal ---------- */
  signOutIconWrap: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderRadius: 18,
    height: 56,
    justifyContent: "center",
    marginBottom: 16,
    width: 56,
  },
  signOutModalTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  signOutModalText: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },

  /* ---------- Password modal ---------- */
  modalHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  modalText: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  modalLabel: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
  },
  modalInput: {
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  modalError: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 20,
  },
  modalButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 16,
  },
  modalButtonPrimary: { backgroundColor: palette.primary },
  modalButtonDanger: { backgroundColor: palette.danger },
  modalButtonText: { color: palette.inkSoft, fontSize: 13, fontWeight: "800" },
  modalButtonPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  modalButtonDangerText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
