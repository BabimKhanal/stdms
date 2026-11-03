import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { EduApiClient } from "@edu/api-client";
import { API_URL } from "./config";
import { unregisterPushToken } from "./lib/push-notifications";

export type MobileUser = {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  orgName?: string | null;
  roles: string[];
  permissions: string[];
  isPlatformAdmin?: boolean;
  mustChangePassword?: boolean;
  studentId?: string | null;
};

const ACCESS_KEY = "edu_access_token";
const REFRESH_KEY = "edu_refresh_token";
const USER_KEY = "edu_user";

async function readStorage(key: string) {
  return Platform.OS === "web"
    ? localStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function writeStorage(key: string, value: string) {
  if (Platform.OS === "web") localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
async function removeStorage(key: string) {
  if (Platform.OS === "web") localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

type AuthContextValue = {
  user: MobileUser | null;
  updateUser: (patch: Partial<MobileUser>) => Promise<void>;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changeTemporaryPassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clearSession = useCallback(async () => {
    const accessToken = await readStorage(ACCESS_KEY);
    await unregisterPushToken(accessToken).catch(() => undefined);
    const refreshToken = await readStorage(REFRESH_KEY);
    if (refreshToken)
      await new EduApiClient(API_URL)
        .post("/auth/logout", { refreshToken })
        .catch(() => undefined);
    await Promise.all([
      removeStorage(ACCESS_KEY),
      removeStorage(REFRESH_KEY),
      removeStorage(USER_KEY),
    ]);
    setUser(null);
  }, []);
  const restore = useCallback(async () => {
    try {
      const saved = await readStorage(USER_KEY);
      const accessToken = await readStorage(ACCESS_KEY);
      const refreshToken = await readStorage(REFRESH_KEY);
      if (!saved || !accessToken) {
        await Promise.all([
          removeStorage(ACCESS_KEY),
          removeStorage(REFRESH_KEY),
          removeStorage(USER_KEY),
        ]);
        return;
      }
      const client = new EduApiClient(API_URL, () => accessToken);
      try {
        const current = await client.get<MobileUser>("/auth/me");
        await writeStorage(USER_KEY, JSON.stringify(current));
        setUser(current);
      } catch {
        if (!refreshToken) throw new Error("Session expired");
        const refreshed = await new EduApiClient(API_URL).post<{
          accessToken: string;
          refreshToken: string;
          user: MobileUser;
        }>("/auth/refresh", { refreshToken });
        await writeStorage(ACCESS_KEY, refreshed.accessToken);
        await writeStorage(REFRESH_KEY, refreshed.refreshToken);
        await writeStorage(USER_KEY, JSON.stringify(refreshed.user));
        setUser(refreshed.user);
      }
    } catch {
      await clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);
  useEffect(() => {
    // Session restoration is an external storage/API synchronization on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
  }, [restore]);
  async function signIn(identifier: string, password: string) {
    let result: { accessToken: string; refreshToken: string; user: MobileUser };
    try {
      result = await new EduApiClient(API_URL).post<{
        accessToken: string;
        refreshToken: string;
        user: MobileUser;
      }>("/auth/login", { identifier: identifier.trim(), password });
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof Error &&
          error.message.toLowerCase().includes("fetch"))
      )
        throw new Error(
          `Cannot reach API at ${API_URL}. Check EXPO_PUBLIC_API_URL and ensure the API is running on your network.`,
        );
      throw error;
    }
    await writeStorage(ACCESS_KEY, result.accessToken);
    await writeStorage(REFRESH_KEY, result.refreshToken);
    await writeStorage(USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
  }
  async function changeTemporaryPassword(
    currentPassword: string,
    newPassword: string,
  ) {
    const token = await readStorage(ACCESS_KEY);
    if (!token) throw new Error("Session expired. Please sign in again.");
    await new EduApiClient(API_URL, () => token).post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    await clearSession();
  }
  async function updateUser(patch: Partial<MobileUser>) {
    if (!user) return;
    const next = { ...user, ...patch };
    await writeStorage(USER_KEY, JSON.stringify(next));
    setUser(next);
  }
  const value = {
    user,
    updateUser,
    loading,
    signIn,
    signOut: clearSession,
    changeTemporaryPassword,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export async function mobileToken() {
  return readStorage(ACCESS_KEY);
}

export async function refreshMobileSession() {
  const refreshToken = await readStorage(REFRESH_KEY);
  if (!refreshToken) return null;
  const refreshed = await new EduApiClient(API_URL).post<{
    accessToken: string;
    refreshToken: string;
    user: MobileUser;
  }>("/auth/refresh", { refreshToken });
  await writeStorage(ACCESS_KEY, refreshed.accessToken);
  await writeStorage(REFRESH_KEY, refreshed.refreshToken);
  await writeStorage(USER_KEY, JSON.stringify(refreshed.user));
  return refreshed.accessToken;
}
