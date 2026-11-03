import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useState } from "react";

export function ProfileAvatar({
  name,
  uri,
  size = 42,
  style,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name?.trim().charAt(0).toUpperCase() || "U";
  const radius = size / 2;

  return (
    <View style={[styles.root, { borderRadius: radius, height: size, width: size }, style]}>
      {uri && !failed ? (
        <Image
          accessibilityLabel={`${name ?? "User"} profile photo`}
          onError={() => setFailed(true)}
          source={{ uri }}
          style={{ borderRadius: radius, height: size, width: size }}
        />
      ) : (
        <View style={[styles.fallback, { borderRadius: radius, height: size, width: size }]}>
          <Text style={[styles.initial, { fontSize: Math.max(14, size * 0.38) }]}>{initial}</Text>
        </View>
      )}
      {uri && failed ? (
        <MaterialCommunityIcons name="account-circle" color="#a78bfa" size={size * 0.72} style={styles.failedIcon} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#ede9fe", overflow: "hidden" },
  fallback: { alignItems: "center", backgroundColor: "#ede9fe", justifyContent: "center" },
  initial: { color: "#6d28d9", fontWeight: "800" },
  failedIcon: { left: "14%", position: "absolute", top: "14%" },
});
