import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../config';
import { mobileToken } from '../../auth';

type Notification = { id: string; title: string; body: string | null; createdAt: string; readAt: string | null };

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return new Date(value).toLocaleDateString();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

export function Updates() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const token = await mobileToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to load your updates right now.');
      const payload = await response.json() as { data?: Notification[] };
      setItems(payload.data ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your updates right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let active = true;
    void (async () => {
      const token = await mobileToken();
      if (!active) return;
      await load();
      if (!token || !active) return;
      socket = new WebSocket(`${API_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '')}/ws/notifications?token=${encodeURIComponent(token)}`);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type: string; data?: Notification };
          if (message.type === 'notification' && message.data) {
            setItems((current) => [message.data!, ...current.filter((item) => item.id !== message.data!.id)]);
          }
        } catch {
          // Ignore malformed socket frames.
        }
      };
      socket.onerror = () => undefined;
    })().catch(() => undefined);
    return () => {
      active = false;
      socket?.close();
    };
  }, [load]);

  async function read(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current || current.readAt) return;
    setItems((list) => list.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    const token = await mobileToken();
    if (!token) return;
    const response = await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }).catch(() => null);
    if (!response || !response.ok) {
      setItems((list) => list.map((item) => item.id === id ? { ...item, readAt: null } : item));
      setError('That update could not be marked as read.');
    }
  }

  async function markAllRead() {
    const unread = items.filter((item) => !item.readAt);
    if (!unread.length || marking) return;
    setMarking(true);
    setError('');
    const token = await mobileToken();
    if (!token) {
      setMarking(false);
      setError('Your session has expired. Please sign in again.');
      return;
    }
    const results = await Promise.all(unread.map((item) => fetch(`${API_URL}/notifications/${item.id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }).then((response) => response.ok).catch(() => false)));
    if (results.every(Boolean)) {
      setItems((list) => list.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    } else {
      setError('Some updates could not be marked as read. Pull down to refresh.');
    }
    setMarking(false);
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} colors={['#2563eb']} tintColor="#2563eb" />}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>INBOX</Text>
          <Text style={styles.title}>Updates</Text>
          <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'} for you.` : 'Important school activity, delivered in real time.'}</Text>
        </View>
        {unreadCount ? (
          <Pressable accessibilityRole="button" disabled={marking} onPress={() => void markAllRead()} style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}>
            {marking ? <ActivityIndicator color="#2563eb" size="small" /> : <MaterialCommunityIcons name="check-all" color="#2563eb" size={18} />}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Pressable onPress={() => { setLoading(true); void load(); }} style={styles.errorBox}>
          <MaterialCommunityIcons name="cloud-alert-outline" color="#be123c" size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      {loading ? <ActivityIndicator color="#2563eb" style={styles.loader} /> : items.length ? items.map((item) => (
        <Pressable key={item.id} onPress={() => void read(item.id)} style={({ pressed }) => [styles.card, !item.readAt && styles.unread, pressed && styles.pressed]}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              {!item.readAt ? <View style={styles.unreadDot} /> : null}
              <Text style={[styles.cardTitle, !item.readAt && styles.cardTitleUnread]}>{item.title}</Text>
            </View>
            <Text style={styles.date}>{timeAgo(item.createdAt)}</Text>
          </View>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          {!item.readAt ? <Text style={styles.tapHint}>Tap to mark as read</Text> : null}
        </Pressable>
      )) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><MaterialCommunityIcons name="bell-check-outline" color="#2563eb" size={26} /></View>
          <Text style={styles.emptyTitle}>You are all caught up.</Text>
          <Text style={styles.body}>New notices, results, and school announcements will appear here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f9fc', flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 22 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#0f172a', fontSize: 31, fontWeight: '800', letterSpacing: -0.5, marginTop: 9 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 7 },
  markAll: { alignItems: 'center', backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderRadius: 12, borderWidth: 1, height: 42, justifyContent: 'center', marginTop: 16, width: 42 },
  errorBox: { alignItems: 'center', backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 14, padding: 12 },
  errorText: { color: '#be123c', flex: 1, fontSize: 12, lineHeight: 18 },
  loader: { marginTop: 44 },
  card: { backgroundColor: '#fff', borderColor: '#e7edf5', borderRadius: 18, borderWidth: 1, marginBottom: 10, padding: 16 },
  unread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  cardTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 7 },
  unreadDot: { backgroundColor: '#2563eb', borderRadius: 4, height: 8, width: 8 },
  cardTitle: { color: '#0f172a', flex: 1, fontSize: 15, fontWeight: '700' },
  cardTitleUnread: { fontWeight: '800' },
  date: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  body: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 6 },
  tapHint: { color: '#2563eb', fontSize: 11, fontWeight: '700', marginTop: 10 },
  empty: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7edf5', borderRadius: 20, borderWidth: 1, padding: 30 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 18, height: 54, justifyContent: 'center', marginBottom: 12, width: 54 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
