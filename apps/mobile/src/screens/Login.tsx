import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth";

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

export function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit =
    Boolean(identifier.trim()) && Boolean(password) && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(identifier, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero - warm welcome */}
          <View style={styles.hero}>
            <View style={styles.heroBlob} />
            <View style={styles.heroBlobSmall} />
            <View style={styles.badge}>
              <MaterialCommunityIcons name="school" color="#fff" size={28} />
            </View>
            <Text style={styles.eyebrow}>NUCLEUS EDUCATION</Text>
            <Text style={styles.title}>Welcome back! 👋</Text>
            <Text style={styles.subtitle}>
              Sign in with your school account to pick up where you left off.
            </Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <MaterialCommunityIcons
                  name="account-outline"
                  color={palette.primary}
                  size={14}
                />
                <Text style={styles.label}>School account</Text>
              </View>
              <TextInput
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                editable={!submitting}
                placeholder="Email, username or student ID"
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (error) setError("");
                }}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  color={palette.primary}
                  size={14}
                />
                <Text style={styles.label}>Password</Text>
              </View>
              <View style={styles.passwordRow}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!submitting}
                  placeholder="Enter your password"
                  placeholderTextColor={palette.muted}
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError("");
                  }}
                  onSubmitEditing={() => void submit()}
                  style={styles.passwordInput}
                />
                <Pressable
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eye}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    color={palette.muted}
                    size={21}
                  />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  color={palette.danger}
                  size={18}
                />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                !canSubmit && styles.disabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Sign in</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    color="#fff"
                    size={18}
                  />
                </>
              )}
            </Pressable>
          </View>

          {/* Friendly demo hint */}
          <View style={styles.demoCard}>
            <View style={styles.demoIcon}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                color={palette.primary}
                size={16}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoLabel}>Just exploring?</Text>
              <Text style={styles.demoText}>
                owner@greenwood.edu.np / Owner@123
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.bg, flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: "flex-start",
    backgroundColor: "#5b21b6",
    borderRadius: 28,
    marginBottom: 20,
    overflow: "hidden",
    padding: 24,
    position: "relative",
    shadowColor: "#5b21b6",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { height: 8, width: 0 },
    elevation: 6,
  },
  heroBlob: {
    backgroundColor: "#8b5cf6",
    borderRadius: 120,
    height: 200,
    opacity: 0.35,
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
  },
  heroBlobSmall: {
    backgroundColor: "#c4b5fd",
    borderRadius: 60,
    height: 100,
    opacity: 0.2,
    position: "absolute",
    left: -30,
    bottom: -40,
    width: 100,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 16,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  eyebrow: {
    color: "#ddd6fe",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 16,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36,
    marginTop: 6,
  },
  subtitle: {
    color: "#ddd6fe",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    fontWeight: "500",
  },

  // Form card
  formCard: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 22,
    shadowColor: palette.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { height: 4, width: 0 },
    elevation: 2,
  },
  field: { gap: 8 },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  label: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: palette.bg,
    borderColor: palette.primaryBorder,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    height: 54,
    paddingHorizontal: 16,
  },
  passwordRow: {
    alignItems: "center",
    backgroundColor: palette.bg,
    borderColor: palette.primaryBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 54,
  },
  passwordInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    height: "100%",
    paddingHorizontal: 16,
  },
  eye: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  // Error
  errorBox: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  error: {
    color: palette.danger,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  // Button
  button: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 54,
    justifyContent: "center",
    marginTop: 4,
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 4,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Demo hint
  demoCard: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    padding: 14,
  },
  demoIcon: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  demoLabel: { color: palette.primary, fontSize: 12, fontWeight: "800" },
  demoText: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
