import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const palette = {
  primary: "#7c3aed",
  bg: "#faf9ff",
  ink: "#1e1b4b",
  inkSoft: "#475569",
  muted: "#94a3b8",
  warn: "#d97706",
  warnSoft: "#fffbeb",
};

export function OfflineBanner({
  online,
  checking,
  onRetry,
}: {
  online: boolean;
  checking?: boolean;
  onRetry: () => void;
}) {
  if (online) return null;
  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons
        name="cloud-off-outline"
        color={palette.warn}
        size={16}
      />
      <Text style={styles.text}>
        You appear to be offline. Some updates may not sync until you reconnect.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={checking}
        onPress={onRetry}
        style={styles.retry}
      >
        {checking ? (
          <ActivityIndicator color={palette.warn} size="small" />
        ) : (
          <Text style={styles.retryText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: palette.warnSoft,
    borderColor: "#fde68a",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    color: "#92400e",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  retry: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    padding: 4,
  },
  retryText: { color: palette.warn, fontSize: 12, fontWeight: "800" },
});
