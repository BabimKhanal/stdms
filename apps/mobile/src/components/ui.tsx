import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export type MobileIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const mobileTheme = {
  colors: {
    primary: "#7c3aed",
    primarySoft: "#f5f3ff",
    primaryBorder: "#ddd6fe",
    background: "#f8fafc",
    surface: "#ffffff",
    ink: "#1e1b4b",
    inkSoft: "#334155",
    muted: "#64748b",
    border: "#e2e8f0",
    danger: "#e11d48",
    dangerSoft: "#fff1f2",
  },
  minTouchSize: 48,
} as const;

export function ActionRow({
  icon,
  title,
  description,
  onPress,
  tint = mobileTheme.colors.primary,
  background = mobileTheme.colors.primarySoft,
  danger = false,
  trailing,
  disabled = false,
  style,
}: {
  icon: MobileIconName;
  title: string;
  description?: string;
  onPress: () => void;
  tint?: string;
  background?: string;
  danger?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger && styles.actionDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: background }]}>
        <MaterialCommunityIcons name={icon} color={tint} size={24} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && { color: mobileTheme.colors.danger }]}>{title}</Text>
        {description ? <Text style={styles.actionDescription}>{description}</Text> : null}
      </View>
      {trailing ?? <MaterialCommunityIcons name="chevron-right" color={mobileTheme.colors.muted} size={24} />}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: MobileIconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} color={mobileTheme.colors.primary} size={30} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: "center", backgroundColor: mobileTheme.colors.surface, borderColor: mobileTheme.colors.border, borderRadius: 18, borderWidth: 1, flexDirection: "row", minHeight: 76, padding: 14 },
  actionDanger: { borderColor: "#fecdd3" },
  actionIcon: { alignItems: "center", borderRadius: 14, height: 50, justifyContent: "center", width: 50 },
  actionCopy: { flex: 1, marginHorizontal: 14 },
  actionTitle: { color: mobileTheme.colors.ink, fontSize: 16, fontWeight: "800" },
  actionDescription: { color: mobileTheme.colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 3 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  empty: { alignItems: "center", backgroundColor: mobileTheme.colors.surface, borderColor: mobileTheme.colors.border, borderRadius: 22, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 32 },
  emptyIcon: { alignItems: "center", backgroundColor: mobileTheme.colors.primarySoft, borderRadius: 22, height: 64, justifyContent: "center", width: 64 },
  emptyTitle: { color: mobileTheme.colors.ink, fontSize: 18, fontWeight: "800", marginTop: 14, textAlign: "center" },
  emptyDescription: { color: mobileTheme.colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" },
  emptyAction: { alignItems: "center", backgroundColor: mobileTheme.colors.primary, borderRadius: 14, justifyContent: "center", marginTop: 18, minHeight: mobileTheme.minTouchSize, paddingHorizontal: 20 },
  emptyActionText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});