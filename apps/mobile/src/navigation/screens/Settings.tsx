import { Text } from '@react-navigation/elements';
import { Pressable } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';

export function Settings() {
  const { signOut } = useAuth();
  return <View style={styles.container}><Text style={styles.title}>Settings</Text><Text style={styles.subtitle}>Manage your mobile session and preferences.</Text><Pressable onPress={() => void signOut()} style={styles.button}><Text style={styles.buttonText}>Sign out</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 }, title: { color: '#0f172a', fontSize: 30, fontWeight: '700' }, subtitle: { color: '#64748b', fontSize: 15, marginTop: 8 }, button: { backgroundColor: '#be123c', borderRadius: 14, marginTop: 32, padding: 16 }, buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
