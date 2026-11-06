import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const colors = {
  ink: "#1e1b4b",
  muted: "#64748b",
  border: "#e2e8f0",
  warning: "#d97706",
  warningSoft: "#fffbeb",
  warningBorder: "#fde68a",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
  dangerBorder: "#fecdd3",
};

export function ConfirmActionDialog({
  visible,
  title,
  message,
  consequence,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "warning",
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  consequence: string;
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = tone === "danger";
  const close = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cancel action" disabled={busy} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.card}>
          <View style={[styles.icon, { backgroundColor: danger ? colors.dangerSoft : colors.warningSoft }]}>
            <MaterialCommunityIcons name="alert-outline" color={danger ? colors.danger : colors.warning} size={26} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {details}
          <View style={[styles.alert, { backgroundColor: danger ? colors.dangerSoft : colors.warningSoft, borderColor: danger ? colors.dangerBorder : colors.warningBorder }]}>
            <MaterialCommunityIcons name="alert-circle-outline" color={danger ? colors.danger : colors.warning} size={19} />
            <Text style={[styles.alertText, { color: danger ? colors.danger : colors.warning }]}>{consequence}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onConfirm} style={({ pressed }) => [styles.button, { backgroundColor: danger ? colors.danger : colors.warning }, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.55)", flex: 1, justifyContent: "center", padding: 22 },
  card: { backgroundColor: "#fff", borderRadius: 24, elevation: 8, gap: 12, maxWidth: 440, padding: 22, shadowColor: "#000", shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.2, shadowRadius: 24, width: "100%" },
  icon: { alignItems: "center", borderRadius: 15, height: 48, justifyContent: "center", width: 48 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  alert: { alignItems: "flex-start", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 9, padding: 12 },
  alertText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  button: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 },
  cancel: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1 },
  cancelText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  pressed: { opacity: 0.82 },
});