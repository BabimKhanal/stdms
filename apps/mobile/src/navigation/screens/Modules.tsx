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

// ── Friendlier palette ────────────────────────────────────────────────────
const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  primaryBorder: "#ddd6fe",
  bg: "#faf9ff",
  ink: "#1e1b4b",
  inkSoft: "#475569",
  muted: "#94a3b8",
  border: "#f1f0f9",
  success: "#059669",
  successSoft: "#ecfdf5",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  danger: "#e11d48",
  dangerSoft: "#fff1f2",
};

// ── Module theme (icon + accent per module) ───────────────────────────────
const moduleTheme: Record<
  string,
  {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    tint: string;
    bg: string;
  }
> = {
  Learning: { icon: "book-open-page-variant", tint: "#7c3aed", bg: "#f5f3ff" },
  Attendance: { icon: "calendar-check", tint: "#059669", bg: "#ecfdf5" },
  Fees: { icon: "wallet", tint: "#d97706", bg: "#fffbeb" },
  Results: { icon: "chart-line", tint: "#2563eb", bg: "#eff6ff" },
};

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
  const theme = moduleTheme[title] ?? moduleTheme.Learning;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: theme.bg }]}>
          <MaterialCommunityIcons
            name={theme.icon}
            color={theme.tint}
            size={26}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{user?.orgName ?? "Nucleus"}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <MaterialCommunityIcons
              name="cloud-alert-outline"
              color={palette.danger}
              size={22}
            />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length ? (
        <View style={styles.list}>
          {items.map((item, index) => (
            <View key={String(item.id ?? index)} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.cardIcon, { backgroundColor: theme.bg }]}>
                  <MaterialCommunityIcons
                    name={theme.icon}
                    color={theme.tint}
                    size={18}
                  />
                </View>
                <Text style={styles.cardIndex}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{getTitle(item)}</Text>
              <Text style={styles.cardMeta}>{getMeta(item)}</Text>
              {renderExtra?.(item)}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons
              name="inbox-outline"
              color={palette.muted}
              size={26}
            />
          </View>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            New activity will appear here when it's available. Check back soon!
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
      subtitle="See how your attendance is tracking this term."
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
      subtitle="Your homework and assignments in one place."
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
      subtitle="Your invoices and outstanding balances."
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
      subtitle="Your exams and published assessment records."
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
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionLabel}>What to do</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>
      ) : null}
      {typeof item.id === "string" ? (
        <FileSubmissionForm homeworkId={item.id} />
      ) : null}
      {urls.length ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.attachmentsLabel}>Attachments</Text>
          {urls.map((url, index) => (
            <Attachment key={`${url}-${index}`} url={url} />
          ))}
        </View>
      ) : null}
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
                    ? "✓ Submitted — waiting for grading"
                    : `★ Graded: ${submission.marks}`,
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
      setStatus("Please choose a file smaller than 15 MB.");
      return;
    }
    setBusy("upload");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      setAttachment(await uploadSubmissionFile(asset, token));
      setStatus("✓ File attached");
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
      setStatus("✓ Submission saved — nice work!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={submissionStyles.submissionBox}>
      <View style={submissionStyles.submissionHeading}>
        <View style={{ flex: 1 }}>
          <View style={submissionStyles.submissionTitleRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              color={palette.primary}
              size={16}
            />
            <Text style={submissionStyles.submissionLabel}>Your answer</Text>
          </View>
          <Text style={submissionStyles.submissionHint}>
            Write a note, or attach an image or PDF.
          </Text>
        </View>
      </View>

      <TextInput
        multiline
        value={content}
        onChangeText={setContent}
        placeholder="Type your answer here..."
        placeholderTextColor={palette.muted}
        style={submissionStyles.responseInput}
      />

      <Pressable
        disabled={busy !== null}
        onPress={() => void chooseFile()}
        style={({ pressed }) => [
          submissionStyles.attachButton,
          pressed && { backgroundColor: palette.primarySoft },
        ]}
      >
        <MaterialCommunityIcons
          name="paperclip"
          color={palette.primary}
          size={18}
        />
        <Text style={submissionStyles.attachText}>
          {busy === "upload"
            ? "Uploading..."
            : attachment
              ? "Replace attachment"
              : "Add image or PDF"}
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
            color={palette.primary}
            size={20}
          />
          <Text numberOfLines={1} style={submissionStyles.attachedName}>
            {attachment.name}
          </Text>
          <Pressable onPress={() => setAttachment(null)} hitSlop={8}>
            <MaterialCommunityIcons
              name="close-circle-outline"
              color={palette.muted}
              size={18}
            />
          </Pressable>
        </View>
      )}

      <Pressable
        disabled={busy !== null}
        onPress={() => void submit()}
        style={({ pressed }) => [
          submissionStyles.submitButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <MaterialCommunityIcons
          name={busy === "submit" ? "loading" : "send"}
          color="#fff"
          size={17}
        />
        <Text style={submissionStyles.submitText}>
          {busy === "submit" ? "Saving..." : "Submit assignment"}
        </Text>
      </Pressable>

      {status ? (
        <Text style={submissionStyles.submissionStatus}>{status}</Text>
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
        setMessage("Marks aren't published yet — check back soon.");
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
      setMessage("✓ Marksheet ready!");
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
        style={({ pressed }) => [
          styles.marksheetButton,
          pressed && { backgroundColor: palette.primarySoft },
        ]}
      >
        <MaterialCommunityIcons
          name="file-pdf-box"
          color={palette.primary}
          size={18}
        />
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
  const label = isVideo ? "Video" : isPdf ? "PDF document" : "Document";

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
      <View style={[styles.fileRow, { backgroundColor: palette.warnSoft }]}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          color={palette.warn}
          size={25}
        />
        <View style={styles.fileCopy}>
          <Text style={[styles.attachmentText, { color: palette.warn }]}>
            Document unavailable
          </Text>
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
            color={palette.primary}
            size={26}
          />
          <View style={styles.fileCopy}>
            <Text style={styles.attachmentText}>{label}</Text>
            <Text style={styles.fileHint}>Tap to preview or save</Text>
          </View>
        </View>
      )}
      <View style={styles.fileActions}>
        <Pressable
          disabled={busy !== null}
          onPress={() => void preview()}
          style={({ pressed }) => [
            styles.fileButton,
            pressed && { backgroundColor: palette.primarySoft },
          ]}
        >
          <MaterialCommunityIcons
            name="eye-outline"
            color={palette.primary}
            size={16}
          />
          <Text style={styles.fileButtonText}>
            {busy === "preview" ? "Opening..." : "Preview"}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy !== null}
          onPress={() => void download()}
          style={({ pressed }) => [
            styles.fileButton,
            pressed && { backgroundColor: palette.primarySoft },
          ]}
        >
          <MaterialCommunityIcons
            name="download-outline"
            color={palette.primary}
            size={16}
          />
          <Text style={styles.fileButtonText}>
            {busy === "download" ? "Saving..." : "Save"}
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
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 15,
    padding: 14,
  },
  submissionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  submissionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  submissionLabel: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  submissionHint: {
    color: palette.inkSoft,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  responseInput: {
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.ink,
    minHeight: 90,
    marginTop: 12,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 14,
  },
  attachButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  attachText: {
    color: palette.primary,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  attachedFile: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    padding: 11,
  },
  attachedName: {
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { height: 4, width: 0 },
    elevation: 3,
  },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  submissionStatus: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
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
          <View style={{ flex: 1 }}>
            <Text style={styles.previewEyebrow}>ATTACHMENT</Text>
            <Text style={styles.previewTitle}>{label}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <MaterialCommunityIcons
              name="close"
              color={palette.ink}
              size={22}
            />
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
          <Text style={styles.previewDownloadText}>Save file</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.bg, padding: 20, paddingBottom: 40 },

  // Header
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  headerIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    fontWeight: "500",
  },

  loader: { marginTop: 48 },

  // Error
  errorCard: {
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    borderColor: "#fecdd3",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    padding: 16,
  },
  errorIcon: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  errorText: {
    color: palette.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // List
  list: { gap: 12, marginTop: 24 },
  card: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardIndex: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 14,
  },
  cardMeta: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 6,
  },

  // Description
  descriptionBox: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  descriptionLabel: {
    color: palette.inkSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  descriptionText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  attachmentsLabel: {
    color: palette.inkSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  // Marksheet
  marksheet: { marginTop: 14 },
  marksheetButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  marksheetText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  marksheetMessage: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },

  // Attachments
  attachment: { marginTop: 10 },
  attachmentImage: {
    borderRadius: 12,
    height: 150,
    width: "100%",
  },
  fileRow: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderColor: palette.primaryBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    padding: 12,
  },
  fileCopy: { flex: 1, marginLeft: 10 },
  attachmentText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  fileHint: { color: palette.inkSoft, fontSize: 11, marginTop: 3 },
  fileActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  fileButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  fileButtonText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  // Empty
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 28,
    padding: 28,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 56,
    marginBottom: 12,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },

  // Preview
  previewScreen: { backgroundColor: "#f8fafc", flex: 1 },
  previewHeader: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  previewEyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  previewTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
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
    backgroundColor: palette.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    margin: 16,
    padding: 15,
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 4,
  },
  previewDownloadText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
