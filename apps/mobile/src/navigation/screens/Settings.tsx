import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@react-navigation/elements';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';
import { API_URL } from '../../config';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}><MaterialCommunityIcons name={icon} color="#2563eb" size={19} /></View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function Settings() {
  const { user, signOut } = useAuth();
  const roles = user?.roles?.length ? user.roles.join(' · ') : 'Member';

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Your account and app information.</Text>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <Detail icon="account-outline" label="Name" value={user?.name ?? 'Not available'} />
        <View style={styles.divider} />
        <Detail icon="email-outline" label="Email" value={user?.email ?? 'Not available'} />
        <View style={styles.divider} />
        <Detail icon="shield-account-outline" label="Role" value={roles} />
        <View style={styles.divider} />
        <Detail icon="office-building-outline" label="Institution" value={user?.orgName ?? 'Not available'} />
      </View>

      <Text style={styles.sectionLabel}>App</Text>
      <View style={styles.card}>
        <Detail icon="cellphone" label="Application" value="Nucleus Education" />
        <View style={styles.divider} />
        <Detail icon="tag-outline" label="Version" value="1.0.0" />
        <View style={styles.divider} />
        <Detail icon="server-network-outline" label="Server" value={API_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '')} />
      </View>

      <Pressable accessibilityRole="button" onPress={confirmSignOut} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <MaterialCommunityIcons name="logout" color="#be123c" size={20} />
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
      <Text style={styles.footer}>Nucleus Education · Secure school management</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f9fc', flexGrow: 1, padding: 24, paddingBottom: 40 },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 20, marginTop: 7 },
  sectionLabel: { color: '#334155', fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginBottom: 10, marginTop: 26 },
  card: { backgroundColor: '#fff', borderColor: '#e7edf5', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  detail: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 },
  detailIcon: { alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  detailCopy: { flex: 1 },
  detailLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { color: '#0f172a', fontSize: 14, fontWeight: '600', marginTop: 4 },
  divider: { backgroundColor: '#f1f5f9', height: 1, marginLeft: 64 },
  button: { alignItems: 'center', backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 30, padding: 16 },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#be123c', fontSize: 15, fontWeight: '800' },
  footer: { color: '#94a3b8', fontSize: 11, marginTop: 22, textAlign: 'center' },
});
