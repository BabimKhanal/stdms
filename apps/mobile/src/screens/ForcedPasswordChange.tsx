import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import { useAuth } from "../auth";

/* ---------- palette ---------- */
const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#ddd6fe",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
  success: "#059669",
  successSoft: "#ecfdf5",
  warning: "#d97706",
  warningSoft: "#fffbeb",
};

/* ---------- password analysis ---------- */
type Strength = "empty" | "weak" | "fair" | "good" | "strong";

const REQUIREMENTS: {
  key: string;
  label: string;
  test: (v: string) => boolean;
}[] = [
  { key: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "num", label: "One number", test: (v) => /\d/.test(v) },
  { key: "sym", label: "One symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function analyze(value: string): {
  strength: Strength;
  score: number;
  passed: Record<string, boolean>;
} {
  const passed: Record<string, boolean> = {};
  let score = 0;
  for (const r of REQUIREMENTS) {
    const ok = r.test(value);
    passed[r.key] = ok;
    if (ok) score++;
  }
  let strength: Strength = "empty";
  if (value.length > 0) {
    if (score <= 1) strength = "weak";
    else if (score <= 2) strength = "fair";
    else if (score <= 3) strength = "good";
    else strength = "strong";
  }
  return { strength, score, passed };
}

const STRENGTH_META: Record<
  Strength,
  { label: string; color: string; width: `${number}%` }
> = {
  empty: { label: "", color: "transparent", width: "0%" },
  weak: { label: "Weak", color: "#ef4444", width: "25%" },
  fair: { label: "Fair", color: "#f59e0b", width: "50%" },
  good: { label: "Good", color: "#3b82f6", width: "75%" },
  strong: { label: "Strong", color: "#059669", width: "100%" },
};

/* ---------- FloatingField ---------- */
function FloatingField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  textContentType,
  rightAccessory,
  onFocus,
  onBlur,
  autoFocus,
}: {
  icon: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  editable?: boolean;
  returnKeyType?: "next" | "go" | "done";
  onSubmitEditing?: () => void;
  autoComplete?: any;
  textContentType?: any;
  rightAccessory?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
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
    <Animated.View
      style={[
        styles.field,
        {
          borderColor,
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.15],
          }),
        },
      ]}
    >
      <View style={styles.iconCol}>
        <MaterialCommunityIcons
          name={icon as any}
          color={focused ? palette.primary : palette.muted}
          size={18}
        />
      </View>
      <View style={styles.inputCol}>
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.fieldLabel,
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
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          autoFocus={autoFocus}
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
          secureTextEntry
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
      </View>
      {rightAccessory ? (
        <View style={styles.rightCol}>{rightAccessory}</View>
      ) : null}
    </Animated.View>
  );
}

/* ---------- Eye toggle ---------- */
function EyeToggle({
  shown,
  onPress,
}: {
  shown: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={shown ? "Hide password" : "Show password"}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}
    >
      <MaterialCommunityIcons
        name={shown ? "eye-off-outline" : "eye-outline"}
        color={shown ? palette.primary : palette.muted}
        size={20}
      />
    </Pressable>
  );
}

