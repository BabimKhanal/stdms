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
import { EduApiClient } from "@edu/api-client";
import { mobileToken, useAuth } from "../../auth";
import { API_URL } from "../../config";
import {
  disablePushNotifications,
  enablePushNotifications,
  readPushPreference,
  type PushPreference,
} from "../../lib/push-notifications";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const palette = {
  primary: "#7c3aed",
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
};

function Detail({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} color={palette.primary} size={19} />
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

export function Settings() {
  const { user, signOut } = useAuth();
  const roles = user?.roles?.length ? user.roles.join(" · ") : "Member";
  const [showPassword, setShowPassword] = useState(false);
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
        // RN Web does not implement Alert — sign out straight away.
        void signOut();
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

  const confirmSignOut = () => {
    if (Platform.OS === "web") {
      void signOut();
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
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Your account and app information.</Text>

      {user?.mustChangePassword ? (
        <Pressable
          onPress={() => setShowPassword(true)}
          style={styles.noticeCard}
        >
          <MaterialCommunityIcons
            name="shield-alert-outline"
            color={palette.warn}
            size={20}
          />
          <Text style={styles.noticeText}>
            You&apos;re using a temporary password. Please change it now.
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            color={palette.warn}
            size={18}
          />
        </Pressable>
      ) : null}

      {/* Account Section */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <Detail
          icon="account-outline"
          label="Name"
          value={user?.name ?? "Not available"}
        />
        <View style={styles.divider} />
        <Detail
          icon="email-outline"
          label="Email"
          value={user?.email ?? "Not available"}
        />
        <View style={styles.divider} />
        <Detail icon="shield-account-outline" label="Role" value={roles} />
        <View style={styles.divider} />
        <Detail
          icon="school-outline"
          label="Institution"
          value={user?.orgName ?? "Not available"}
        />
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPassword(true)}
          style={({ pressed }) => [
            styles.detail,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons
              name="lock-reset"
              color={palette.primary}
              size={19}
            />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Password</Text>
            <Text style={styles.detailValue}>Change password</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            color="#64748b"
            size={20}
          />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.notificationRow}>
          <View style={styles.detailIcon}>
            <MaterialCommunityIcons
              name="bell-outline"
              color={palette.primary}
              size={19}
            />
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
            <MaterialCommunityIcons
              name="open-in-new"
              color={palette.primary}
              size={15}
            />
          </Pressable>
        ) : null}
        {pushError ? (
          <Text accessibilityRole="alert" style={styles.pushError}>
            {pushError}
          </Text>
        ) : null}
      </View>

      {/* App Section */}
      <Text style={styles.sectionLabel}>App info</Text>
      <View style={styles.card}>
        <Detail
          icon="cellphone"
          label="Application"
          value="Nucleus Education"
        />
        <View style={styles.divider} />
        <Detail icon="tag-outline" label="Version" value="1.0.0" />
        <View style={styles.divider} />
        <Detail
          icon="server-network-outline"
          label="Server"
          value={API_URL.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "")}
        />
      </View>

      {/* Danger Zone */}
      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <MaterialCommunityIcons
          name="logout"
          color={palette.danger}
          size={20}
        />
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footer}>
        Nucleus Education · Secure school management
      </Text>

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
                  Use at least 8 characters. You&apos;ll be signed out
                  afterwards.
                </Text>
              </View>
              <Pressable onPress={closePassword} hitSlop={10}>
                <MaterialCommunityIcons
                  name="close"
                  color={palette.inkSoft}
                  size={20}
                />
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
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && { opacity: 0.8 },
                ]}
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
    padding: 24,
    paddingBottom: 120, // Clears the bottom tab bar safely
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    fontWeight: "500",
  },
  sectionLabel: {
    color: palette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 28,
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
  detail: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  notificationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pushError: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 17,
    paddingBottom: 14,
    paddingHorizontal: 16,
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
  detailIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  divider: {
    backgroundColor: palette.border,
    height: 1,
    marginLeft: 70, // Aligns perfectly with the text, skipping the icon
  },
  button: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 32,
    minHeight: 56,
    padding: 16,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 24,
    textAlign: "center",
    fontWeight: "500",
  },
  noticeCard: {
    alignItems: "center",
    backgroundColor: palette.warnSoft,
    borderColor: "#fde68a",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    padding: 13,
  },
  noticeText: {
    color: "#92400e",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
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
    padding: 20,
    width: "100%",
  },
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
  modalButtonText: { color: palette.inkSoft, fontSize: 13, fontWeight: "800" },
  modalButtonPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
