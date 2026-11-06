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
      if (!response.ok) return;
      const payload = await response.json() as { data?: { count?: number } };
      if (active) setUnread(Number(payload.data?.count ?? 0));
      socket = new WebSocket(`${API_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '')}/ws/notifications?token=${encodeURIComponent(token)}`);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type: string };
          if (message.type === 'notification' && active) setUnread((count) => count + 1);
        } catch {
          // Ignore malformed socket frames.
        }
      };
    })().catch(() => undefined);
    return () => { active = false; socket?.close(); };
  }, []);
  return <Pressable accessibilityLabel={unread ? `Open updates, ${unread} unread` : "Open updates"} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialCommunityIcons name="bell-outline" color="#7c3aed" size={23} />{unread > 0 && <Text style={styles.badge}>{unread > 9 ? '9+' : unread}</Text>}</Pressable>;
}

const styles = StyleSheet.create({ button: { alignItems: 'center', backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', borderRadius: 15, borderWidth: 1, height: 48, justifyContent: 'center', position: 'relative', width: 48 }, badge: { backgroundColor: '#e11d48', borderColor: '#f7f9fc', borderRadius: 9, borderWidth: 2, color: '#fff', fontSize: 10, fontWeight: '800', minWidth: 19, paddingHorizontal: 3, position: 'absolute', right: -4, textAlign: 'center', top: -5 }, pressed: { backgroundColor: '#ddd6fe', opacity: 0.85 } });
