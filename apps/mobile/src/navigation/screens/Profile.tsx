import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EduApiClient } from '@edu/api-client';
import { API_URL } from '../../config';
import { mobileToken, useAuth } from '../../auth';

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
  guardians?: Array<{ id: string; fullName: string; relationship: string; phone: string | null; isPrimary: boolean }>;
};

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(user?.studentId));
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ phone: '', email: '', address: '', nationality: '' });

  useEffect(() => {
    if (!user?.studentId) return;
    let active = true;
    void mobileToken().then((token) => {
      if (!token) return;
      return new EduApiClient(API_URL, () => token).get<StudentProfile | null>('/auth/profile').then((result) => {
        if (!active || !result) return;
        setProfile(result);
        setForm({ phone: result.phone ?? '', email: result.email ?? '', address: result.address ?? '', nationality: result.nationality ?? '' });
      }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load profile details'); }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [user?.studentId]);

  async function save() {
    setSaving(true); setMessage('');
    try {
      const token = await mobileToken();
      if (!token) throw new Error('Session expired');
      const result = await new EduApiClient(API_URL, () => token).put<StudentProfile>('/auth/profile', {
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        nationality: form.nationality.trim() || null,
      });
      setProfile(result); setEditing(false); setMessage('Profile updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update profile'); } finally { setSaving(false); }
  }

  const displayPhoto = profile?.photoUrl ?? user?.avatarUrl;
  return <ScrollView contentContainerStyle={styles.container}>{displayPhoto && !imageFailed ? <Image onError={() => setImageFailed(true)} source={{ uri: displayPhoto }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{user?.name?.charAt(0) ?? 'U'}</Text></View>}<Text style={styles.name}>{profile?.fullName ?? user?.name ?? 'User'}</Text><Text style={styles.org}>{user?.orgName ?? 'Nucleus Education'}</Text>{loading ? <ActivityIndicator color="#2563eb" style={styles.loader} /> : profile ? <><View style={styles.classCard}><Text style={styles.cardEyebrow}>CURRENT ENROLMENT</Text><Text style={styles.className}>{profile.className ?? 'Class not assigned'}{profile.sectionName ? ` · ${profile.sectionName}` : ''}</Text><Text style={styles.classMeta}>{profile.rollNumber ? `Roll no. ${profile.rollNumber} · ` : ''}{profile.status ?? 'active'}</Text></View><View style={styles.details}><Text style={styles.sectionTitle}>Student details</Text><Detail label="Student ID" value={profile.studentId} /><Detail label="Admission number" value={profile.admissionNumber} /><Detail label="Date of birth" value={profile.dateOfBirth} /><Detail label="Gender" value={profile.gender} /><Detail label="Blood group" value={profile.bloodGroup} /><Detail label="Admission date" value={profile.admissionDate} /></View><View style={styles.details}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Contact details</Text><Pressable onPress={() => { setMessage(''); setEditing((value) => !value); }}><Text style={styles.editText}>{editing ? 'Cancel' : 'Edit'}</Text></Pressable></View>{editing ? <><Field label="Phone" value={form.phone} onChangeText={(phone) => setForm((value) => ({ ...value, phone }))} keyboardType="phone-pad" /><Field label="Email" value={form.email} onChangeText={(email) => setForm((value) => ({ ...value, email }))} keyboardType="email-address" autoCapitalize="none" /><Field label="Address" value={form.address} onChangeText={(address) => setForm((value) => ({ ...value, address }))} /><Field label="Nationality" value={form.nationality} onChangeText={(nationality) => setForm((value) => ({ ...value, nationality }))} /><Pressable disabled={saving} onPress={() => void save()} style={styles.saveButton}><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save changes'}</Text></Pressable></> : <><Detail label="Phone" value={profile.phone} /><Detail label="Email" value={profile.email} /><Detail label="Address" value={profile.address} /><Detail label="Nationality" value={profile.nationality} /></>}</View>{profile.guardians?.length ? <View style={styles.details}><Text style={styles.sectionTitle}>Family contacts</Text>{profile.guardians.map((guardian) => <Detail key={guardian.id} label={`${guardian.relationship}${guardian.isPrimary ? ' · primary' : ''}`} value={`${guardian.fullName}${guardian.phone ? ` · ${guardian.phone}` : ''}`} />)}</View> : null}</> : <View style={styles.details}><Detail label="Email" value={user?.email} /><Detail label="Username" value={user?.username} /><Detail label="Roles" value={user?.roles?.join(' · ')} /></View>}{message ? <Text style={styles.message}>{message}</Text> : null}</ScrollView>;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) { return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || 'Not provided'}</Text></View>; }
function Field({ label, value, onChangeText, ...props }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences' }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={styles.input} {...props} /></View>; }

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: '#f7f9fc', padding: 20, paddingBottom: 48 }, avatar: { borderColor: '#bfdbfe', borderRadius: 50, borderWidth: 3, height: 100, marginTop: 12, width: 100 }, avatarFallback: { alignItems: 'center', backgroundColor: '#dbeafe', borderColor: '#bfdbfe', borderRadius: 50, borderWidth: 3, height: 100, justifyContent: 'center', marginTop: 12, width: 100 }, initial: { color: '#1d4ed8', fontSize: 36, fontWeight: '800' }, name: { color: '#0f172a', fontSize: 26, fontWeight: '800', marginTop: 15, textAlign: 'center' }, org: { color: '#64748b', fontSize: 14, marginTop: 6 }, loader: { marginTop: 36 }, classCard: { alignSelf: 'stretch', backgroundColor: '#111c33', borderRadius: 22, marginTop: 25, overflow: 'hidden', padding: 20 }, cardEyebrow: { color: '#93c5fd', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, className: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 9 }, classMeta: { color: '#cbd5e1', fontSize: 13, marginTop: 7 }, details: { alignSelf: 'stretch', backgroundColor: '#fff', borderColor: '#e7edf5', borderRadius: 20, borderWidth: 1, marginTop: 13, padding: 17 }, sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 4 }, editText: { color: '#2563eb', fontSize: 13, fontWeight: '800' }, row: { borderBottomColor: '#f1f5f9', borderBottomWidth: 1, paddingVertical: 12 }, label: { color: '#94a3b8', fontSize: 11, fontWeight: '600' }, value: { color: '#334155', fontSize: 15, fontWeight: '600', marginTop: 4 }, field: { marginTop: 12 }, input: { borderColor: '#dbe4ef', borderRadius: 12, borderWidth: 1, color: '#0f172a', fontSize: 15, marginTop: 6, paddingHorizontal: 12, paddingVertical: 11 }, saveButton: { alignItems: 'center', backgroundColor: '#2563eb', borderRadius: 12, marginTop: 16, padding: 14 }, saveText: { color: '#fff', fontSize: 14, fontWeight: '800' }, message: { color: '#64748b', fontSize: 13, marginTop: 14, textAlign: 'center' },
});
