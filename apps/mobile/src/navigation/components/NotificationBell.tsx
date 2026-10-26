import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { API_URL } from '../../config';
import { mobileToken } from '../../auth';

export function NotificationBell({ onPress }: { onPress: () => void }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    void (async () => {
      const token = await mobileToken();
      if (!token || !active) return;
      const response = await fetch(`${API_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { data?: { count?: number } };
      if (active) setUnread(Number(payload.data?.count ?? 0));
      socket = new WebSocket(`${API_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '')}/ws/notifications?token=${encodeURIComponent(token)}`);
      socket.onmessage = (event) => { const message = JSON.parse(event.data) as { type: string }; if (message.type === 'notification' && active) setUnread((count) => count + 1); };
    })().catch(() => undefined);
    return () => { active = false; socket?.close(); };
  }, []);
  return <Pressable accessibilityLabel="Open notifications" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialCommunityIcons name="bell-outline" color="#1d4ed8" size={20} />{unread > 0 && <Text style={styles.badge}>{unread > 9 ? '9+' : unread}</Text>}</Pressable>;
}

const styles = StyleSheet.create({ button: { alignItems: 'center', backgroundColor: '#eff6ff', borderColor: '#dbeafe', borderRadius: 13, borderWidth: 1, height: 40, justifyContent: 'center', position: 'relative', width: 40 }, badge: { backgroundColor: '#e11d48', borderColor: '#f7f9fc', borderRadius: 8, borderWidth: 2, color: '#fff', fontSize: 9, fontWeight: '800', minWidth: 17, paddingHorizontal: 3, position: 'absolute', right: -5, textAlign: 'center', top: -6 }, pressed: { backgroundColor: '#dbeafe', opacity: 0.85 } });
