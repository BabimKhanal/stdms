import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useAuth } from "../auth";

const palette = {
  primary: "#7c3aed",
  primaryDark: "#6d28d9",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
  success: "#059669",
  successSoft: "#ecfdf5",
};

/* ---------- Floating Label Input ---------- */
function FloatingField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  autoCapitalize = "none",
  rightAccessory,
  onFocus,
  onBlur,
}: {
  icon: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  returnKeyType?: "next" | "go" | "done";
  onSubmitEditing?: () => void;
  autoComplete?: any;
  autoCapitalize?: "none" | "sentences" | "words";
  rightAccessory?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  const labelAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, labelAnim]);

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused, glowAnim]);

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [17, -8],
  });
  const labelSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 11],
  });

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.primaryBorder, palette.primary],
  });

  return (
    <View style={fieldStyles.wrap}>
      <Animated.View
        style={[
          fieldStyles.container,
          {
            borderColor,
            shadowOpacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
            }),
          },
        ]}
      >
        <View style={fieldStyles.iconCol}>
          <MaterialCommunityIcons
            name={icon as any}
            color={focused ? palette.primary : palette.muted}
            size={18}
          />
        </View>

        <View style={fieldStyles.inputCol}>
          <Animated.Text
            pointerEvents="none"
            style={[
              fieldStyles.label,
              {
                top: labelTop,
                fontSize: labelSize,
                color: focused ? palette.primary : palette.inkSoft,
                backgroundColor: active ? "#fff" : "transparent",
                paddingHorizontal: active ? 4 : 0,
              },
            ]}
          >
            {label}
          </Animated.Text>

          <TextInput
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            autoCorrect={false}
            editable={editable}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            onSubmitEditing={onSubmitEditing}
            placeholder={focused ? placeholder : ""}
            placeholderTextColor={palette.muted}
            returnKeyType={returnKeyType}
            secureTextEntry={secureTextEntry}
            style={fieldStyles.input}
            value={value}
          />
        </View>

        {rightAccessory ? (
          <View style={fieldStyles.rightCol}>{rightAccessory}</View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  container: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: 14,
    shadowColor: palette.primary,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 8,
  },
  iconCol: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    width: 22,
  },
  inputCol: { flex: 1, justifyContent: "center", position: "relative" },
  label: {
    fontWeight: "700",
    letterSpacing: 0.2,
    position: "absolute",
    left: 0,
    zIndex: 1,
  },
  input: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "600",
    height: 44,
    padding: 0,
  },
  rightCol: { marginLeft: 8 },
});

/* ---------- Main Login ---------- */
export function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    Boolean(identifier.trim()) && Boolean(password) && !submitting;

  // Entrance animations
  const heroAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const demoAnim = useRef(new Animated.Value(0)).current;

  // Error shake
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== "web";
    const t = (v: Animated.Value, to: number, delay = 0) =>
      Animated.timing(v, {
        toValue: to,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      });

    Animated.parallel([
      t(heroAnim, 1, 0),
      t(formAnim, 1, 120),
      t(demoAnim, 1, 240),
    ]).start();
  }, [heroAnim, formAnim, demoAnim]);

  useEffect(() => {
    if (!error) return;
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0.6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -0.6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [error, shake]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(identifier, password);
      setSuccess(true);
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

  const heroStyle = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [
      {
        translateY: formAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };
  const demoStyle = {
    opacity: demoAnim,
    transform: [
      {
        translateY: demoAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };
  const errorStyle = {
    transform: [
      {
        translateX: shake.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-8, 0, 8],
        }),
      },
    ],
  };

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
          {/* Hero */}
          <Animated.View style={[styles.hero, heroStyle]}>
            <View style={styles.heroBlob} />
            <View style={styles.heroBlobSmall} />
            <View style={styles.heroBlobTiny} />

            <View style={styles.badge}>
              <View style={styles.badgeInner}>
                <MaterialCommunityIcons
                  name="school"
                  color={palette.primary}
                  size={30}
                />
              </View>
            </View>

            <Text style={styles.eyebrow}>NUCLEUS EDUCATION</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in with your school account to pick up where you left off.
            </Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View style={[styles.formCard, formStyle]}>
            <FloatingField
              autoComplete="username"
              editable={!submitting}
              icon="account-outline"
              label="School account"
              onChangeText={(v) => {
                setIdentifier(v);
                if (error) setError("");
              }}
              onSubmitEditing={() => {}}
              placeholder="Email, username or ID"
              returnKeyType="next"
              value={identifier}
            />

            <FloatingField
              autoComplete="password"
              editable={!submitting}
              icon="lock-outline"
              label="Password"
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError("");
              }}
              onSubmitEditing={() => void submit()}
              placeholder="Enter your password"
              returnKeyType="go"
              secureTextEntry={!showPassword}
              value={password}
              rightAccessory={
                <Pressable
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setShowPassword((v) => !v)}
                  style={({ pressed }) => [
                    styles.eye,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    color={showPassword ? palette.primary : palette.muted}
                    size={20}
                  />
                </Pressable>
              }
            />

            {error ? (
              <Animated.View style={[styles.errorBox, errorStyle]}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  color={palette.danger}
                  size={18}
                />
                <Text style={styles.error}>{error}</Text>
              </Animated.View>
            ) : null}

            {success ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  color={palette.success}
                  size={18}
                />
                <Text style={styles.successText}>Signed in successfully</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
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

            <View style={styles.helperRow}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                color={palette.muted}
                size={14}
              />
              <Text style={styles.helperText}>
                Your information is encrypted and secure
              </Text>
            </View>
          </Animated.View>

          {__DEV__ ? (
            <Animated.View style={[styles.demoCard, demoStyle]}>
              <View style={styles.demoIcon}>
                <MaterialCommunityIcons
                  name="lightbulb-on-outline"
                  color={palette.primary}
                  size={16}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoLabel}>Development account</Text>
                <Text style={styles.demoText}>
                  Use the local seeded account configured for this environment.
                </Text>
              </View>
            </Animated.View>
          ) : null}
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
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 30,
  },

  // Hero
  hero: {
    alignItems: "center",
    marginBottom: 28,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 12,
    position: "relative",
  },
  heroBlob: {
    backgroundColor: "#c4b5fd",
    borderRadius: 120,
    height: 200,
    opacity: 0.18,
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
  },
  heroBlobSmall: {
    backgroundColor: "#ddd6fe",
    borderRadius: 60,
    height: 100,
    opacity: 0.22,
    position: "absolute",
    left: -30,
    bottom: -40,
    width: 100,
  },
  heroBlobTiny: {
    backgroundColor: "#ede9fe",
    borderRadius: 40,
    height: 70,
    opacity: 0.5,
    position: "absolute",
    right: 30,
    bottom: 10,
    width: 70,
  },
  badge: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 24,
    borderWidth: 1,
    height: 68,
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    width: 68,
  },
  badgeInner: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: 18,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 38,
    marginTop: 6,
    textAlign: "center",
  },
  subtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 320,
    textAlign: "center",
  },

  // Form card
  formCard: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20,
    shadowColor: palette.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  eye: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
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
    fontWeight: "600",
    lineHeight: 18,
  },
  successBox: {
    alignItems: "center",
    backgroundColor: palette.successSoft,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  successText: {
    color: palette.success,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Button
  button: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    height: 54,
    justifyContent: "center",
    marginTop: 4,
    shadowColor: palette.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  helperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 2,
  },
  helperText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "600",
  },

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