/* ---------- Main ---------- */
export function ForcedPasswordChange() {
  const { user, changeTemporaryPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const analysis = useMemo(() => analyze(newPassword), [newPassword]);
  const requirementsMet = analysis.score === REQUIREMENTS.length;
  const matches = confirmPassword.length > 0 && confirmPassword === newPassword;
  const sameAsCurrent =
    currentPassword.length > 0 && newPassword === currentPassword;

  const canSubmit =
    Boolean(currentPassword) &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    requirementsMet &&
    matches &&
    !sameAsCurrent &&
    !saving &&
    !success;

  /* entrance animations */
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = (v: Animated.Value, to: number, delay = 0) =>
      Animated.timing(v, {
        toValue: to,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    Animated.parallel([t(heroAnim, 1, 0), t(cardAnim, 1, 120)]).start();
  }, [heroAnim, cardAnim]);

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

  const changeCurrent = (v: string) => {
    setCurrentPassword(v);
    if (error) setError("");
  };
  const changeNew = (v: string) => {
    setNewPassword(v);
    if (error) setError("");
  };
  const changeConfirm = (v: string) => {
    setConfirmPassword(v);
    if (error) setError("");
  };

  async function submit() {
    if (!canSubmit) return;
    // local validation mirrors the original function
    if (newPassword.length < 8)
      return setError("Your new password must be at least 8 characters.");
    if (newPassword !== confirmPassword)
      return setError("The new passwords do not match.");
    if (newPassword === currentPassword)
      return setError(
        "Choose a password different from the temporary password.",
      );

    setSaving(true);
    setError("");
    try {
      await changeTemporaryPassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change password",
      );
    } finally {
      setSaving(false);
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
  const cardStyle = {
    opacity: cardAnim,
    transform: [
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
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

  const strengthMeta = STRENGTH_META[analysis.strength];

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
            <View style={styles.iconWrap}>
              <View style={styles.iconInner}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  color={palette.primary}
                  size={30}
                />
              </View>
            </View>
            <Text style={styles.eyebrow}>SECURE YOUR ACCOUNT</Text>
            <Text style={styles.title}>Choose a private password</Text>
            <Text style={styles.subtitle}>
              {user?.name ? `Hi ${user.name}. ` : ""}
              Replace your temporary password before accessing school
              information.
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, cardStyle]}>
            <FloatingField
              autoComplete="current-password"
              editable={!saving && !success}
              icon="lock-outline"
              label="Temporary password"
              onChangeText={changeCurrent}
              onSubmitEditing={() => {}}
              placeholder="Enter temporary password"
              returnKeyType="next"
              textContentType="password"
              value={currentPassword}
              rightAccessory={
                <EyeToggle
                  shown={showCurrent}
                  onPress={() => setShowCurrent((v) => !v)}
                />
              }
            />

            <FloatingField
              autoComplete="new-password"
              editable={!saving && !success}
              icon="lock-reset"
              label="New password"
              onChangeText={changeNew}
              onSubmitEditing={() => {}}
              placeholder="Enter new password"
              returnKeyType="next"
              textContentType="newPassword"
              value={newPassword}
              rightAccessory={
                <EyeToggle
                  shown={showNew}
                  onPress={() => setShowNew((v) => !v)}
                />
              }
            />

            {/* Strength + requirements */}
            {newPassword.length > 0 && (
              <View style={styles.strengthBlock}>
                <View style={styles.strengthHeader}>
                  <Text style={styles.strengthLabel}>Password strength</Text>
                  <Text
                    style={[
                      styles.strengthValue,
                      { color: strengthMeta.color },
                    ]}
                  >
                    {strengthMeta.label}
                  </Text>
                </View>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: strengthMeta.width,
                        backgroundColor: strengthMeta.color,
                      },
                    ]}
                  />
                </View>
                <View style={styles.requirements}>
                  {REQUIREMENTS.map((r) => {
                    const ok = analysis.passed[r.key];
                    return (
                      <View key={r.key} style={styles.reqRow}>
                        <MaterialCommunityIcons
                          name={ok ? "check-circle" : "circle-outline"}
                          color={ok ? palette.success : palette.muted}
                          size={14}
                        />
                        <Text style={[styles.reqText, ok && styles.reqTextOk]}>
                          {r.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {sameAsCurrent && (
                  <View style={styles.warnRow}>
                    <MaterialCommunityIcons
                      name="alert"
                      color={palette.warning}
                      size={14}
                    />
                    <Text style={styles.warnText}>
                      New password must differ from the temporary one.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <FloatingField
              autoComplete="new-password"
              editable={!saving && !success}
              icon="lock-check-outline"
              label="Confirm new password"
              onChangeText={changeConfirm}
              onSubmitEditing={() => void submit()}
              placeholder="Re-enter new password"
              returnKeyType="go"
              textContentType="newPassword"
              value={confirmPassword}
              rightAccessory={
                <View style={styles.confirmRight}>
                  {confirmPassword.length > 0 && (
                    <MaterialCommunityIcons
                      name={matches ? "check-circle" : "close-circle"}
                      color={matches ? palette.success : palette.danger}
                      size={18}
                    />
                  )}
                  <EyeToggle
                    shown={showConfirm}
                    onPress={() => setShowConfirm((v) => !v)}
                  />
                </View>
              }
            />
            {confirmPassword.length > 0 && !matches && (
              <Text style={styles.inlineError}>Passwords don't match yet.</Text>
            )}

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
                <Text style={styles.successText}>
                  Password updated. You'll be signed in with your new password.
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: saving }}
              disabled={!canSubmit}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                !canSubmit && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    {success ? "Continue" : "Change password and continue"}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    color="#fff"
                    size={18}
                  />
                </>
              )}
            </Pressable>

            <Text style={styles.help}>
              After changing your password, sign in again with the new one.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */
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
    alignItems: "center",
    marginBottom: 26,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 12,
    position: "relative",
  },
  heroBlob: {
    backgroundColor: "#c4b5fd",
    borderRadius: 120,
    height: 200,
    opacity: 0.16,
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
  },
  heroBlobSmall: {
    backgroundColor: "#ddd6fe",
    borderRadius: 60,
    height: 100,
    opacity: 0.2,
    position: "absolute",
    left: -30,
    bottom: -40,
    width: 100,
  },
  iconWrap: {
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
  iconInner: {
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
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 6,
    textAlign: "center",
  },
  subtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 340,
    textAlign: "center",
  },

  // Card
  card: {
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

  // Field
  field: {
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
  fieldLabel: {
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
  eye: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  confirmRight: { alignItems: "center", flexDirection: "row", gap: 4 },

  // Strength
  strengthBlock: { marginTop: -4, marginBottom: 4 },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  strengthLabel: { color: palette.inkSoft, fontSize: 12, fontWeight: "700" },
  strengthValue: { fontSize: 12, fontWeight: "800" },
  strengthTrack: {
    backgroundColor: palette.primarySoft,
    borderRadius: 99,
    height: 6,
    overflow: "hidden",
  },
  strengthFill: { borderRadius: 99, height: 6 },
  requirements: { marginTop: 10, gap: 6 },
  reqRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  reqText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
  reqTextOk: { color: palette.inkSoft, textDecorationLine: "none" },
  warnRow: {
    alignItems: "center",
    backgroundColor: palette.warningSoft,
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    padding: 8,
  },
  warnText: {
    color: palette.warning,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },

  inlineError: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    marginTop: -6,
  },

  // Error / Success
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
    borderRadius: 16,
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

  help: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
});
