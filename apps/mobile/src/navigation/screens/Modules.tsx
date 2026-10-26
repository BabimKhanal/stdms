import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useVideoPlayer, VideoView } from "expo-video";
import { createMarksheetPdf, type MarksheetResult } from "../../lib/marksheet";
import { EduApiClient } from "@edu/api-client";
import { mobileToken, useAuth } from "../../auth";
import { API_URL } from "../../config";

type Item = Record<string, unknown>;

function useList(path: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void mobileToken()
      .then((token) => {
        if (!token) {
          if (active) {
            setError("Session expired. Please sign in again.");
            setLoading(false);
          }
          return;
        }
        return new EduApiClient(API_URL, () => token)
          .get<{ data: Item[] }>(path)
          .then((result) => {
            if (active) setItems(result.data);
          })
          .catch((err: unknown) => {
            if (active)
              setError(
                err instanceof Error
                  ? err.message
                  : `Unable to load data from ${API_URL}`,
              );
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load data");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { items, loading, error };
}

function ModuleList({
  title,
  subtitle,
  path,
  getTitle,
  getMeta,
  renderExtra,
}: {
  title: string;
  subtitle: string;
  path: string;
  getTitle: (item: Item) => string;
  getMeta: (item: Item) => string;
  renderExtra?: (item: Item) => ReactNode;
}) {
  const { items, loading, error } = useList(path);
  const { user } = useAuth();
  const icon: keyof typeof MaterialCommunityIcons.glyphMap =
    title === "Learning"
      ? "book-open-page-variant-outline"
      : title === "Attendance"
        ? "calendar-check-outline"
        : title === "Fees"
          ? "cash-multiple"
          : "chart-box-outline";
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 12,
          marginTop: 4,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#dbeafe",
            borderRadius: 16,
            height: 50,
            justifyContent: "center",
            width: 50,
          }}
        >
          <MaterialCommunityIcons name={icon} color="#2563eb" size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{user?.orgName ?? "Nucleus"}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {loading ? (
        <ActivityIndicator color="#2563eb" style={styles.loader} />
      ) : error ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#fff",
            borderColor: "#e7edf5",
            borderRadius: 20,
            borderWidth: 1,
            flexDirection: "row",
            marginTop: 28,
            padding: 20,
          }}
        >
          <MaterialCommunityIcons
            name="cloud-alert-outline"
            color="#be123c"
            size={24}
          />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : items.length ? (
        <View style={styles.list}>
          {items.map((item, index) => (
            <View key={String(item.id ?? index)} style={styles.card}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: "#eff6ff",
                    borderRadius: 10,
                    height: 34,
                    justifyContent: "center",
                    width: 34,
                  }}
                >
                  <MaterialCommunityIcons
                    name={icon}
                    color="#2563eb"
                    size={17}
                  />
                </View>
                <Text
                  style={{ color: "#cbd5e1", fontSize: 12, fontWeight: "800" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>
              <Text style={[styles.cardTitle, { marginTop: 15 }]}>
                {getTitle(item)}
              </Text>
              <Text style={styles.cardMeta}>{getMeta(item)}</Text>
              {renderExtra?.(item)}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#fff",
            borderColor: "#e7edf5",
            borderRadius: 20,
            borderWidth: 1,
            marginTop: 28,
            padding: 25,
          }}
        >
          <MaterialCommunityIcons
            name="inbox-outline"
            color="#94a3b8"
            size={28}
          />
          <Text style={styles.empty}>Nothing to show yet.</Text>
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 12,
              marginTop: 5,
              textAlign: "center",
            }}
          >
            New activity will appear here when it is available.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

export function Attendance() {
  const { user } = useAuth();
  return (
    <ModuleList
      title="Attendance"
      subtitle="Stay current with attendance records."
      path={`/attendance${user?.studentId ? `?studentId=${user.studentId}` : ""}`}
      getTitle={(item) =>
        String(item.studentName ?? item.date ?? "Attendance record")
      }
      getMeta={(item) =>
        `${String(item.status ?? "recorded")} · ${String(item.date ?? "")}`
      }
    />
  );
}
export function Learning() {
  return (
    <ModuleList
      title="Learning"
      subtitle="Homework and assignments from your classes."
      path="/homework"
      getTitle={(item) => String(item.title ?? "Homework")}
      getMeta={(item) =>
        `${String(item.subjectName ?? "Subject")} · assigned ${formatDate(item.assignedDate)} · due ${formatDate(item.submissionDate)}`
      }
      renderExtra={(item) => <AssignmentDetails item={item} />}
    />
  );
}
export function Fees() {
  return (
    <ModuleList
      title="Fees"
      subtitle="Review invoices and outstanding balances."
      path="/fees/invoices"
      getTitle={(item) =>
        `${String(item.invoiceNumber ?? "Invoice")} · ${String(item.studentName ?? "")}`
      }
      getMeta={(item) =>
        `Rs ${Number(item.balance ?? 0).toLocaleString()} outstanding · ${String(item.status ?? "")}`
      }
    />
  );
}
export function Results() {
  return (
    <ModuleList
      title="Results"
      subtitle="Examinations and published assessment records."
      path="/exams"
      getTitle={(item) => String(item.name ?? "Examination")}
      getMeta={(item) =>
        `${String(item.type ?? "")} · ${String(item.status ?? "draft")}`
      }
      renderExtra={(item) => (
        <MarksheetButton
          examId={String(item.id ?? "")}
          examName={String(item.name ?? "Examination")}
        />
      )}
    />
  );
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
function AssignmentDetails({ item }: { item: Item }) {
  const description =
    typeof item.description === "string" ? item.description : "";
  const urls = Array.isArray(item.attachmentUrls)
    ? item.attachmentUrls.filter(
        (url): url is string => typeof url === "string",
      )
    : typeof item.attachmentUrl === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(item.attachmentUrl as string);
            return Array.isArray(parsed)
              ? parsed.filter((url): url is string => typeof url === "string")
              : [item.attachmentUrl as string];
          } catch {
            return [item.attachmentUrl];
          }
        })()
      : [];
  return (
    <View>
      {description ? (
        <Text
          style={{
            color: "#475569",
            fontSize: 13,
            lineHeight: 20,
            marginTop: 12,
          }}
        >
          {description}
        </Text>
      ) : null}
      {typeof item.id === "string" ? (
        <FileSubmissionForm homeworkId={item.id} />
      ) : null}
      {urls.map((url, index) => (
        <Attachment key={`${url}-${index}`} url={url} />
      ))}
    </View>
  );
}

