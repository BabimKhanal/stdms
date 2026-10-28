import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { EduApiClient } from "@edu/api-client";
import { API_URL } from "./config";

export type MobileUser = { id: string; name: string; email?: string | null; username?: string | null; avatarUrl?: string | null; orgName?: string | null; roles: string[]; permissions: string[]; isPlatformAdmin?: boolean; mustChangePassword?: boolean; studentId?: string | null };

const ACCESS_KEY = "edu_access_token";
const REFRESH_KEY = "edu_refresh_token";
const USER_KEY = "edu_user";

async function readStorage(key: string) { return Platform.OS === "web" ? localStorage.getItem(key) : SecureStore.getItemAsync(key); }
async function writeStorage(key: string, value: string) { if (Platform.OS === "web") localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value); }
async function removeStorage(key: string) { if (Platform.OS === "web") localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); }

type AuthContextValue = { user: MobileUser | null; loading: boolean; signIn: (identifier: string, password: string) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { void restore(); }, []);
  async function restore() { try { const saved = await readStorage(USER_KEY); const accessToken = await readStorage(ACCESS_KEY); const refreshToken = await readStorage(REFRESH_KEY); if (!saved || !accessToken) return; const client = new EduApiClient(API_URL, () => accessToken); try { const current = await client.get<MobileUser>('/auth/me'); await writeStorage(USER_KEY, JSON.stringify(current)); setUser(current); } catch { if (!refreshToken) throw new Error('Session expired'); const refreshed = await new EduApiClient(API_URL).post<{ accessToken: string; refreshToken: string; user: MobileUser }>('/auth/refresh', { refreshToken }); await writeStorage(ACCESS_KEY, refreshed.accessToken); await writeStorage(REFRESH_KEY, refreshed.refreshToken); await writeStorage(USER_KEY, JSON.stringify(refreshed.user)); setUser(refreshed.user); } } catch { await clearSession(); } finally { setLoading(false); } }
  async function signIn(identifier: string, password: string) { let result: { accessToken: string; refreshToken: string; user: MobileUser }; try { result = await new EduApiClient(API_URL).post<{ accessToken: string; refreshToken: string; user: MobileUser }>("/auth/login", { identifier: identifier.trim(), password }); } catch (error) { if (error instanceof TypeError || (error instanceof Error && error.message.toLowerCase().includes("fetch"))) throw new Error(`Cannot reach API at ${API_URL}. Check EXPO_PUBLIC_API_URL and ensure the API is running on your network.`); throw error; } await writeStorage(ACCESS_KEY, result.accessToken); await writeStorage(REFRESH_KEY, result.refreshToken); await writeStorage(USER_KEY, JSON.stringify(result.user)); setUser(result.user); }
  async function clearSession() { const refreshToken = await readStorage(REFRESH_KEY); if (refreshToken) await new EduApiClient(API_URL).post('/auth/logout', { refreshToken }).catch(() => undefined); await Promise.all([removeStorage(ACCESS_KEY), removeStorage(REFRESH_KEY), removeStorage(USER_KEY)]); setUser(null); }
  const value = useMemo(() => ({ user, loading, signIn, signOut: clearSession }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }

export async function mobileToken() { return readStorage(ACCESS_KEY); }
