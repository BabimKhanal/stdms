import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth";

export function ForcedPasswordChange() {
  const { user, changeTemporaryPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (newPassword.length < 8) return setError("Your new password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    if (newPassword === currentPassword) return setError("Choose a password different from the temporary password.");
    setSaving(true);
    setError("");
    try { await changeTemporaryPassword(currentPassword, newPassword); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to change password"); }
    finally { setSaving(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"><View style={styles.icon}><MaterialCommunityIcons name="shield-lock-outline" color="#fff" size={30} /></View><Text style={styles.eyebrow}>SECURE YOUR ACCOUNT</Text><Text style={styles.title}>Choose a private password</Text><Text style={styles.subtitle}>Hi {user?.name}. Replace your temporary password before accessing school information.</Text><View style={styles.card}><Field label="Temporary password" value={currentPassword} onChangeText={setCurrentPassword} /><Field label="New password" value={newPassword} onChangeText={setNewPassword} /><Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} />{error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle" color="#e11d48" size={18} /><Text style={styles.error}>{error}</Text></View> : null}<Pressable disabled={saving || !currentPassword || !newPassword || !confirmPassword} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.pressed, (saving || !currentPassword || !newPassword || !confirmPassword) && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Change password and continue</Text>}</Pressable><Text style={styles.help}>After changing your password, sign in again with the new one.</Text></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput autoCapitalize="none" autoComplete="new-password" secureTextEntry value={value} onChangeText={onChangeText} style={styles.input} /></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#faf9ff" }, flex: { flex: 1 }, container: { flexGrow: 1, justifyContent: "center", padding: 24 }, icon: { alignItems: "center", alignSelf: "center", backgroundColor: "#7c3aed", borderRadius: 18, height: 60, justifyContent: "center", marginBottom: 20, width: 60 }, eyebrow: { color: "#7c3aed", fontSize: 12, fontWeight: "800", letterSpacing: 1.5, textAlign: "center" }, title: { color: "#1e1b4b", fontSize: 28, fontWeight: "800", marginTop: 8, textAlign: "center" }, subtitle: { color: "#64748b", fontSize: 15, lineHeight: 23, marginHorizontal: 12, marginTop: 10, textAlign: "center" }, card: { backgroundColor: "#fff", borderColor: "#ede9fe", borderRadius: 24, borderWidth: 1, marginTop: 28, padding: 20 }, field: { marginBottom: 16 }, label: { color: "#475569", fontSize: 13, fontWeight: "700", marginBottom: 7 }, input: { borderColor: "#ddd6fe", borderRadius: 13, borderWidth: 1, color: "#1e1b4b", fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 }, errorBox: { alignItems: "center", backgroundColor: "#fff1f2", borderRadius: 12, flexDirection: "row", gap: 8, marginBottom: 16, padding: 12 }, error: { color: "#be123c", flex: 1, fontSize: 13 }, button: { alignItems: "center", backgroundColor: "#7c3aed", borderRadius: 14, minHeight: 50, justifyContent: "center", padding: 14 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.45 }, help: { color: "#94a3b8", fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" } });