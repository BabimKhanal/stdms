import { MaterialCommunityIcons } from "@expo/vector-icons";
import { File, Paths, Directory } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../../config";
import { mobileToken, useAuth } from "../../auth";
import { EduApiClient } from "@edu/api-client";

const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#ddd6fe",
};

const documents = [
  { type: "identity_card", title: "Identity card", description: "Your official student identification document", icon: "card-account-details-outline" as const },
  { type: "transcript", title: "Transcript", description: "Academic history and published records", icon: "file-chart-outline" as const },
  { type: "marksheet", title: "Marksheet", description: "Your formatted academic result document", icon: "file-table-outline" as const },
  { type: "certificate", title: "Certificate", description: "Certificates issued by your institution", icon: "certificate-outline" as const },
];
type AttachedDocument = {
  id: string;
  documentType: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
};

export function Documents() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);

  useEffect(() => {
    if (!user?.studentId) return;
    void mobileToken()
      .then((token) => {
        if (!token) throw new Error("Session expired. Please sign in again.");
        return new EduApiClient(API_URL, () => token).get<{ documents?: AttachedDocument[] }>("/auth/profile");
      })
      .then((profile) => setAttachedDocuments(profile?.documents ?? []))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load school documents"));
  }, [user?.studentId]);

  async function openDocument(type: string, title: string) {
    if (!user?.studentId) {
      setMessage("Documents are available for student accounts only.");
      return;
    }
    setBusy(type);
    setMessage("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired. Please sign in again.");
      const response = await fetch(`${API_URL}/students/${user.studentId}/document?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "This document is not available yet.");
      }
      if (Platform.OS === "web") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        await Linking.openURL(url);
        URL.revokeObjectURL(url);
        return;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const directory = new Directory(Paths.document, "documents");
      directory.create({ idempotent: true, intermediates: true });
      const file = new File(directory, `${type}-${user.studentId}.pdf`);
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${title}` });
      else await Linking.openURL(file.uri);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open document");
    } finally {
      setBusy(null);
    }
  }

  async function previewAttached(item: AttachedDocument) {
    setBusy(`preview-${item.id}`);
    setMessage("");
    try {
      if (Platform.OS === "web") await Linking.openURL(item.fileUrl);
      else await WebBrowser.openBrowserAsync(item.fileUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to preview document");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAttached(item: AttachedDocument) {
    setBusy(`download-${item.id}`);
    setMessage("");
    try {
      const filename = item.fileName || `${item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "document"}.pdf`;
      if (Platform.OS === "web") {
        const response = await fetch(item.fileUrl);
        if (!response.ok) throw new Error("Unable to download document");
        const url = URL.createObjectURL(await response.blob());
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const directory = new Directory(Paths.document, "documents");
        directory.create({ idempotent: true, intermediates: true });
        const file = await File.downloadFileAsync(item.fileUrl, new File(directory, filename));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${item.title}` });
        else await Linking.openURL(file.uri);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to download document");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{user?.orgName ?? "Nucleus"}</Text>
      <Text style={styles.title}>My documents</Text>
      <Text style={styles.subtitle}>View and save official documents issued by your institution.</Text>
      <View style={styles.list}>
        {documents.map((document) => {
          const loading = busy === document.type;
          return (
            <Pressable key={document.type} disabled={busy !== null} onPress={() => void openDocument(document.type, document.title)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.icon}><MaterialCommunityIcons name={document.icon} color={palette.primary} size={24} /></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{document.title}</Text><Text style={styles.description}>{document.description}</Text></View>
              <MaterialCommunityIcons name={loading ? "loading" : "chevron-right"} color={loading ? palette.primary : palette.muted} size={22} />
            </Pressable>
          );
        })}
      </View>
      {attachedDocuments.length ? (
        <View style={styles.attachedSection}>
          <Text style={styles.sectionTitle}>Documents from school</Text>
          {attachedDocuments.map((document) => (
            <View key={document.id} style={styles.attachedCard}>
              <View style={styles.attachedIcon}><MaterialCommunityIcons name="file-document-outline" color={palette.primary} size={22} /></View>
              <View style={styles.attachedCopy}>
                <Text numberOfLines={1} style={styles.attachedTitle}>{document.title}</Text>
                <Text style={styles.attachedMeta}>{document.documentType}{document.fileName ? ` · ${document.fileName}` : ""}</Text>
              </View>
              <View style={styles.attachedActions}>
                <Pressable disabled={busy !== null} onPress={() => void previewAttached(document)} accessibilityLabel={`Preview ${document.title}`}>
                  <MaterialCommunityIcons name={busy === `preview-${document.id}` ? "loading" : "eye-outline"} color={palette.primary} size={21} />
                </Pressable>
                <Pressable disabled={busy !== null} onPress={() => void downloadAttached(document)} accessibilityLabel={`Download ${document.title}`}>
                  <MaterialCommunityIcons name={busy === `download-${document.id}` ? "loading" : "download-outline"} color={palette.inkSoft} size={21} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {message ? <View style={styles.message}><MaterialCommunityIcons name="information-outline" color={palette.primary} size={18} /><Text style={styles.messageText}>{message}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.bg, flexGrow: 1, padding: 20, paddingBottom: 40 },
  eyebrow: { color: "#5b21b6", fontSize: 13, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: palette.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { color: palette.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 6 },
  list: { gap: 12, marginTop: 24 },
  card: { alignItems: "center", backgroundColor: "#fff", borderColor: palette.border, borderRadius: 18, borderWidth: 1, flexDirection: "row", padding: 15 },
  pressed: { backgroundColor: palette.primarySoft, transform: [{ scale: 0.99 }] },
  icon: { alignItems: "center", backgroundColor: palette.primarySoft, borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  copy: { flex: 1, marginHorizontal: 13 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  description: { color: palette.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 3 },
  message: { alignItems: "center", backgroundColor: palette.primarySoft, borderRadius: 14, flexDirection: "row", gap: 8, marginTop: 18, padding: 13 },
  messageText: { color: palette.inkSoft, flex: 1, fontSize: 13, lineHeight: 18 },
  attachedSection: { gap: 10, marginTop: 28 },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  attachedCard: { alignItems: "center", backgroundColor: "#fff", borderColor: palette.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  attachedIcon: { alignItems: "center", backgroundColor: palette.primarySoft, borderRadius: 11, height: 42, justifyContent: "center", width: 42 },
  attachedCopy: { flex: 1, minWidth: 0 },
  attachedTitle: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  attachedMeta: { color: palette.inkSoft, fontSize: 11, marginTop: 3 },
  attachedActions: { alignItems: "center", flexDirection: "row", gap: 14 },
});