type SubmissionFile = { url: string; name: string; mimeType: string };
async function uploadSubmissionFile(
  asset: DocumentPicker.DocumentPickerAsset,
  token: string,
) {
  const mimeType =
    asset.mimeType ??
    (asset.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");
  const resourceType = mimeType.startsWith("image/") ? "image" : "raw";
  const signed = await new EduApiClient(API_URL, () => token).post<{
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  }>("/uploads/sign", { folder: "assignments", resourceType });
  const body = new FormData();
  body.append("file", {
    uri: asset.uri,
    name: asset.name,
    type: mimeType,
  } as unknown as Blob);
  body.append("api_key", signed.apiKey);
  body.append("timestamp", String(signed.timestamp));
  body.append("signature", signed.signature);
  body.append("folder", signed.folder);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`,
    { method: "POST", body },
  );
  const result = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.secure_url)
    throw new Error(result.error?.message ?? "File upload failed");
  return { url: result.secure_url, name: asset.name, mimeType };
}

function FileSubmissionForm({ homeworkId }: { homeworkId: string }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<SubmissionFile | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"upload" | "submit" | null>(null);
  useEffect(() => {
    if (!user?.studentId) return;
    let active = true;
    void mobileToken().then((token) =>
      token
        ? new EduApiClient(API_URL, () => token)
            .get<{
              data: Array<{
                content: string | null;
                fileUrl: string | null;
                status: string;
                feedback: string | null;
                marks: number | null;
              }>;
            }>(`/homework/${homeworkId}/submissions`)
            .then((result) => {
              const submission = result.data[0];
              if (active && submission) {
                setContent(submission.content ?? "");
                setStatus(
                  submission.marks === null
                    ? "Submitted"
                    : `Graded: ${submission.marks}`,
                );
                if (submission.fileUrl)
                  setAttachment({
                    url: submission.fileUrl,
                    name: "Submitted file",
                    mimeType: "application/octet-stream",
                  });
              }
            })
            .catch(() => undefined)
        : undefined,
    );
    return () => {
      active = false;
    };
  }, [homeworkId, user?.studentId]);
  if (!user?.studentId) return null;
  async function chooseFile() {
    setStatus("");
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 15 * 1024 * 1024) {
      setStatus("Choose a file smaller than 15 MB.");
      return;
    }
    setBusy("upload");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      setAttachment(await uploadSubmissionFile(asset, token));
      setStatus("File attached");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to upload file",
      );
    } finally {
      setBusy(null);
    }
  }
  async function submit() {
    setBusy("submit");
    setStatus("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      await new EduApiClient(API_URL, () => token).post(
        `/homework/${homeworkId}/submissions`,
        { content: content.trim() || null, fileUrl: attachment?.url ?? null },
      );
      setStatus("Submission saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit");
    } finally {
      setBusy(null);
    }
  }
  return (
    <View style={submissionStyles.submissionBox}>
      <View style={submissionStyles.submissionHeading}>
        <View>
          <Text style={submissionStyles.submissionLabel}>YOUR RESPONSE</Text>
          <Text style={submissionStyles.submissionHint}>
            Add an answer, image, or PDF.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="file-upload-outline"
          color="#2563eb"
          size={22}
        />
      </View>
      <TextInput
        multiline
        value={content}
        onChangeText={setContent}
        placeholder="Write your answer or note..."
        placeholderTextColor="#94a3b8"
        style={submissionStyles.responseInput}
      />
      <Pressable
        disabled={busy !== null}
        onPress={() => void chooseFile()}
        style={submissionStyles.attachButton}
      >
        <MaterialCommunityIcons name="paperclip" color="#2563eb" size={18} />
        <Text style={submissionStyles.attachText}>
          {busy === "upload"
            ? "Uploading..."
            : attachment
              ? "Replace attachment"
              : "Attach image or PDF"}
        </Text>
      </Pressable>
      {attachment && (
        <View style={submissionStyles.attachedFile}>
          <MaterialCommunityIcons
            name={
              attachment.mimeType.startsWith("image/")
                ? "image-outline"
                : "file-pdf-box"
            }
            color="#2563eb"
            size={20}
          />
          <Text numberOfLines={1} style={submissionStyles.attachedName}>
            {attachment.name}
          </Text>
          <Pressable onPress={() => setAttachment(null)}>
            <MaterialCommunityIcons
              name="close-circle-outline"
              color="#94a3b8"
              size={18}
            />
          </Pressable>
        </View>
      )}
      <Pressable
        disabled={busy !== null}
        onPress={() => void submit()}
        style={submissionStyles.submitButton}
      >
        <Text style={submissionStyles.submitText}>
          {busy === "submit" ? "Saving..." : "Submit assignment"}
        </Text>
        <MaterialCommunityIcons name="arrow-right" color="#fff" size={17} />
      </Pressable>
      {status ? (
        <Text style={submissionStyles.submissionStatus}>{status}</Text>
      ) : null}
    </View>
  );
}
function SubmissionForm({ homeworkId }: { homeworkId: string }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user?.studentId) return;
    let active = true;
    void mobileToken().then((token) =>
      token
        ? new EduApiClient(API_URL, () => token)
            .get<{
              data: Array<{
                content: string | null;
                status: string;
                feedback: string | null;
                marks: number | null;
              }>;
            }>(`/homework/${homeworkId}/submissions`)
            .then((result) => {
              const submission = result.data[0];
              if (active && submission) {
                setContent(submission.content ?? "");
                setStatus(
                  submission.marks === null
                    ? "Submitted"
                    : `Graded: ${submission.marks}`,
                );
              }
            })
            .catch(() => undefined)
        : undefined,
    );
    return () => {
      active = false;
    };
  }, [homeworkId, user?.studentId]);
  if (!user?.studentId) return null;
  async function submit() {
    setSaving(true);
    setStatus("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      await new EduApiClient(API_URL, () => token).post(
        `/homework/${homeworkId}/submissions`,
        { content: content.trim() || null, fileUrl: null },
      );
      setStatus("Submission saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit");
    } finally {
      setSaving(false);
    }
  }
  return (
    <View
      style={{
        backgroundColor: "#f8fafc",
        borderColor: "#e2e8f0",
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 14,
        padding: 13,
      }}
    >
      <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>
        Your response
      </Text>
      <TextInput
        multiline
        value={content}
        onChangeText={setContent}
        placeholder="Write your answer or note..."
        placeholderTextColor="#94a3b8"
        style={{
          backgroundColor: "#fff",
          borderColor: "#dbe4ef",
          borderRadius: 10,
          borderWidth: 1,
          color: "#0f172a",
          minHeight: 76,
          marginTop: 9,
          padding: 10,
          textAlignVertical: "top",
        }}
      />
      <Pressable
        disabled={saving}
        onPress={() => void submit()}
        style={{
          alignItems: "center",
          backgroundColor: "#2563eb",
          borderRadius: 10,
          marginTop: 9,
          padding: 11,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
          {saving ? "Saving..." : "Submit response"}
        </Text>
      </Pressable>
      {status ? (
        <Text style={{ color: "#64748b", fontSize: 11, marginTop: 7 }}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}
function MarksheetButton({
  examId,
  examName,
}: {
  examId: string;
  examName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      const result = await new EduApiClient(API_URL, () => token).get<{
        data: MarksheetResult[];
      }>(`/exams/results?examId=${encodeURIComponent(examId)}`);
      const row = result.data[0];
      if (!row) {
        setMessage("Marks are not published yet.");
        return;
      }
      const bytes = await createMarksheetPdf(examName, row);
      const filename = `${examName
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}-marksheet.pdf`;
      if (Platform.OS === "web") {
        const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(href);
      } else {
        const directory = new Directory(Paths.document, "marksheets");
        directory.create({ idempotent: true, intermediates: true });
        const file = new File(directory, filename);
        file.write(bytes);
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, { dialogTitle: "Save marksheet" });
        else await WebBrowser.openBrowserAsync(file.uri);
      }
      setMessage("Marksheet ready.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to generate marksheet",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.marksheet}>
      <Pressable
        disabled={busy}
        onPress={() => void generate()}
        style={styles.marksheetButton}
      >
        <MaterialCommunityIcons name="file-pdf-box" color="#2563eb" size={17} />
        <Text style={styles.marksheetText}>
          {busy ? "Generating..." : "Download marksheet"}
        </Text>
      </Pressable>
      {message ? <Text style={styles.marksheetMessage}>{message}</Text> : null}
    </View>
  );
}
function Attachment({ url }: { url: string | null }) {
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  if (!url) return null;
  const sourceUrl = url;
  const isPdf = /\.pdf(\?|$)/i.test(sourceUrl);
  const legacyPdf = isPdf && sourceUrl.includes("/image/upload/");
  const isImage =
    !isPdf &&
    (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(sourceUrl) ||
      sourceUrl.includes("/image/upload/"));
  const isVideo =
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(sourceUrl) ||
    sourceUrl.includes("/video/upload/");
  const label = isVideo
    ? "Video attachment"
    : isPdf
      ? "PDF document"
      : "Attached document";
  async function preview() {
    setBusy("preview");
    setPreviewVisible(true);
    setBusy(null);
  }
  async function download() {
    setBusy("download");
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(sourceUrl);
        return;
      }
      const fileName = decodeURIComponent(
        sourceUrl.split("/").pop()?.split("?")[0] ??
          `attachment${isPdf ? ".pdf" : ""}`,
      );
      const directory = new Directory(Paths.document, "downloads");
      directory.create({ idempotent: true, intermediates: true });
      const file = await File.downloadFileAsync(sourceUrl, directory);
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${fileName}` });
      else await Linking.openURL(file.uri);
    } catch {
      await preview();
    } finally {
      setBusy(null);
    }
  }
  if (legacyPdf)
    return (
      <View style={[styles.fileRow, styles.warningRow]}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          color="#b45309"
          size={25}
        />
        <View style={styles.fileCopy}>
          <Text style={styles.warningText}>Document unavailable</Text>
          <Text style={styles.fileHint}>
            Ask your teacher to re-upload this PDF.
          </Text>
        </View>
      </View>
    );
  return (
    <View style={styles.attachment}>
      {isImage ? (
        <Pressable onPress={() => void preview()}>
          <Image source={{ uri: url }} style={styles.attachmentImage} />
        </Pressable>
      ) : (
        <View style={styles.fileRow}>
          <MaterialCommunityIcons
            name={
              isVideo
                ? "play-circle-outline"
                : isPdf
                  ? "file-pdf-box"
                  : "file-document-outline"
            }
            color="#2563eb"
            size={25}
          />
          <View style={styles.fileCopy}>
            <Text style={styles.attachmentText}>{label}</Text>
            <Text style={styles.fileHint}>Preview or save this file</Text>
          </View>
        </View>
      )}
      <View style={styles.fileActions}>
        <Pressable
          disabled={busy !== null}
          onPress={() => void preview()}
          style={styles.fileButton}
        >
          <MaterialCommunityIcons
            name="eye-outline"
            color="#2563eb"
            size={16}
          />
          <Text style={styles.fileButtonText}>
            {busy === "preview" ? "Opening..." : "Preview"}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy !== null}
          onPress={() => void download()}
          style={styles.fileButton}
        >
          <MaterialCommunityIcons
            name="download-outline"
            color="#2563eb"
            size={16}
          />
          <Text style={styles.fileButtonText}>
            {busy === "download" ? "Saving..." : "Download"}
          </Text>
        </Pressable>
      </View>
      <PreviewModal
        visible={previewVisible}
        url={sourceUrl}
        label={label}
        isImage={isImage}
        isVideo={isVideo}
        onClose={() => setPreviewVisible(false)}
        onDownload={() => void download()}
      />
    </View>
  );
}

