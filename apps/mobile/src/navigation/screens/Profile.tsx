import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EduApiClient } from "@edu/api-client";
import { API_URL } from "../../config";
import { mobileToken, useAuth } from "../../auth";

type StudentProfile = {
  fullName: string;
  studentId: string;
  admissionNumber?: string | null;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  admissionDate?: string | null;
  className?: string | null;
  sectionName?: string | null;
  rollNumber?: number | null;
  status?: string | null;
  guardians?: Array<{
    id: string;
    fullName: string;
    relationship: string;
    phone: string | null;
    isPrimary: boolean;
  }>;
};

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
};

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(user?.studentId));
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    phone: "",
    email: "",
    address: "",
    nationality: "",
  });

  useEffect(() => {
    if (!user?.studentId) return;
    let active = true;
    void mobileToken().then((token) => {
      if (!token) return;
      return new EduApiClient(API_URL, () => token)
        .get<StudentProfile | null>("/auth/profile")
        .then((result) => {
          if (!active || !result) return;
          setProfile(result);
          setForm({
            phone: result.phone ?? "",
            email: result.email ?? "",
            address: result.address ?? "",
            nationality: result.nationality ?? "",
          });
        })
        .catch((error: unknown) => {
          if (active)
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to load profile details",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [user?.studentId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const token = await mobileToken();
      if (!token) throw new Error("Session expired");
      const result = await new EduApiClient(
        API_URL,
        () => token,
      ).put<StudentProfile>("/auth/profile", {
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        nationality: form.nationality.trim() || null,
      });
      setProfile(result);
      setEditing(false);
      setMessage("✓ Profile updated");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update profile",
      );
    } finally {
      setSaving(false);
    }
  }

  const displayPhoto = profile?.photoUrl ?? user?.avatarUrl;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero header with avatar */}
      <View style={styles.heroCard}>
        <View style={styles.heroBlob} />
        <View style={styles.heroBlobSmall} />
        <View style={styles.avatarWrap}>
          {displayPhoto && !imageFailed ? (
            <Image
              onError={() => setImageFailed(true)}
              source={{ uri: displayPhoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.initial}>{user?.name?.charAt(0) ?? "U"}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <MaterialCommunityIcons name="camera" color="#fff" size={13} />
          </View>
        </View>
        <Text style={styles.name}>
          {profile?.fullName ?? user?.name ?? "User"}
        </Text>
        <Text style={styles.org}>{user?.orgName ?? "Nucleus Education"}</Text>
        {profile?.className ? (
          <View style={styles.heroPill}>
            <MaterialCommunityIcons
              name="school-outline"
              color="#fff"
              size={13}
            />
            <Text style={styles.heroPillText}>
              {profile.className}
              {profile.sectionName ? ` · ${profile.sectionName}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={styles.loader} />
      ) : profile ? (
        <>
          {/* Enrolment card - warm, not corporate */}
          <View style={styles.enrolmentCard}>
            <View style={styles.enrolmentHeader}>
              <View style={styles.enrolmentIcon}>
                <MaterialCommunityIcons
                  name="card-account-details-outline"
                  color={palette.primary}
                  size={20}
                />
              </View>
              <Text style={styles.enrolmentLabel}>CURRENT ENROLMENT</Text>
            </View>
            <Text style={styles.className}>
              {profile.className ?? "Class not assigned"}
              {profile.sectionName ? ` · ${profile.sectionName}` : ""}
            </Text>
            <View style={styles.enrolmentMetaRow}>
              {profile.rollNumber ? (
                <View style={styles.chip}>
                  <MaterialCommunityIcons
                    name="numeric"
                    color={palette.primary}
                    size={12}
                  />
                  <Text style={styles.chipText}>Roll {profile.rollNumber}</Text>
                </View>
              ) : null}
              <View style={[styles.chip, styles.chipSuccess]}>
                <View style={styles.statusDot} />
                <Text style={[styles.chipText, { color: palette.success }]}>
                  {profile.status ?? "active"}
                </Text>
              </View>
            </View>
          </View>

          {/* Student details - icon-led rows */}
          <Section title="Student details" icon="account-outline">
            <Detail
              label="Student ID"
              value={profile.studentId}
              icon="identifier"
            />
            <Detail
              label="Admission number"
              value={profile.admissionNumber}
              icon="pound"
            />
            <Detail
              label="Date of birth"
              value={profile.dateOfBirth}
              icon="cake-variant-outline"
            />
            <Detail
              label="Gender"
              value={profile.gender}
              icon="gender-male-female"
            />
            <Detail
              label="Blood group"
              value={profile.bloodGroup}
              icon="blood-bag"
            />
            <Detail
              label="Admission date"
              value={profile.admissionDate}
              icon="calendar-star"
              last
            />
          </Section>

          {/* Contact details - editable */}
          <Section
            title="Contact details"
            icon="phone-outline"
            action={editing ? "Cancel" : "Edit"}
            actionIcon={editing ? "close" : "pencil"}
            onPress={() => {
              setMessage("");
              setEditing((v) => !v);
            }}
          >
            {editing ? (
              <>
                <Field
                  label="Phone"
                  icon="phone"
                  value={form.phone}
                  onChangeText={(phone) => setForm((v) => ({ ...v, phone }))}
                  keyboardType="phone-pad"
                />
                <Field
                  label="Email"
                  icon="email-outline"
                  value={form.email}
                  onChangeText={(email) => setForm((v) => ({ ...v, email }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Address"
                  icon="map-marker-outline"
                  value={form.address}
                  onChangeText={(address) =>
                    setForm((v) => ({ ...v, address }))
                  }
                />
                <Field
                  label="Nationality"
                  icon="flag-outline"
                  value={form.nationality}
                  onChangeText={(nationality) =>
                    setForm((v) => ({ ...v, nationality }))
                  }
                />
                <Pressable
                  disabled={saving}
                  onPress={() => void save()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={saving ? "loading" : "check"}
                    color="#fff"
                    size={17}
                  />
                  <Text style={styles.saveText}>
                    {saving ? "Saving..." : "Save changes"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Detail
                  label="Phone"
                  value={profile.phone}
                  icon="phone-outline"
                />
                <Detail
                  label="Email"
                  value={profile.email}
                  icon="email-outline"
                />
                <Detail
                  label="Address"
                  value={profile.address}
                  icon="map-marker-outline"
                />
                <Detail
                  label="Nationality"
                  value={profile.nationality}
                  icon="flag-outline"
                  last
                />
              </>
            )}
          </Section>

          {/* Family contacts - friendly cards */}
          {profile.guardians?.length ? (
            <Section title="Family contacts" icon="account-group-outline">
              {profile.guardians.map((guardian, i) => (
                <View
                  key={guardian.id}
                  style={[
                    styles.guardianRow,
                    i === profile.guardians!.length - 1 && styles.guardianLast,
                  ]}
                >
                  <View style={styles.guardianAvatar}>
                    <Text style={styles.guardianInitial}>
                      {guardian.fullName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.guardianNameRow}>
                      <Text style={styles.guardianName}>
                        {guardian.fullName}
                      </Text>
                      {guardian.isPrimary ? (
                        <View style={styles.primaryTag}>
                          <Text style={styles.primaryTagText}>PRIMARY</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.guardianMeta}>
                      {guardian.relationship}
                      {guardian.phone ? ` · ${guardian.phone}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          ) : null}
        </>
      ) : (
        <Section title="Account details" icon="account-circle-outline">
          <Detail label="Email" value={user?.email} icon="email-outline" />
          <Detail label="Username" value={user?.username} icon="at" />
          <Detail
            label="Roles"
            value={user?.roles?.join(" · ")}
            icon="shield-account-outline"
          />
          <Detail
            label="Institution"
            value={user?.orgName}
            icon="school-outline"
            last
          />
        </Section>
      )}

      {message ? (
        <View style={styles.messageBox}>
          <MaterialCommunityIcons
            name={
              message.startsWith("✓") ? "check-circle" : "information-outline"
            }
            color={message.startsWith("✓") ? palette.success : palette.inkSoft}
            size={16}
          />
          <Text
            style={[
              styles.message,
              message.startsWith("✓") && { color: palette.success },
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Section({
  title,
  icon,
  action,
  actionIcon,
  onPress,
  children,
}: {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  action?: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIcon}>
            <MaterialCommunityIcons
              name={icon}
              color={palette.primary}
              size={16}
            />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {action && onPress ? (
          <Pressable
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { backgroundColor: palette.primarySoft },
            ]}
          >
            {actionIcon && (
              <MaterialCommunityIcons
                name={actionIcon}
                color={palette.primary}
                size={13}
              />
            )}
            <Text style={styles.actionText}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      <View>{children}</View>
    </View>
  );
}

function Detail({
  label,
  value,
  icon,
  last,
}: {
  label: string;
  value?: string | number | null;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  last?: boolean;
}) {
  const has = value !== null && value !== undefined && String(value).length > 0;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      {icon ? (
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons
            name={icon}
            color={palette.primary}
            size={16}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, !has && styles.valueEmpty]}>
          {has ? value : "Not provided"}
        </Text>
      </View>
    </View>
  );
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  ...props
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <MaterialCommunityIcons name={icon} color={palette.primary} size={14} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={palette.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.bg, padding: 20, paddingBottom: 48 },

  // Hero
  heroCard: {
    alignItems: "center",
    backgroundColor: "#5b21b6",
    borderRadius: 28,
    marginTop: 6,
    overflow: "hidden",
    paddingBottom: 24,
    paddingTop: 26,
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
    height: 220,
    opacity: 0.35,
    position: "absolute",
    right: -70,
    top: -80,
    width: 220,
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
  avatarWrap: { position: "relative" },
  avatar: {
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 55,
    borderWidth: 3,
    height: 110,
    width: 110,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 55,
    borderWidth: 3,
    height: 110,
    justifyContent: "center",
    width: 110,
  },
  initial: { color: "#fff", fontSize: 42, fontWeight: "800" },
  avatarBadge: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderColor: "#fff",
    borderRadius: 14,
    borderWidth: 2.5,
    bottom: 0,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 28,
  },
  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 14,
    textAlign: "center",
  },
  org: { color: "#ddd6fe", fontSize: 13, fontWeight: "600", marginTop: 5 },
  heroPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  loader: { marginTop: 36 },

  // Enrolment
  enrolmentCard: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
    shadowColor: palette.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  enrolmentHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  enrolmentIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  enrolmentLabel: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  className: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 12,
  },
  enrolmentMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 20,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipSuccess: { backgroundColor: palette.successSoft },
  chipText: { color: palette.primary, fontSize: 11, fontWeight: "800" },
  statusDot: {
    backgroundColor: palette.success,
    borderRadius: 4,
    height: 7,
    width: 7,
  },

  // Section
  section: {
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { height: 4, width: 0 },
    elevation: 1,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 9,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  actionBtn: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionText: { color: palette.primary, fontSize: 12, fontWeight: "800" },

  // Rows
  row: {
    alignItems: "flex-start",
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowIcon: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    marginTop: 2,
    width: 30,
  },
  label: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 20,
  },
  valueEmpty: { color: palette.muted, fontStyle: "italic", fontWeight: "500" },

  // Fields (edit mode)
  field: { marginTop: 12 },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  fieldLabel: { color: palette.inkSoft, fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: palette.bg,
    borderColor: palette.primaryBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 14,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: palette.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { height: 4, width: 0 },
    elevation: 3,
  },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // Guardians
  guardianRow: {
    alignItems: "center",
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  guardianLast: { borderBottomWidth: 0, paddingBottom: 0 },
  guardianAvatar: {
    alignItems: "center",
    backgroundColor: palette.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  guardianInitial: { color: palette.primary, fontSize: 16, fontWeight: "800" },
  guardianNameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  guardianName: { color: palette.ink, fontSize: 14, fontWeight: "700" },
  primaryTag: {
    backgroundColor: palette.primarySoft,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryTagText: {
    color: palette.primary,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  guardianMeta: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },

  // Message
  messageBox: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  message: { color: palette.inkSoft, flex: 1, fontSize: 13, fontWeight: "600" },
});
