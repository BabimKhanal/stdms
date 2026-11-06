import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
};

export function NotFound() {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="compass-off-outline" color={palette.primary} size={40} />
      </View>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.subtitle}>
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate("HomeTabs")} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <MaterialCommunityIcons name="home-outline" color="#fff" size={18} />
        <Text style={styles.buttonText}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: palette.bg,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 28,
    borderWidth: 1,
    height: 88,
    justifyContent: "center",
    marginBottom: 8,
    width: 88,
  },
  code: {
    color: palette.primary,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1,
  },
  title: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 24,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 3,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