const submissionStyles = StyleSheet.create({
  submissionBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#dbe4ef",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 15,
    padding: 13,
  },
  submissionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  submissionLabel: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  submissionHint: { color: "#64748b", fontSize: 12, marginTop: 3 },
  responseInput: {
    backgroundColor: "#fff",
    borderColor: "#dbe4ef",
    borderRadius: 11,
    borderWidth: 1,
    color: "#0f172a",
    minHeight: 82,
    marginTop: 11,
    padding: 11,
    textAlignVertical: "top",
  },
  attachButton: {
    alignItems: "center",
    alignSelf: "stretch",
    borderColor: "#bfdbfe",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  attachText: {
    color: "#2563eb",
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  attachedFile: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
    padding: 10,
  },
  attachedName: { color: "#334155", flex: 1, fontSize: 12, fontWeight: "700" },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 11,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 11,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  submitText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  submissionStatus: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 9,
    textAlign: "center",
  },
});

function VideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      style={{ backgroundColor: "#0f172a", flex: 1, width: "100%" }}
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      contentFit="contain"
    />
  );
}
function PreviewModal({
  visible,
  url,
  label,
  isImage,
  isVideo,
  onClose,
  onDownload,
}: {
  visible: boolean;
  url: string;
  label: string;
  isImage: boolean;
  isVideo: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  const viewerUrl =
    !isImage && !isVideo && !/\.pdf(\?|$)/i.test(url)
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
      : url;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.previewScreen}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewEyebrow}>ATTACHMENT PREVIEW</Text>
            <Text style={styles.previewTitle}>{label}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" color="#334155" size={22} />
          </Pressable>
        </View>
        {isImage ? (
          <Image
            source={{ uri: url }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : isVideo ? (
          <VideoPreview url={url} />
        ) : Platform.OS === "web" ? (
          <iframe
            title={label}
            src={viewerUrl}
            style={{ border: 0, flex: 1, width: "100%" }}
          />
        ) : (
          <WebView
            source={{ uri: viewerUrl }}
            style={styles.previewWebView}
            allowsFullscreenMedia
            mediaPlaybackRequiresUserAction={false}
          />
        )}
        <Pressable onPress={onDownload} style={styles.previewDownload}>
          <MaterialCommunityIcons
            name="download-outline"
            color="#fff"
            size={18}
          />
          <Text style={styles.previewDownloadText}>Download file</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#64748b", fontSize: 15, lineHeight: 22, marginTop: 8 },
  loader: { marginTop: 48 },
  error: { color: "#be123c", marginTop: 32 },
  empty: { color: "#64748b", marginTop: 40, textAlign: "center" },
  list: { gap: 12, marginTop: 28 },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: { color: "#0f172a", fontSize: 16, fontWeight: "600" },
  cardMeta: { color: "#64748b", fontSize: 13, marginTop: 7 },
  marksheet: { marginTop: 14 },
  marksheetButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#bfdbfe",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  marksheetText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  marksheetMessage: { color: "#64748b", fontSize: 11, marginTop: 6 },
  attachment: { marginTop: 12 },
  attachmentImage: { borderRadius: 10, height: 140, width: "100%" },
  fileRow: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    flexDirection: "row",
    padding: 12,
  },
  warningRow: { backgroundColor: "#fffbeb" },
  fileCopy: { flex: 1, marginLeft: 10 },
  attachmentText: { color: "#2563eb", fontSize: 13, fontWeight: "700" },
  warningText: { color: "#b45309", fontSize: 13, fontWeight: "700" },
  fileHint: { color: "#64748b", fontSize: 11, marginTop: 3 },
  fileActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  fileButton: {
    alignItems: "center",
    borderColor: "#bfdbfe",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileButtonText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  previewScreen: { backgroundColor: "#f8fafc", flex: 1 },
  previewHeader: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  previewEyebrow: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  previewTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 4,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  previewImage: { flex: 1, width: "100%" },
  previewWebView: { backgroundColor: "#fff", flex: 1 },
  previewDownload: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    margin: 16,
    padding: 15,
  },
  previewDownloadText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
