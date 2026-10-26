import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../../config';
import { mobileToken } from '../../auth';

export function Updates() {
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string | null; createdAt: string; readAt: string | null }>>([]);
  useEffect(() => {
    let socket: WebSocket | undefined;
    let active = true;
    void (async () => {
      const token = await mobileToken();
      if (!token || !active) return;
      const response = await fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { data: typeof items };
      if (active) setItems(payload.data ?? []);
      socket = new WebSocket(`${API_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '')}/ws/notifications?token=${encodeURIComponent(token)}`);
      socket.onmessage = (event) => { const message = JSON.parse(event.data) as { type: string; data?: typeof items[number] }; if (message.type === 'notification' && message.data) setItems((current) => [message.data!, ...current.filter((item) => item.id !== message.data!.id)]); };
    })();
    return () => { active = false; socket?.close(); };
  }, []);
  async function read(id: string) { const token = await mobileToken(); if (token) await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }); setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); }
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>INBOX</Text><Text style={styles.title}>Updates</Text><Text style={styles.subtitle}>Important school activity, delivered in real time.</Text>{items.length ? items.map((item) => <Pressable key={item.id} onPress={() => void read(item.id)} style={[styles.card, !item.readAt && styles.unread]}><Text style={styles.cardTitle}>{item.title}</Text>{item.body && <Text style={styles.body}>{item.body}</Text>}<Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text></Pressable>) : <View style={styles.empty}><Text style={styles.emptyTitle}>You are all caught up.</Text><Text style={styles.body}>New notices and results will appear here.</Text></View>}</ScrollView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f9fc', flexGrow: 1, padding: 20 }, eyebrow: { color: '#2563eb', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { color: '#0f172a', fontSize: 31, fontWeight: '800', marginTop: 9 }, subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginBottom: 22, marginTop: 7 }, card: { backgroundColor: '#fff', borderColor: '#e7edf5', borderRadius: 18, borderWidth: 1, marginBottom: 10, padding: 16 }, unread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, body: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 6 }, date: { color: '#94a3b8', fontSize: 11, marginTop: 10 }, empty: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 28 }, emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
});
